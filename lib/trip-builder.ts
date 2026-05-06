import { fetchQuoteEmails } from "./o365-client";
import { parseSubject, buildTripKey } from "./subject-parser";
import { parseQuoteFromText, parseQuoteFromPDF } from "./quote-parser";
import { getAirportName, getIATA } from "./airport-lookup";
import { pdfQuoteTexts } from "./seed-data";
import type { Trip, ParsedQuote, RawEmail, UnmatchedEmail } from "./types";

let tripCounter = 0;

function generateTripId(): string {
  tripCounter++;
  return `BCF${String(tripCounter).padStart(3, "0")}`;
}

function processEmail(email: RawEmail): ParsedQuote {
  // Check if this email has PDF attachments with known text
  for (const attachment of email.attachments) {
    if (attachment.contentType === "application/pdf") {
      const pdfText = pdfQuoteTexts[attachment.filename];
      if (pdfText) {
        return parseQuoteFromPDF(email, pdfText);
      }
    }
  }

  return parseQuoteFromText(email);
}

export async function buildTrips(): Promise<{
  trips: Trip[];
  unmatched: UnmatchedEmail[];
}> {
  const emails = await fetchQuoteEmails();
  const tripMap = new Map<string, { origin: string; destination: string; date: string; quotes: ParsedQuote[] }>();
  const unmatched: UnmatchedEmail[] = [];

  tripCounter = 0;

  for (const email of emails) {
    const parsed = parseSubject(email.subject);
    const key = buildTripKey(parsed);

    if (!key || !parsed.origin || !parsed.destination || !parsed.date) {
      unmatched.push({ email, reason: "Could not parse route or date from subject line" });
      continue;
    }

    const quote = processEmail(email);

    if (!tripMap.has(key)) {
      tripMap.set(key, {
        origin: parsed.origin,
        destination: parsed.destination,
        date: parsed.date,
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

  // Sort trips by date
  trips.sort((a, b) => a.date.localeCompare(b.date));

  return { trips, unmatched };
}

export function formatPriceRange(quotes: ParsedQuote[]): string {
  const prices = quotes
    .map((q) => q.price)
    .filter((p): p is number => p !== null)
    .sort((a, b) => a - b);

  if (prices.length === 0) return "N/A";
  if (prices.length === 1) return formatPrice(prices[0]);

  return `${formatPrice(prices[0])} – ${formatPrice(prices[prices.length - 1])}`;
}

function formatPrice(price: number): string {
  if (price >= 1000) {
    const k = Math.round(price / 1000);
    return `$${k}k`;
  }
  return `$${price.toLocaleString()}`;
}

export function getIATACode(icao: string): string {
  return getIATA(icao);
}
