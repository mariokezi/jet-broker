import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { resolveToICAO } from "./airport-lookup";
import { categoryList } from "./qualify";
import type { AircraftCategory, InquiryFields } from "./types";

const MODEL = "claude-opus-5";

function getClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  return new Anthropic({ timeout: 25_000, maxRetries: 1 });
}

export function isBrokerAiEnabled(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

function textOf(response: Anthropic.Message): string | null {
  if (response.stop_reason === "refusal") return null;
  for (const block of response.content) {
    if (block.type === "text") return block.text;
  }
  return null;
}

const nullable = (type: string) => ({ type: [type, "null"] });

const INQUIRY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "clientName", "clientEmail", "clientPhone", "company", "origin", "destination",
    "date", "departureTime", "returnDate", "pax", "category", "budget", "pets", "notes",
  ],
  properties: {
    clientName: nullable("string"),
    clientEmail: nullable("string"),
    clientPhone: nullable("string"),
    company: nullable("string"),
    origin: nullable("string"),
    destination: nullable("string"),
    date: nullable("string"),
    departureTime: nullable("string"),
    returnDate: nullable("string"),
    pax: nullable("integer"),
    category: { anyOf: [{ type: "string", enum: categoryList() }, { type: "null" }] },
    budget: nullable("number"),
    pets: { type: "boolean" },
    notes: nullable("string"),
  },
};

const INQUIRY_PROMPT = `You read private jet charter requests (emails, web forms, call notes) for a charter broker and extract the trip.

Rules:
- origin / destination: the airport ICAO code when you can infer it (e.g. "Teterboro" -> KTEB, "Aspen" -> KASE, "Palm Beach" -> KPBI, "Nassau" -> MYNN). For a city with several airports, choose the main private aviation airport (New York -> KTEB, Los Angeles -> KVNY, Miami -> KOPF, Chicago -> KPWK, Detroit -> KPTK, Dallas -> KDAL, Houston -> KHOU, Denver -> KAPA).
- date / returnDate: YYYY-MM-DD. Resolve relative dates ("next Friday") against today's date given below. returnDate only for a return leg.
- departureTime: as written (e.g. "9am", "morning"), else null.
- category: only if the client states or clearly implies an aircraft size or model.
- budget: total USD the client mentions, as a number, else null.
- notes: one short line of special requests (catering, pets, luggage, skis, golf clubs, wifi), else null.
- Use null for anything not stated. Never invent contact details.`;

export async function aiExtractInquiry(text: string): Promise<Partial<InquiryFields> | null> {
  const client = getClient();
  if (!client) return null;
  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 2000,
      output_config: { effort: "low", format: { type: "json_schema", schema: INQUIRY_SCHEMA } },
      system: INQUIRY_PROMPT,
      messages: [
        {
          role: "user",
          content: `Today is ${new Date().toISOString().slice(0, 10)}.\n\n<request>\n${text.slice(0, 8000)}\n</request>`,
        },
      ],
    });
    const raw = textOf(response);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as InquiryFields;
    const icao = (v: string | null) => (v ? resolveToICAO(v) ?? (/^[A-Z]{4}$/.test(v) ? v : null) : null);
    return {
      ...parsed,
      origin: icao(parsed.origin),
      destination: icao(parsed.destination),
      category: (categoryList() as string[]).includes(parsed.category ?? "") ? (parsed.category as AircraftCategory) : null,
    };
  } catch (err) {
    console.error("[aiExtractInquiry] failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

export type DraftKind = "followup" | "proposal" | "rfq" | "confirmation";

const DRAFT_PROMPTS: Record<DraftKind, string> = {
  followup:
    "Write a short, warm reply from a private jet charter broker to a prospective client whose request is missing details. Ask only for the missing items, in a compact list. Mention you can have options within the hour once you have them.",
  proposal:
    "Write the cover email a private jet charter broker sends a client with a proposal of aircraft options. Two short paragraphs max, then one line per option (aircraft, year, seats, all-in price). Close by explaining options are subject to availability and how to confirm. Do not mention operator names or operator prices.",
  rfq:
    "Write a concise RFQ (request for quote) email a charter broker sends to operators. Include route, date, time, passengers, aircraft category, and special requests as a compact list. Ask for all-in pricing, tail number, year, refurb, and ARGUS/Wyvern status.",
  confirmation:
    "Write a short booking confirmation email from a charter broker to a client: itinerary, aircraft, FBO/departure guidance placeholder, and next steps (contract signature and wire). Friendly and precise.",
};

/** Returns { subject, body } or null when AI is unavailable. Callers keep a template fallback. */
export async function aiDraft(kind: DraftKind, context: Record<string, unknown>): Promise<{ subject: string; body: string } | null> {
  const client = getClient();
  if (!client) return null;
  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 2000,
      output_config: {
        effort: "low",
        format: {
          type: "json_schema",
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["subject", "body"],
            properties: { subject: { type: "string" }, body: { type: "string" } },
          },
        },
      },
      system: `${DRAFT_PROMPTS[kind]}\nPlain text only, no markdown. Sign off with the broker's name and company from the context.`,
      messages: [{ role: "user", content: `Context (JSON):\n${JSON.stringify(context, null, 2)}` }],
    });
    const raw = textOf(response);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { subject: string; body: string };
    return parsed.subject && parsed.body ? parsed : null;
  } catch (err) {
    console.error(`[aiDraft:${kind}] failed:`, err instanceof Error ? err.message : err);
    return null;
  }
}
