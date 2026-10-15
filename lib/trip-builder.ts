import "server-only";
import crypto from "crypto";
import { fetchQuoteEmails } from "./o365-client";
import { buildTripKey, type ParsedSubject } from "./subject-parser";
import { emailText, extractTrip, isQuote, parseQuoteEmail } from "./email-pipeline";
import { getStoredAccount, getStoredRefreshToken } from "./auth";
import { aiParseEmail, isAiEnabled } from "./ai-parser";
import { getAirportName } from "./airport-lookup";
import { getDataContext } from "./data-mode";
import { loadSeedEmails } from "./seed-data";
import { generateTripId } from "./trip-id";
import type { Trip, ParsedQuote, RawEmail, UnmatchedEmail } from "./types";

async function extractPdfText(base64Data: string): Promise<string | null> {
  const { extractTextFromPdf } = await import("./pdf-extract");
  return extractTextFromPdf(base64Data);
}

// --- Process a single email: AI (single call) → regex fallback ---

interface ProcessedEmail {
  quote: ParsedQuote;
  tripInfo: ParsedSubject;
}

// Parsed results are cached per email so each message is only sent to the AI once
const parseCache = new Map<string, ProcessedEmail>();

function emailFingerprint(email: RawEmail): string {
  let hash = 0;
  const text = email.subject + email.body;
  for (let i = 0; i < text.length; i++) hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
  return `${email.id}|${hash}`;
}

async function processEmailCached(email: RawEmail): Promise<ProcessedEmail> {
  const key = emailFingerprint(email);
  const hit = parseCache.get(key);
  if (hit) {
    // Received time may shift (demo anchor); everything else is stable
    return { ...hit, quote: { ...hit.quote, receivedAt: email.receivedAt, attachments: email.attachments } };
  }
  const result = await processEmail(email);
  if (parseCache.size > 2000) parseCache.clear();
  parseCache.set(key, result);
  return result;
}

async function processEmail(email: RawEmail): Promise<ProcessedEmail> {
  const bodyText = emailText(email);
  const filenames = email.attachments.map((a) => a.filename);

  // Extract PDF text if present
  let pdfText: string | null = null;
  for (const attachment of email.attachments) {
    const isPdf = attachment.contentType === "application/pdf" ||
      attachment.filename?.toLowerCase().endsWith(".pdf");
    if (!isPdf) continue;

    const base64Match = attachment.url.match(/^data:[^;]+;base64,(.+)$/);
    if (!base64Match) continue;

    pdfText = await extractPdfText(base64Match[1]);
    if (!pdfText || pdfText.trim().length <= 10) pdfText = null;
    break;
  }

  // Try single combined AI call (quote + trip in one request)
  if (isAiEnabled()) {
    const aiResult = await aiParseEmail(bodyText, email.subject, email.fromName, filenames, pdfText);

    if (aiResult) {
      console.log(`[processEmail] AI: price=${aiResult.price}, aircraft=${aiResult.aircraft}, route=${aiResult.origin}->${aiResult.destination}, date=${aiResult.date}`);

      const quote: ParsedQuote = {
        emailId: email.id,
        price: aiResult.price,
        priceFormatted: aiResult.price ? `$${aiResult.price.toLocaleString()}` : null,
        aircraft: aiResult.aircraft,
        yom: aiResult.yom,
        maxPax: aiResult.maxPax,
        tailNumber: aiResult.tailNumber,
        refurbInterior: aiResult.refurbInterior,
        refurbExterior: aiResult.refurbExterior,
        totalHours: aiResult.totalHours,
        operator: aiResult.operator,
        quoteSource: pdfText ? "pdf" : aiResult.isExternalLink ? "external" : "inline",
        externalLink: aiResult.externalLink,
        status: "Unanswered",
        receivedAt: email.receivedAt,
        subject: email.subject,
        from: email.from,
        fromName: email.fromName,
        bodyType: email.bodyType,
        body: email.body,
        attachments: email.attachments,
      };

      // Use AI trip info, supplement with regex if incomplete
      let origin = aiResult.origin;
      let destination = aiResult.destination;
      let date = aiResult.date;

      if (!origin || !destination || !date) {
        const regexInfo = extractTrip(email, bodyText, pdfText);
        origin = origin ?? regexInfo.origin;
        destination = destination ?? regexInfo.destination;
        date = date ?? regexInfo.date;
      }

      return { quote, tripInfo: { origin, destination, date } };
    }
  }

  // Rules based parsing (no AI, or the AI call failed)
  const parsed = parseQuoteEmail(email, pdfText);
  return { quote: parsed.quote, tripInfo: parsed.trip };
}

