import "server-only";
import { fetchQuoteEmails } from "./o365-client";
import { parseSubject, buildTripKey } from "./subject-parser";
import { parseQuoteFromText, parseQuoteFromPDF } from "./quote-parser";
import { getAirportName } from "./airport-lookup";
import type { Trip, ParsedQuote, RawEmail, UnmatchedEmail } from "./types";

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

async function processEmail(email: RawEmail): Promise<ParsedQuote> {
  // Check for PDF attachments and extract text
  for (const attachment of email.attachments) {
    if (
      attachment.contentType === "application/pdf" ||
      attachment.filename?.toLowerCase().endsWith(".pdf")
    ) {
      // Attachment URL is a data URI with base64 content from Graph API
      const base64Match = attachment.url.match(/^data:[^;]+;base64,(.+)$/);
      if (base64Match) {
        const pdfText = await extractPdfText(base64Match[1]);
        if (pdfText && pdfText.trim().length > 10) {
          console.log(`[processEmail] Extracted ${pdfText.length} chars from PDF: ${attachment.filename}`);
          // Combine email body text with PDF text for parsing
          const combined = parseQuoteFromPDF(email, pdfText);
          return combined;
        }
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

    const quote = await processEmail(email);

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
