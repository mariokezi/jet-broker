// Turns raw emails into operator quotes grouped by trip. Pure functions only (no server or
// network access) so the same rules run in the live pipeline and in tests.

import { resolveToICAO } from "./airport-lookup";
import { extractRoute } from "./qualify";
import {
  extractExternalLink,
  extractMaxPax,
  extractOperator,
  extractRefurb,
  extractTailNumber,
} from "./quote-parser";
import type { ParsedSubject } from "./subject-parser";
import type { ParsedQuote, RawEmail } from "./types";

// ---------- Text ----------

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h[1-6]|table)>/gi, "\n")
    .replace(/<\/t[dh]>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&(\w+);/g, (m, name) => ENTITIES[name.toLowerCase()] ?? m)
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n");
}

export function emailText(email: Pick<RawEmail, "body" | "bodyType">): string {
  return email.bodyType === "html" ? htmlToText(email.body) : email.body;
}

const HEADER_LINE = /^\s*(from|sent|date|to|cc|subject)\s*:/i;

/**
 * Drops the header blocks of forwarded and replied messages (From, Sent, To, Subject lines) so
 * their send dates don't count as trip dates. A lone "Date:" line in a quote is kept.
 */
function withoutForwardHeaders(text: string): string {
  const lines = text.split("\n");
  const keep = lines.map((l) => !/forwarded message|original message|^_{8,}/i.test(l));
  for (let i = 0; i < lines.length; ) {
    let j = i;
    while (j < lines.length && HEADER_LINE.test(lines[j])) j++;
    const block = lines.slice(i, j);
    if (block.length >= 2 && block.some((l) => /^\s*from\s*:/i.test(l))) for (let k = i; k < j; k++) keep[k] = false;
    i = j > i ? j : i + 1;
  }
  return lines.filter((_, i) => keep[i]).join("\n");
}

// ---------- Classification ----------

