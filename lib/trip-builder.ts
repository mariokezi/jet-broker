import "server-only";
import { fetchQuoteEmails } from "./o365-client";
import { parseSubject, buildTripKey } from "./subject-parser";
import { parseQuoteFromText } from "./quote-parser";
import { getAirportName } from "./airport-lookup";
import type { Trip, ParsedQuote, RawEmail, UnmatchedEmail } from "./types";

let tripCounter = 0;

function generateTripId(): string {
  tripCounter++;
  return `BCF${String(tripCounter).padStart(3, "0")}`;
}

function processEmail(email: RawEmail): ParsedQuote {
  return parseQuoteFromText(email);
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

  trips.sort((a, b) => a.date.localeCompare(b.date));

  console.log(`[buildTrips] Result: ${trips.length} trips, ${unmatched.length} unmatched`);
  return { trips, unmatched };
}
