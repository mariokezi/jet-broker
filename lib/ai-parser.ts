import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { RawEmail, ParsedQuote } from "./types";
import { resolveToICAO } from "./airport-lookup";

function getClient(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  return new Anthropic({ apiKey });
}

function extractJSON(text: string): string {
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) return codeBlockMatch[1].trim();
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) return jsonMatch[0];
  return text;
}

// --- Quote extraction from email body / PDF text ---

const QUOTE_EXTRACTION_PROMPT = `You are parsing a charter aviation quote email from an operator. Extract every detail you can find.

Return ONLY a raw JSON object with these fields (use null for anything not found):
{
  "price": number or null (total price as a plain number, no $ or commas),
  "currency": "USD" or other currency code,
  "aircraft": string or null (full aircraft name, e.g. "Citation CJ3", "Gulfstream G280"),
  "tailNumber": string or null (FAA N-number, e.g. "N445AC"),
  "yom": number or null (year of manufacture, 4-digit year),
  "maxPax": number or null (maximum passengers),
  "refurbInterior": string or null (interior refurb year, e.g. "2022"),
  "refurbExterior": string or null (exterior refurb year, e.g. "2023"),
  "totalHours": number or null (total flight hours as a number),
  "operator": string or null (the company/operator name),
  "hasQuote": boolean (true if this email actually contains a charter quote),
  "isExternalLink": boolean (true if the quote says to view it on an external portal/website),
  "externalLink": string or null (the URL if it's a portal link),
  "notes": string or null (any important conditions, fees, or terms)
}

Return ONLY the JSON object, no explanation.`;

export async function aiParseQuote(
  emailBody: string,
  subject: string,
  fromName: string,
  pdfText: string | null
): Promise<{
  price: number | null;
  aircraft: string | null;
  tailNumber: string | null;
  yom: number | null;
  maxPax: number | null;
  refurbInterior: string | null;
  refurbExterior: string | null;
  totalHours: number | null;
  operator: string | null;
  isExternalLink: boolean;
  externalLink: string | null;
} | null> {
  const client = getClient();
  if (!client) return null;

  const content = [
    `Subject: ${subject}`,
    `From: ${fromName}`,
    `\nEmail body:\n${emailBody.slice(0, 3000)}`,
    pdfText ? `\nPDF attachment text:\n${pdfText.slice(0, 3000)}` : "",
  ].join("\n");

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      messages: [{ role: "user", content: `${QUOTE_EXTRACTION_PROMPT}\n\n${content}` }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const parsed = JSON.parse(extractJSON(text));

    return {
      price: typeof parsed.price === "number" ? parsed.price : null,
      aircraft: parsed.aircraft ?? null,
      tailNumber: parsed.tailNumber ?? null,
      yom: typeof parsed.yom === "number" ? parsed.yom : null,
      maxPax: typeof parsed.maxPax === "number" ? parsed.maxPax : null,
      refurbInterior: parsed.refurbInterior ?? null,
      refurbExterior: parsed.refurbExterior ?? null,
      totalHours: typeof parsed.totalHours === "number" ? parsed.totalHours : null,
      operator: parsed.operator ?? null,
      isExternalLink: !!parsed.isExternalLink,
      externalLink: parsed.externalLink ?? null,
    };
  } catch (err) {
    console.error("[aiParseQuote] Claude parsing failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

// --- Trip info extraction (route + date) ---

const TRIP_EXTRACTION_PROMPT = `You are parsing aviation charter emails to extract trip routing and date information.

Given an email subject, body, attachment filenames, and optional PDF text, extract the trip details.

For airports: return ICAO codes (4 letters starting with K for US, e.g. KTEB, KMIA) or IATA codes (3 letters, e.g. TEB, MIA) or city names.
For dates: return in YYYY-MM-DD format. If the year is missing, assume 2026.

Return ONLY a raw JSON object:
{
  "origin": string or null (departure airport code or city),
  "destination": string or null (arrival airport code or city),
  "date": string or null (trip date in YYYY-MM-DD format),
  "isQuoteEmail": boolean (true if this looks like a charter quote response from an operator)
}

Return ONLY the JSON object, no explanation.`;

export async function aiParseTripInfo(
  subject: string,
  body: string,
  attachmentFilenames: string[],
  pdfText: string | null
): Promise<{
  origin: string | null;
  destination: string | null;
  date: string | null;
  isQuoteEmail: boolean;
} | null> {
  const client = getClient();
  if (!client) return null;

  const content = [
    `Subject: ${subject}`,
    `Attachment filenames: ${attachmentFilenames.join(", ") || "none"}`,
    `\nEmail body (first 2000 chars):\n${body.slice(0, 2000)}`,
    pdfText ? `\nPDF text (first 2000 chars):\n${pdfText.slice(0, 2000)}` : "",
  ].join("\n");

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 256,
      messages: [{ role: "user", content: `${TRIP_EXTRACTION_PROMPT}\n\n${content}` }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const parsed = JSON.parse(extractJSON(text));

    // Resolve to ICAO codes
    let origin: string | null = null;
    let destination: string | null = null;

    if (parsed.origin) {
      origin = resolveToICAO(parsed.origin);
      if (!origin && parsed.origin.length === 4 && parsed.origin.startsWith("K")) {
        origin = parsed.origin.toUpperCase();
      }
    }
    if (parsed.destination) {
      destination = resolveToICAO(parsed.destination);
      if (!destination && parsed.destination.length === 4 && parsed.destination.startsWith("K")) {
        destination = parsed.destination.toUpperCase();
      }
    }

    return {
      origin,
      destination,
      date: parsed.date ?? null,
      isQuoteEmail: !!parsed.isQuoteEmail,
    };
  } catch (err) {
    console.error("[aiParseTripInfo] Claude parsing failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

export function isAiEnabled(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}
