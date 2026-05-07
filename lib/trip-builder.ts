import "server-only";
import { fetchQuoteEmails } from "./o365-client";
import { parseSubject, buildTripKey, type ParsedSubject } from "./subject-parser";
import { parseQuoteFromText, parseQuoteFromPDF } from "./quote-parser";
import { getAirportName } from "./airport-lookup";
import { resolveToICAO } from "./airport-lookup";
import type { Trip, ParsedQuote, RawEmail, UnmatchedEmail } from "./types";

// System/notification senders to ignore
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

let tripCounter = 0;

function generateTripId(): string {
  tripCounter++;
  return `BCF${String(tripCounter).padStart(3, "0")}`;
}

async function extractPdfText(base64Data: string): Promise<string | null> {
  try {
    const { PDFParse } = await import("pdf-parse");
    const data = new Uint8Array(Buffer.from(base64Data, "base64"));
    const parser = new PDFParse({ data });
    const result = await parser.getText();
    await parser.destroy();
    return result.text;
  } catch (err) {
    console.error("[extractPdfText] Failed to parse PDF:", err);
    return null;
  }
}

// Try to extract route from attachment filenames like "Charter_Quote_KHPN-KMIA.pdf"
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

// Try multiple sources to build a complete ParsedSubject
function extractTripInfo(
  email: RawEmail,
  pdfText: string | null
): ParsedSubject {
  // 1. Try subject line first
  const fromSubject = parseSubject(email.subject);
  if (fromSubject.origin && fromSubject.destination && fromSubject.date) {
    return fromSubject;
  }

  let origin = fromSubject.origin;
  let destination = fromSubject.destination;
  let date = fromSubject.date;

  // 2. Try attachment filenames for route
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

  // 3. Try PDF text for route and date
  if (pdfText) {
    const fromPdf = parseSubject(pdfText);
    if (!origin || !destination) {
      if (fromPdf.origin && fromPdf.destination) {
        origin = fromPdf.origin;
        destination = fromPdf.destination;
      }
    }
    if (!date && fromPdf.date) {
      date = fromPdf.date;
    }
  }

  // 4. Try email body text for route and date
  if (!origin || !destination || !date) {
    const bodyText = email.bodyType === "html"
      ? email.body.replace(/<[^>]+>/g, " ")
      : email.body;
    const fromBody = parseSubject(bodyText);
    if (!origin || !destination) {
      if (fromBody.origin && fromBody.destination) {
        origin = fromBody.origin;
        destination = fromBody.destination;
      }
    }
    if (!date && fromBody.date) {
      date = fromBody.date;
    }
  }

  return { origin, destination, date };
}

async function processEmail(email: RawEmail): Promise<{ quote: ParsedQuote; pdfText: string | null }> {
  console.log(`[processEmail] "${email.subject}" — ${email.attachments.length} attachment(s)`);

  for (const attachment of email.attachments) {
    const isPdf = attachment.contentType === "application/pdf" ||
      attachment.filename?.toLowerCase().endsWith(".pdf");

    if (!isPdf) continue;

    console.log(`[processEmail] Found PDF: "${attachment.filename}" (${attachment.url.length} chars in data URI)`);

    const base64Match = attachment.url.match(/^data:[^;]+;base64,(.+)$/);
    if (!base64Match) {
      console.error(`[processEmail] Could not extract base64 from data URI for "${attachment.filename}"`);
      continue;
    }

    const pdfText = await extractPdfText(base64Match[1]);
    if (!pdfText || pdfText.trim().length <= 10) {
      console.error(`[processEmail] PDF text extraction returned empty for "${attachment.filename}"`);
      continue;
    }

    console.log(`[processEmail] Extracted ${pdfText.length} chars from PDF "${attachment.filename}": ${pdfText.slice(0, 150)}...`);
    const quote = parseQuoteFromPDF(email, pdfText);
    return { quote, pdfText };
  }

  return { quote: parseQuoteFromText(email), pdfText: null };
}

export async function buildTrips(): Promise<{
  trips: Trip[];
  unmatched: UnmatchedEmail[];
}> {
  const emails = await fetchQuoteEmails();
  console.log(`[buildTrips] Processing ${emails.length} emails`);

  const tripMap = new Map<string, { origin: string; destination: string; date: string; quotes: ParsedQuote[] }>();
  const unmatched: UnmatchedEmail[] = [];

  tripCounter = 0;

  for (const email of emails) {
    // Skip system/notification emails
    if (isSystemEmail(email)) continue;

    // Process email (extract PDF text if applicable)
    const { quote, pdfText } = await processEmail(email);

    // Extract trip info from all available sources
    const tripInfo = extractTripInfo(email, pdfText);
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
      tripId: generateTripId(),
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

  console.log(`[buildTrips] Result: ${trips.length} trips, ${unmatched.length} unmatched`);
  return { trips, unmatched };
}
