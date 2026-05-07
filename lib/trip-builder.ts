import "server-only";
import { fetchQuoteEmails } from "./o365-client";
import { parseSubject, buildTripKey, type ParsedSubject } from "./subject-parser";
import { parseQuoteFromText, parseQuoteFromPDF } from "./quote-parser";
import { aiParseQuote, aiParseTripInfo, isAiEnabled } from "./ai-parser";
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
 * Generate a stable trip ID from the route key (origin|destination|date).
 * This ensures the same trip always gets the same ID across page loads.
 */
function generateTripId(origin: string, destination: string, date: string): string {
  // Create a short hash from the route key
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

// --- Trip info extraction: AI first, regex fallback ---

async function extractTripInfo(
  email: RawEmail,
  pdfText: string | null
): Promise<ParsedSubject> {
  // Try AI parser first
  if (isAiEnabled()) {
    const bodyText = email.bodyType === "html" ? stripHtml(email.body) : email.body;
    const filenames = email.attachments.map((a) => a.filename);

    const aiResult = await aiParseTripInfo(email.subject, bodyText, filenames, pdfText);
    if (aiResult && aiResult.origin && aiResult.destination && aiResult.date) {
      console.log(`[extractTripInfo] AI parsed: ${aiResult.origin} -> ${aiResult.destination} on ${aiResult.date}`);
      return { origin: aiResult.origin, destination: aiResult.destination, date: aiResult.date };
    }
    if (aiResult) {
      console.log(`[extractTripInfo] AI partial result, supplementing with regex`);
    }
  }

  // Regex fallback: subject -> filename -> PDF text -> body
  const fromSubject = parseSubject(email.subject);
  if (fromSubject.origin && fromSubject.destination && fromSubject.date) {
    return fromSubject;
  }

  let origin = fromSubject.origin;
  let destination = fromSubject.destination;
  let date = fromSubject.date;

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

// --- Quote extraction: AI first, regex fallback ---

async function processEmail(email: RawEmail): Promise<{ quote: ParsedQuote; pdfText: string | null }> {
  console.log(`[processEmail] "${email.subject}" from ${email.fromName} — ${email.attachments.length} attachment(s), bodyType=${email.bodyType}, bodyLen=${email.body.length}`);
  // Log first 200 chars of body for debugging
  const bodyPreview = (email.bodyType === "html" ? stripHtml(email.body) : email.body).slice(0, 200);
  console.log(`[processEmail] body preview: ${bodyPreview}`);

  // Extract PDF text if present
  let pdfText: string | null = null;
  for (const attachment of email.attachments) {
    const isPdf = attachment.contentType === "application/pdf" ||
      attachment.filename?.toLowerCase().endsWith(".pdf");
    if (!isPdf) continue;

    const base64Match = attachment.url.match(/^data:[^;]+;base64,(.+)$/);
    if (!base64Match) {
      console.error(`[processEmail] Could not extract base64 for "${attachment.filename}"`);
      continue;
    }

    pdfText = await extractPdfText(base64Match[1]);
    if (pdfText && pdfText.trim().length > 10) {
      console.log(`[processEmail] PDF text: ${pdfText.length} chars from "${attachment.filename}"`);
    } else {
      console.error(`[processEmail] PDF extraction empty for "${attachment.filename}"`);
      pdfText = null;
    }
    break;
  }

  // Try AI parsing first
  if (isAiEnabled()) {
    const bodyText = email.bodyType === "html" ? stripHtml(email.body) : email.body;
    const aiResult = await aiParseQuote(bodyText, email.subject, email.fromName, pdfText);

    if (aiResult) {
      console.log(`[processEmail] AI extracted: price=${aiResult.price}, aircraft=${aiResult.aircraft}, tail=${aiResult.tailNumber}`);

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
      return { quote, pdfText };
    }
  }

  // Regex fallback
  if (pdfText) {
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
  console.log(`[buildTrips] Processing ${emails.length} emails (AI: ${isAiEnabled() ? "ON" : "OFF"})`);

  const tripMap = new Map<string, { origin: string; destination: string; date: string; quotes: ParsedQuote[] }>();
  const unmatched: UnmatchedEmail[] = [];

  for (const email of emails) {
    if (isSystemEmail(email)) continue;

    const { quote, pdfText } = await processEmail(email);
    const tripInfo = await extractTripInfo(email, pdfText);
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

  console.log(`[buildTrips] Result: ${trips.length} trips, ${unmatched.length} unmatched`);
  return { trips, unmatched };
}
