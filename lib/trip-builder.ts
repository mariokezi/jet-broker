import "server-only";
import { fetchQuoteEmails } from "./o365-client";
import { parseSubject, buildTripKey, type ParsedSubject } from "./subject-parser";
import { parseQuoteFromText, parseQuoteFromPDF } from "./quote-parser";
import { aiParseEmail, isAiEnabled, type AiParseResult } from "./ai-parser";
import { getAirportName, resolveToICAO } from "./airport-lookup";
import type { Trip, ParsedQuote, RawEmail, UnmatchedEmail } from "./types";

const IGNORED_SENDERS = [
  "microsoft.com",
  "microsoftonline.com",
  "accountprotection.microsoft.com",
  "notificationemails.microsoft.com",
];

function isSystemEmail(email: RawEmail): boolean {
  const from = email.from.toLowerCase();
  return IGNORED_SENDERS.some((domain) => from.endsWith(domain));
}

/**
 * Generate a stable trip ID from the route key.
 * Same trip always gets the same ID across page loads.
 */
function generateTripId(origin: string, destination: string, date: string): string {
  const key = `${origin}|${destination}|${date}`;
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = ((hash << 5) - hash + key.charCodeAt(i)) | 0;
  }
  const code = Math.abs(hash).toString(36).toUpperCase().slice(0, 4).padStart(4, "0");
  return `BCF-${code}`;
}

async function extractPdfText(base64Data: string): Promise<string | null> {
  const { extractTextFromPdf } = await import("./pdf-extract");
  return extractTextFromPdf(base64Data);
}

function parseRouteFromFilename(filename: string): { origin: string | null; destination: string | null } {
  const upper = filename.toUpperCase();
  const match = upper.match(/([A-Z]{3,4})\s*[-_>\s]\s*([A-Z]{3,4})/);
  if (match) {
    const origin = resolveToICAO(match[1]);
    const dest = resolveToICAO(match[2]);
    if (origin && dest) return { origin, destination: dest };
  }
  return { origin: null, destination: null };
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<\/td>/gi, " ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#?\w+;/g, "");
}

// --- Process a single email: AI (single call) → regex fallback ---

interface ProcessedEmail {
  quote: ParsedQuote;
  tripInfo: ParsedSubject;
}

async function processEmail(email: RawEmail): Promise<ProcessedEmail> {
  const bodyText = email.bodyType === "html" ? stripHtml(email.body) : email.body;
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
        const regexInfo = regexTripFallback(email, pdfText);
        origin = origin ?? regexInfo.origin;
        destination = destination ?? regexInfo.destination;
        date = date ?? regexInfo.date;
      }

      return { quote, tripInfo: { origin, destination, date } };
    }
  }

  // Full regex fallback (no AI)
  const quote = pdfText ? parseQuoteFromPDF(email, pdfText) : parseQuoteFromText(email);
  const tripInfo = regexTripFallback(email, pdfText);
  return { quote, tripInfo };
}

function regexTripFallback(email: RawEmail, pdfText: string | null): ParsedSubject {
  const fromSubject = parseSubject(email.subject);
  let { origin, destination, date } = fromSubject;

  if (!origin || !destination) {
    for (const att of email.attachments) {
      const fromFile = parseRouteFromFilename(att.filename);
      if (fromFile.origin && fromFile.destination) {
        origin = fromFile.origin;
        destination = fromFile.destination;
        break;
      }
    }
  }

  if (pdfText) {
    const fromPdf = parseSubject(pdfText);
    if (!origin || !destination) {
      if (fromPdf.origin && fromPdf.destination) {
        origin = fromPdf.origin;
        destination = fromPdf.destination;
      }
    }
    if (!date && fromPdf.date) date = fromPdf.date;
  }

  if (!origin || !destination || !date) {
    const bodyText = email.bodyType === "html" ? email.body.replace(/<[^>]+>/g, " ") : email.body;
    const fromBody = parseSubject(bodyText);
    if (!origin || !destination) {
      if (fromBody.origin && fromBody.destination) {
        origin = fromBody.origin;
        destination = fromBody.destination;
      }
    }
    if (!date && fromBody.date) date = fromBody.date;
  }

  return { origin, destination, date };
}

// --- In-memory cache to avoid re-parsing on every page load ---

interface CachedResult {
  trips: Trip[];
  unmatched: UnmatchedEmail[];
  timestamp: number;
}

let cache: CachedResult | null = null;
const CACHE_TTL_MS = 55_000; // 55 seconds — just under the 60s auto-refresh

export async function buildTrips(): Promise<{
  trips: Trip[];
  unmatched: UnmatchedEmail[];
}> {
  // Return cached result immediately if cache is fresh — skip Outlook fetch entirely
  if (cache && (Date.now() - cache.timestamp) < CACHE_TTL_MS) {
    const age = Math.round((Date.now() - cache.timestamp) / 1000);
    console.log(`[buildTrips] Cache hit (age ${age}s)`);
    return { trips: cache.trips, unmatched: cache.unmatched };
  }

  const emails = await fetchQuoteEmails();

  console.log(`[buildTrips] Processing ${emails.length} emails (AI: ${isAiEnabled() ? "ON" : "OFF"})`);
  const startTime = Date.now();

  // Filter system emails first
  const validEmails = emails.filter((e) => !isSystemEmail(e));

  // Process ALL emails in parallel
  const results = await Promise.all(validEmails.map((email) => processEmail(email)));

  const tripMap = new Map<string, { origin: string; destination: string; date: string; quotes: ParsedQuote[] }>();
  const unmatched: UnmatchedEmail[] = [];

  for (let i = 0; i < validEmails.length; i++) {
    const email = validEmails[i];
    const { quote, tripInfo } = results[i];
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

  // Cache the result
  cache = { trips, unmatched, timestamp: Date.now() };

  return { trips, unmatched };
}