const SYSTEM_SENDERS = ["microsoft.com", "microsoftonline.com", "office365.com", "outlook.com"];
const MARKETING = /\bunsubscribe\b|manage (your )?(email )?preferences|view (this email )?in (your )?browser|you('re| are) receiving this|you received this because/i;
const RECEIPT = /\bconfirmation (number|code|#)|record locator|boarding pass|\be-?ticket\b|\bseat \d{1,2}[a-k]\b|\border #|\breceipt\b|\binvoice\b|amount due|payment terms|thanks for riding|has shipped/i;
const QUOTE_WORDS = /\b(quote[ds]?|quotation|proposal|rfq|charter|price[ds]?|pricing|all[- ]in|empty leg|one[- ]way|round[- ]trip|positioning|ferry|tail)\b/i;

export type EmailKind = "system" | "self" | "marketing" | "receipt" | "candidate";

export function classifyEmail(email: Pick<RawEmail, "from" | "subject">, text: string, selfAddress?: string | null): EmailKind {
  const from = email.from.toLowerCase();
  if (SYSTEM_SENDERS.some((d) => from.endsWith(`@${d}`) || from.endsWith(`.${d}`))) return "system";
  if (selfAddress && from === selfAddress.toLowerCase()) return "self";
  const all = `${email.subject}\n${text}`;
  if (MARKETING.test(all)) return "marketing";
  if (RECEIPT.test(all) && !/\b(quote|quotation|proposal|rfq)\b/i.test(all)) return "receipt";
  return "candidate";
}

/**
 * Cheap check before downloading attachments or calling the AI: does this look like it could
 * be an operator quote at all?
 */
export function mightBeQuote(email: Pick<RawEmail, "from" | "subject">, text: string, selfAddress?: string | null): boolean {
  if (classifyEmail(email, text, selfAddress) !== "candidate") return false;
  const all = `${email.subject}\n${text}`;
  return QUOTE_WORDS.test(all) || extractAircraftName(all) !== null || extractTotalPrice(all) !== null;
}

// ---------- Fields ----------

const AIRCRAFT_PATTERNS: RegExp[] = [
  /\bCitation\s+(?:XLS\+|XLS|Excel|Sovereign\+?|Latitude|Longitude|Ultra|Encore\+?|Bravo|Mustang|CJ[1-4]\+?|M2|VII|X\+?)(?![A-Za-z0-9])/i,
  /\bChallenger\s+\d{3}\b/i,
  /\bGulfstream\s+(?:G\d{3,4}|G-?IV(?:-?SP)?|GIV-?SP|G-?V)\b/i,
  /\bG(?:150|200|280|450|500|550|600|650(?:ER)?|700)\b/,
  /\bGlobal\s+(?:\d{4,5}|Express(?:\s+XRS)?)\b/i,
  /\bFalcon\s+\d{1,4}(?:[A-Z]{1,3})?\b/i,
  /\bLearjet\s+\d{2}(?:XR)?\b/i,
  /\bHawker\s+\d{3,4}(?:XPi|XP)?\b/i,
  /\bPhenom\s+\d{3}E?\b/i,
  /\bPraetor\s+\d{3}\b/i,
  /\bLegacy\s+\d{3}\b/i,
  /\bKing\s+Air\s+\d{3}i?\b/i,
  /\b(?:Pilatus\s+)?PC-?12(?:\/\d+E?|\s*NGX)?\b/i,
  /\bHondaJet(?:\s+Elite)?\b/i,
  /\bNextant\s+400XTi?\b/i,
  /\bBeechjet\s+400A?\b/i,
];

export function extractAircraftName(text: string): string | null {
  let best: { index: number; name: string } | null = null;
  for (const re of AIRCRAFT_PATTERNS) {
    const m = re.exec(text);
    if (m && (!best || m.index < best.index)) best = { index: m.index, name: m[0].replace(/\s+/g, " ").trim() };
  }
  return best?.name ?? null;
}

const MONEY = /(?:\$|\bUSD\s?)\s?(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?\s*([kK])?\b|\b(\d{1,3}(?:,\d{3})+|\d{4,})(?:\.(\d{1,2}))?\s*(?:USD|dollars)\b/g;
const TOTAL_LABEL = /\b(grand total|total|all[- ]?in|total quote|total price)\b/i;
const PRICE_LABEL = /\b(price|priced|quoted?|charter|rate|cost|offer)\b/i;
const FEE_LABEL = /\b(fet|tax(es)?|fees?|segment|deposit|per hour|hourly|\/\s?hr|per seat)\b/i;

/** The quote's total in dollars: prefers totals and all-in prices over fees and line items. */
export function extractTotalPrice(text: string): number | null {
  const found: { amount: number; total: boolean; price: boolean; fee: boolean; order: number }[] = [];
  let order = 0;
  for (const line of text.split("\n")) {
    const total = TOTAL_LABEL.test(line);
    const price = PRICE_LABEL.test(line);
    const fee = FEE_LABEL.test(line) && !total && !price;
    for (const m of line.matchAll(MONEY)) {
      const whole = (m[1] ?? m[4]).replace(/,/g, "");
      const cents = m[2] ?? m[5];
      let amount = parseFloat(cents ? `${whole}.${cents}` : whole);
      if (m[3]) amount *= 1000;
      if (amount >= 1000 && amount <= 2_000_000) found.push({ amount, total, price, fee, order: order++ });
    }
  }
  if (found.length === 0) return null;
  const totals = found.filter((f) => f.total);
  if (totals.length) return totals[totals.length - 1].amount;
  const priced = found.filter((f) => f.price && !f.fee);
  if (priced.length) return priced[0].amount;
  const rest = found.filter((f) => !f.fee);
  return rest.length ? Math.max(...rest.map((f) => f.amount)) : null;
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};
const MONTH_RE = "(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";

const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/** Every calendar date in the text, in order. Dates without a year take the next one on or after `base`. */
function datesIn(text: string, base: Date): { pos: number; date: string }[] {
  const out: { pos: number; date: string }[] = [];
  const baseIso = base.toISOString().slice(0, 10);
  const withYear = (m: number, d: number, y?: number) => {
    if (m < 1 || m > 12 || d < 1 || d > 31) return null;
    if (y) return iso(y < 100 ? 2000 + y : y, m, d);
    const guess = iso(base.getUTCFullYear(), m, d);
    return guess >= baseIso ? guess : iso(base.getUTCFullYear() + 1, m, d);
  };
  const add = (pos: number, date: string | null) => date && out.push({ pos, date });
  for (const m of text.matchAll(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/g)) add(m.index!, withYear(+m[2], +m[3], +m[1]));
  for (const m of text.matchAll(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/g)) add(m.index!, withYear(+m[1], +m[2], m[3] ? +m[3] : undefined));
  for (const m of text.matchAll(new RegExp(`\\b${MONTH_RE}\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b(?:,?\\s+(\\d{4}))?`, "gi")))
    add(m.index!, withYear(MONTHS[m[1].slice(0, 3).toLowerCase()], +m[2], m[3] ? +m[3] : undefined));
  for (const m of text.matchAll(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+${MONTH_RE}\\b(?:,?\\s+(\\d{4}))?`, "gi")))
    add(m.index!, withYear(MONTHS[m[2].slice(0, 3).toLowerCase()], +m[1], m[3] ? +m[3] : undefined));
  return out.sort((a, b) => a.pos - b.pos);
}

/** The trip date: the first date in the text that is not before the day the email arrived. */
export function extractTripDate(text: string, receivedAt: string): string | null {
  const received = new Date(receivedAt);
  const floor = new Date(received.getTime() - 86_400_000).toISOString().slice(0, 10);
  return datesIn(text, received).find((d) => d.date >= floor)?.date ?? null;
}

function routeFromFilename(filename: string): { origin: string | null; destination: string | null } {
  const m = filename.toUpperCase().match(/([A-Z]{3,4})\s*[-_>\s]\s*([A-Z]{3,4})/);
  const origin = m ? resolveToICAO(m[1]) : null;
  const destination = m ? resolveToICAO(m[2]) : null;
  return origin && destination && origin !== destination ? { origin, destination } : { origin: null, destination: null };
}

/** Route and date, looking at the subject first, then any PDF, the attachment names, and the body. */
export function extractTrip(email: Pick<RawEmail, "subject" | "receivedAt" | "attachments">, bodyText: string, pdfText: string | null): ParsedSubject {
  const body = withoutForwardHeaders(bodyText);
  const sources = [email.subject, pdfText ?? "", body];
  let origin: string | null = null;
  let destination: string | null = null;
  for (const src of [email.subject, pdfText ?? ""]) {
    const r = extractRoute(src);
    if (r.origin && r.destination) {
      ({ origin, destination } = r);
      break;
    }
  }
  if (!origin || !destination) {
    for (const a of email.attachments) {
      const r = routeFromFilename(a.filename);
      if (r.origin) {
        ({ origin, destination } = r);
        break;
      }
    }
  }
  if (!origin || !destination) {
    const r = extractRoute(body);
    if (r.origin && r.destination) ({ origin, destination } = r);
  }
  let date: string | null = null;
  for (const src of sources) {
    date = extractTripDate(src, email.receivedAt);
    if (date) break;
  }
  return { origin, destination, date };
}

/**
 * Aircraft year of manufacture: a labeled year, or a year written right after the aircraft
 * name ("Citation XLS+ (2012)", "G450, 2014"). Years inside dates or refurb notes don't count.
 */
export function extractAircraftYear(text: string, aircraft: string | null): number | null {
  const thisYear = new Date().getFullYear();
  const ok = (y: number) => y >= 1965 && y <= thisYear + 1;
  const labeled = text.match(/\b(?:YOM|year of (?:manufacture|mfg)|year built|built|manufactured|model year|year)\s*[:#-]?\s*(\d{4})\b/i);
  if (labeled && ok(+labeled[1])) return +labeled[1];
  if (aircraft) {
    const at = text.toLowerCase().indexOf(aircraft.toLowerCase());
    if (at >= 0) {
      const after = text.slice(at + aircraft.length, at + aircraft.length + 25);
      const m = after.match(/^\s*(?:[,(\-–]\s*)?(?:built\s+|from\s+)?(\d{4})\b/i);
      if (m && ok(+m[1])) return +m[1];
    }
  }
  return null;
}

/** Interior and exterior refurb years in the formats operators use. */
export function extractRefurbYears(text: string): { interior: string | null; exterior: string | null } {
  const both = extractRefurb(text);
  if (both.interior || both.exterior) return both;
  const interior = text.match(/\binterior\s+(?:refurb(?:ished)?|redone|updated|new)\s*(?:in\s*)?(\d{4})\b/i)?.[1] ?? text.match(/\b(?:refurb(?:ished)?|new interior)\s*(?:in\s*)?(\d{4})\b/i)?.[1] ?? null;
  const exterior = text.match(/\b(?:exterior|paint(?:ed)?)\s+(?:refurb(?:ished)?|redone|updated|new)?\s*(?:in\s*)?(\d{4})\b/i)?.[1] ?? null;
  return { interior, exterior };
}

/** Total airframe hours ("Total time: 3,450 hrs", "TTAF 5,120"). Trip flight time is not airframe time. */
export function extractAirframeHours(text: string): number | null {
  const m = text.match(/\b(?:total\s+(?:time|hours|hrs)|airframe\s+(?:hours|hrs|time)|TTAF|TTSN)\s*[:\s]\s*([\d,]{2,7})\b/i);
  if (!m) return null;
  const n = parseInt(m[1].replace(/,/g, ""), 10);
  return n >= 50 ? n : null;
}

// ---------- Quote ----------

export interface ParsedEmail {
  quote: ParsedQuote;
  trip: ParsedSubject;
}

export function parseQuoteEmail(email: RawEmail, pdfText: string | null): ParsedEmail {
  const bodyText = emailText(email);
  const text = pdfText ? `${pdfText}\n${bodyText}` : bodyText;
  const price = extractTotalPrice(text);
  const aircraft = extractAircraftName(text);
  // HTML bodies keep links in href attributes, which the plain text version drops
  const externalLink = extractExternalLink(bodyText) ?? extractExternalLink(email.body);
  const refurb = extractRefurbYears(text);
  const fromName = email.fromName.replace(/\s+via\s+.+$/i, "");
  return {
    quote: {
      emailId: email.id,
      price,
      priceFormatted: price !== null ? (Number.isInteger(price) ? `$${price.toLocaleString("en-US")}` : `$${price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`) : null,
      aircraft,
      yom: extractAircraftYear(text, aircraft),
      maxPax: extractMaxPax(text),
      tailNumber: extractTailNumber(text),
      refurbInterior: refurb.interior,
      refurbExterior: refurb.exterior,
      totalHours: extractAirframeHours(text),
      operator: extractOperator(bodyText, fromName),
      quoteSource: pdfText ? "pdf" : externalLink && price === null && !aircraft ? "external" : "inline",
      externalLink,
      status: "Unanswered",
      receivedAt: email.receivedAt,
      subject: email.subject,
      from: email.from,
      fromName: email.fromName,
      bodyType: email.bodyType,
      body: email.body,
      attachments: email.attachments,
    },
    trip: extractTrip(email, bodyText, pdfText),
  };
}

/**
 * A real quote names a price, sends a PDF quote, or links to a quote portal. An aircraft name
 * alone is not enough (clients name the jet they want); it also needs a tail number or year
 * that shows a specific aircraft is being offered.
 */
export function isQuote(q: Pick<ParsedQuote, "price" | "aircraft" | "quoteSource" | "externalLink" | "tailNumber" | "yom">): boolean {
  if (q.price !== null || q.quoteSource === "pdf") return true;
  if (q.quoteSource === "external" && !!q.externalLink) return true;
  return q.aircraft !== null && (q.tailNumber !== null || q.yom !== null);
}
