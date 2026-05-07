import "server-only";
import Anthropic from "@anthropic-ai/sdk";
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

// --- Combined single-call parser: extracts quote + trip info in one API call ---

const COMBINED_PROMPT = `You are parsing a charter aviation quote email. Extract ALL quote details AND trip routing in a single response.

Return ONLY a raw JSON object with these fields (use null for anything not found):
{
  "price": number or null (total price as plain number, no $ or commas),
  "aircraft": string or null (full aircraft name, e.g. "Citation CJ3"),
  "tailNumber": string or null (FAA N-number, e.g. "N445AC"),
  "yom": number or null (year of manufacture),
  "maxPax": number or null (maximum passengers),
  "refurbInterior": string or null (interior refurb year),
  "refurbExterior": string or null (exterior refurb year),
  "totalHours": number or null (total flight hours),
  "operator": string or null (company/operator name),
  "isExternalLink": boolean (true if quote directs to external portal/website),
  "externalLink": string or null (the portal URL),
  "origin": string or null (departure airport — ICAO like KTEB, or IATA like TEB, or city name),
  "destination": string or null (arrival airport — same format),
  "date": string or null (trip date in YYYY-MM-DD format, assume 2026 if year missing)
}

Return ONLY the JSON object, no explanation.`;

export interface AiParseResult {
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
  origin: string | null;
  destination: string | null;
  date: string | null;
}

export async function aiParseEmail(
  emailBody: string,
  subject: string,
  fromName: string,
  attachmentFilenames: string[],
  pdfText: string | null
): Promise<AiParseResult | null> {
  const client = getClient();
  if (!client) return null;

  const content = [
    `Subject: ${subject}`,
    `From: ${fromName}`,
    attachmentFilenames.length ? `Attachments: ${attachmentFilenames.join(", ")}` : "",
    `\nEmail body:\n${emailBody.slice(0, 3000)}`,
    pdfText ? `\nPDF attachment text:\n${pdfText.slice(0, 3000)}` : "",
  ].filter(Boolean).join("\n");

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      messages: [{ role: "user", content: `${COMBINED_PROMPT}\n\n${content}` }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const parsed = JSON.parse(extractJSON(text));

    // Resolve airports to ICAO
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
      origin,
      destination,
      date: parsed.date ?? null,
    };
  } catch (err) {
    console.error("[aiParseEmail] Claude parsing failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

export function isAiEnabled(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}