// --- In-memory cache to avoid re-parsing on every page load ---

export interface ScanStats {
  scanned: number; // emails read
  quotes: number; // emails recognized as operator quotes
}

interface CachedResult {
  trips: Trip[];
  unmatched: UnmatchedEmail[];
  stats: ScanStats;
  timestamp: number;
}

// One entry per inbox: results are never shared between connected accounts
const cache = new Map<string, CachedResult>();
const CACHE_TTL_MS = 55_000; // 55 seconds — just under the 60s auto-refresh

export async function buildTrips(): Promise<{
  trips: Trip[];
  unmatched: UnmatchedEmail[];
  stats: ScanStats;
}> {
  const { mode, anchorMs } = await getDataContext();
  let cacheKey = `demo:${anchorMs}`;
  if (mode === "live") {
    const token = await getStoredRefreshToken().catch(() => null);
    if (!token) return { trips: [], unmatched: [], stats: { scanned: 0, quotes: 0 } };
    cacheKey = `live:${crypto.createHash("sha256").update(token).digest("hex").slice(0, 24)}`;
  }

  // Return cached result immediately if cache is fresh — skip Outlook fetch entirely
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.timestamp < CACHE_TTL_MS) {
    return { trips: hit.trips, unmatched: hit.unmatched, stats: hit.stats };
  }

  let scanned: number;
  let validEmails: RawEmail[];
  if (mode === "demo") {
    validEmails = loadSeedEmails(anchorMs);
    scanned = validEmails.length;
  } else {
    const account = await getStoredAccount().catch(() => null);
    const scan = await fetchQuoteEmails(account?.email);
    validEmails = scan.emails;
    scanned = scan.scanned;
  }

  console.log(`[buildTrips] Processing ${validEmails.length} likely quotes of ${scanned} emails (AI: ${isAiEnabled() ? "ON" : "OFF"})`);
  const startTime = Date.now();

  // Process ALL emails in parallel
  const results = await Promise.all(validEmails.map((email) => processEmailCached(email)));

  const tripMap = new Map<string, { origin: string; destination: string; date: string; quotes: ParsedQuote[] }>();
  const unmatched: UnmatchedEmail[] = [];

  let quoteCount = 0;
  for (let i = 0; i < validEmails.length; i++) {
    const email = validEmails[i];
    const { quote, tripInfo } = results[i];
    // Skip emails that turned out not to be quotes (no price, PDF, portal link or specific aircraft)
    if (!isQuote(quote)) continue;
    quoteCount++;
    const key = buildTripKey(tripInfo);

    if (!key || !tripInfo.origin || !tripInfo.destination || !tripInfo.date) {
      const missing: string[] = [];
      if (!tripInfo.origin || !tripInfo.destination) missing.push("route");
      if (!tripInfo.date) missing.push("date");
      unmatched.push({
        email,
        reason: `Could not parse ${missing.join(" or ")} from subject, body, or attachments`,
      });
      continue;
    }

    if (!tripMap.has(key)) {
      tripMap.set(key, {
        origin: tripInfo.origin,
        destination: tripInfo.destination,
        date: tripInfo.date,
        quotes: [],
      });
    }

    tripMap.get(key)!.quotes.push(quote);
  }

  const trips: Trip[] = [];
  for (const [, data] of tripMap) {
    const lastUpdated = data.quotes.reduce((latest, q) =>
      q.receivedAt > latest ? q.receivedAt : latest,
      data.quotes[0].receivedAt
    );

    trips.push({
      tripId: generateTripId(data.origin, data.destination, data.date),
      origin: data.origin,
      originName: getAirportName(data.origin),
      destination: data.destination,
      destinationName: getAirportName(data.destination),
      date: data.date,
      quotes: data.quotes.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity)),
      status: "Open",
      lastUpdated,
    });
  }

  trips.sort((a, b) => a.date.localeCompare(b.date));

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`[buildTrips] Done in ${elapsed}s: ${trips.length} trips, ${unmatched.length} unmatched`);

  const stats = { scanned, quotes: quoteCount };
  if (cache.size > 200) cache.clear();
  cache.set(cacheKey, { trips, unmatched, stats, timestamp: Date.now() });

  return { trips, unmatched, stats };
}
