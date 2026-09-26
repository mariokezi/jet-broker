import { airportAliases, resolveToICAO } from "./airport-lookup";
import { parseDate } from "./subject-parser";
import { CATEGORIES, categoryFromAircraft, estimateTrip } from "./fleet";
import type { AircraftCategory, InquiryFields, Qualification, TripEstimate } from "./types";

const FREE_MAIL = ["gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "icloud.com", "aol.com", "me.com", "live.com"];

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14,
};

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parseRelativeDate(text: string, base: Date): string | null {
  const t = text.toLowerCase();
  if (/\btomorrow\b/.test(t)) {
    const d = new Date(base);
    d.setDate(d.getDate() + 1);
    return isoDate(d);
  }
  if (/\btoday\b|\btonight\b/.test(t)) return isoDate(base);
  const wd = t.match(/\b(next|this|following|on)?\s*(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/);
  if (wd) {
    const target = WEEKDAYS.indexOf(wd[2]);
    const d = new Date(base);
    if (wd[1] === "next") {
      // "next Friday" = Friday of the coming Monday-to-Sunday week
      const toMonday = ((8 - d.getDay()) % 7) || 7;
      d.setDate(d.getDate() + toMonday + ((target + 6) % 7));
    } else {
      d.setDate(d.getDate() + (((target - d.getDay() + 7) % 7) || 7));
    }
    return isoDate(d);
  }
  return null;
}

function findDate(text: string, base: Date): string | null {
  return parseDate(text) ?? parseRelativeDate(text, base);
}

function extractRoute(text: string): { origin: string | null; destination: string | null } {
  // "from X to Y" with airport codes or city names
  const fromTo = text.match(/\bfrom\s+([A-Za-z .'-]{2,40}?)\s+(?:to|into|->|>)\s+([A-Za-z .'-]{2,40}?)(?=[\s,.;!?]|$)/i);
  if (fromTo) {
    const o = resolveAnywhere(fromTo[1]);
    const d = resolveAnywhere(fromTo[2]);
    if (o && d && o !== d) return { origin: o, destination: d };
  }

  // Code pairs: KTEB-KPBI, TEB/PBI, TEB > PBI
  const codes = text.match(/\b([A-Z]{3,4})\s*(?:-|\/|>|to)\s*([A-Z]{3,4})\b/);
  if (codes) {
    const o = resolveToICAO(codes[1]);
    const d = resolveToICAO(codes[2]);
    if (o && d && o !== d) return { origin: o, destination: d };
  }

  // "Teterboro to Aspen", "Detroit (Pontiac) to Naples, FL"
  for (const m of text.matchAll(/\s(?:to|into|->|>)\s/gi)) {
    const idx = m.index ?? 0;
    const left = text.slice(Math.max(0, idx - 40), idx).split(/[\n,.;:!?]/).pop() ?? "";
    const right = text.slice(idx + m[0].length, idx + m[0].length + 40).split(/[\n,.;:!?]/)[0] ?? "";
    const o = resolveTail(left);
    const d = resolveHead(right);
    if (o && d && o !== d) return { origin: o, destination: d };
  }

  // Fall back to the first two distinct airports mentioned, in order
  const found: { pos: number; icao: string }[] = [];
  const lower = ` ${text.toLowerCase()} `;
  for (const { alias, icao } of airportAliases()) {
    if (alias.length < 3) continue;
    const re = new RegExp(`[^a-z]${alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^a-z]`);
    const m = re.exec(lower);
    if (m && !found.some((f) => f.icao === icao || (m.index >= f.pos && m.index < f.pos + 2))) {
      found.push({ pos: m.index, icao });
    }
  }
  for (const m of text.matchAll(/\b([A-Z]{3,4})\b/g)) {
    const icao = resolveToICAO(m[1]);
    if (icao && !found.some((f) => f.icao === icao)) found.push({ pos: m.index ?? 0, icao });
  }
  found.sort((a, b) => a.pos - b.pos);
  if (found.length === 1) {
    // A lone airport after "to" / "into" is the destination
    const before = lower.slice(Math.max(0, found[0].pos - 8), found[0].pos + 1);
    if (/\b(to|into)\s*$/.test(before)) return { origin: null, destination: found[0].icao };
  }
  return { origin: found[0]?.icao ?? null, destination: found[1]?.icao ?? null };
}

function words(fragment: string): string[] {
  return fragment.replace(/[()]/g, " ").split(/[\s,]+/).filter(Boolean);
}

/** Airport named at the end of a phrase ("... family from Teterboro"). */
function resolveTail(fragment: string): string | null {
  const w = words(fragment);
  for (let n = Math.min(3, w.length); n >= 1; n--) {
    for (let start = w.length - n; start >= Math.max(0, w.length - 4); start--) {
      const icao = resolveToICAO(w.slice(start, start + n).join(" "));
      if (icao) return icao;
    }
  }
  return null;
}

/** Airport named at the start of a phrase ("Naples, FL on the 12th"). */
function resolveHead(fragment: string): string | null {
  const w = words(fragment);
  for (let n = Math.min(3, w.length); n >= 1; n--) {
    const icao = resolveToICAO(w.slice(0, n).join(" "));
    if (icao) return icao;
  }
  return null;
}

function resolveAnywhere(fragment: string): string | null {
  const direct = resolveToICAO(fragment.trim());
  if (direct) return direct;
  const lower = ` ${fragment.toLowerCase()} `;
  for (const { alias, icao } of airportAliases()) {
    if (alias.length >= 3 && lower.includes(` ${alias}`)) return icao;
  }
  for (const word of fragment.split(/\s+/)) {
    const icao = resolveToICAO(word.replace(/[^A-Za-z]/g, ""));
    if (icao) return icao;
  }
  return null;
}

function extractCategory(text: string): AircraftCategory | null {
  const t = text.toLowerCase();
  if (/ultra[\s-]?long|g650|g700|global\s?[67]|falcon 7x/.test(t)) return "Ultra Long Range";
  if (/\bheavy\b|large[\s-]cabin|gulfstream|g450|g550|challenger 6/.test(t)) return "Heavy Jet";
  if (/super[\s-]?mid|challenger 3|citation x\b|longitude|praetor/.test(t)) return "Super Midsize Jet";
  if (/\bmid[\s-]?size\b|\bmidsize\b|hawker|citation xls|learjet 60/.test(t)) return "Midsize Jet";
  if (/\blight jet\b|phenom|citation cj|\bcj[1-4]\b|citation m2/.test(t)) return "Light Jet";
  if (/turbo[\s-]?prop|pc-?12|king air/.test(t)) return "Turboprop";
  return categoryFromAircraft(text);
}

/** Rule-based extraction. Used when AI is off, and to fill gaps the AI leaves. */
export function heuristicExtract(text: string, now = new Date()): InquiryFields {
  const email = text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/)?.[0] ?? null;
  const phone = text.match(/(\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}/)?.[0] ?? null;

  let clientName: string | null = null;
  let company: string | null = null;
  const named = text.match(/\b(?:my name is|this is|i am|i'm)\s+([A-Z][a-z]+(?: [A-Z][a-z]+)?)/);
  if (named) clientName = named[1];
  const call = text.match(/\b(?:[Cc]all with|[Ss]poke with|[Cc]all from|[Cc]all notes:?)\s+([A-Z][a-z]+ [A-Z][a-z'-]+)(?:\s+(?:from|at|of)\s+([A-Z][\w&' ]*\w)(?=[.,;\n])|\s*\(([^)]+)\))?/);
  if (!clientName && call) {
    clientName = call[1];
    company = (call[2] ?? call[3])?.trim() ?? null;
  }
  if (!clientName) {
    const sig = text.match(/\n\s*(?:thanks|thank you|best|regards|cheers|sincerely)[^\n]*\n+[ \t]*([A-Z][a-z]+(?: [A-Z][a-z'-]+)*)[ \t]*(?:\n|$)/i);
    if (sig) clientName = sig[1].trim();
  }
  if (!clientName) {
    // A name line sitting just above an email or phone line
    const block = text.match(/(?:^|\n)[ \t]*([A-Z][a-z]+(?: [A-Z][a-z'-]+)?)[ \t]*\n(?:[^\n@]*\n)?[^\n]*(?:@|\d{3}[\s.-]\d{3}[\s.-]\d{4})/);
    if (block) clientName = block[1];
  }
  if (!clientName) {
    const dash = text.match(/(?:^|\n)\s*[-\u2013\u2014~]\s*([A-Z][a-z]+(?: [A-Z][a-z'-]+)?)\s*(?:\n|$)/);
    if (dash) clientName = dash[1];
  }
  if (clientName && !company) {
    const afterName = text.split(clientName)[1]?.split("\n").map((l) => l.trim()).filter(Boolean)[0];
    if (afterName && afterName.length < 50 && !afterName.includes("@") && !/\d{3}/.test(afterName)) {
      company = afterName;
    }
  }

  const { origin, destination } = extractRoute(text);

  // Separate return leg text so it does not pollute the outbound date
  const returnSplit = text.split(/\b(?:return(?:ing)?|back on|coming back|fly back)\b/i);
  const outboundText = returnSplit[0];
  const date = findDate(outboundText, now) ?? findDate(text, now);
  const departBase = date ? new Date(`${date}T12:00:00`) : now;
  let returnDate = returnSplit.length > 1 ? findDate(returnSplit.slice(1).join(" "), departBase) : null;
  if (returnDate && date && returnDate <= date) returnDate = null;

  let pax: number | null = null;
  const paxMatch = text.match(/(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen)[ \t]*(?:pax|passengers?|people|guests|adults|travell?ers|of us)/i)
    ?? text.match(/party of\s+(\d{1,2}|\w+)/i);
  if (paxMatch) {
    const raw = paxMatch[1].toLowerCase();
    pax = NUMBER_WORDS[raw] ?? (parseInt(raw) || null);
  }

  let budget: number | null = null;
  const budgetMatch = text.match(/(?:budget|spend|around|up to|max(?:imum)?|under)[^$\d]{0,20}\$\s?([\d,.]+)\s*(k|K)?/)
    ?? text.match(/\$\s?([\d,.]+)\s*(k|K)?\s*(?:budget|max|all[\s-]in)/);
  if (budgetMatch) {
    const n = parseFloat(budgetMatch[1].replace(/,/g, ""));
    budget = budgetMatch[2] ? n * 1000 : n;
    if (budget < 1000) budget = null;
  }

  const time = text.match(/\b(\d{1,2}(?::\d{2})?\s?(?:am|pm))\b/i)?.[1]
    ?? text.match(/\b(early morning|morning|midday|afternoon|evening)\b/i)?.[1]
    ?? null;

  return {
    clientName,
    clientEmail: email,
    clientPhone: phone,
    company,
    origin,
    destination,
    date,
    departureTime: time,
    returnDate,
    pax,
    category: extractCategory(text),
    budget,
    pets: /\b(dogs?|pets?|cats?|puppy)\b/i.test(text),
    notes: null,
  };
}

export function mergeFields(primary: Partial<InquiryFields>, fallback: InquiryFields): InquiryFields {
  const out = { ...fallback };
  for (const key of Object.keys(fallback) as (keyof InquiryFields)[]) {
    const v = primary[key];
    if (v !== null && v !== undefined && v !== "") {
      (out as Record<string, unknown>)[key] = v;
    }
  }
  return out;
}

function daysUntil(date: string, now: Date): number {
  const [y, m, d] = date.split("-").map(Number);
  const target = Date.UTC(y, m - 1, d);
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target - today) / 86_400_000);
}

/** Deterministic lead scoring. Transparent reasons so the broker can trust it. */
export function qualify(fields: InquiryFields, now = new Date()): { qualification: Qualification; estimate: TripEstimate } {
  const estimate = estimateTrip(fields.origin, fields.destination, fields.pax);
  const reasons: { label: string; impact: number }[] = [];
  const missing: string[] = [];
  let score = 22;
  const add = (label: string, impact: number) => {
    reasons.push({ label, impact });
    score += impact;
  };

  if (fields.origin && fields.destination) add("Route identified", 14);
  else missing.push("Departure and arrival airports");

  if (fields.date) {
    add("Travel date provided", 12);
    const days = daysUntil(fields.date, now);
    if (days < 0) add("Date is in the past", -20);
    else if (days <= 3) add(`Departs in ${days === 0 ? "less than a day" : `${days} day${days === 1 ? "" : "s"}`}: urgent`, 12);
    else if (days <= 21) add(`Departs in ${days} days`, 7);
    else if (days > 90) add("Travel is more than 90 days out", -6);
  } else missing.push("Travel date");

  if (fields.pax) add(`${fields.pax} passenger${fields.pax === 1 ? "" : "s"} confirmed`, 7);
  else missing.push("Passenger count");

  if (fields.clientEmail || fields.clientPhone) add("Direct contact details", 7);
  else missing.push("Email or phone number");

  if (fields.clientEmail) {
    const domain = fields.clientEmail.split("@")[1]?.toLowerCase() ?? "";
    if (domain && !FREE_MAIL.includes(domain)) add(`Corporate domain (${domain})`, 8);
  }

  if (fields.returnDate) add("Round trip, two legs", 5);
  if (fields.category) add(`Aircraft preference: ${fields.category}`, 3);

  const rec = estimate.options.find((o) => o.category === (fields.category ?? estimate.recommended));
  if (fields.budget && rec) {
    const legs = fields.returnDate ? 2 : 1;
    if (fields.budget >= rec.low * legs * 0.9) add(`Budget $${Math.round(fields.budget / 1000)}k matches market`, 12);
    else if (fields.budget < rec.low * legs * 0.7) add(`Budget $${Math.round(fields.budget / 1000)}k is below market`, -14);
    else add("Budget is tight versus market", -4);
  }

  const bigCabin = fields.category === "Heavy Jet" || fields.category === "Ultra Long Range" || (fields.pax ?? 0) > 9;
  if (bigCabin) add("Large cabin, high ticket value", 6);

  score = Math.max(3, Math.min(98, Math.round(score)));
  const tier = score >= 70 ? "Hot" : score >= 45 ? "Warm" : "Cold";

  const route = fields.origin && fields.destination ? `${fields.origin} to ${fields.destination}` : "an unconfirmed route";
  const summary =
    tier === "Hot"
      ? `Ready to source. ${route}${fields.pax ? ` for ${fields.pax}` : ""}${rec ? `, market est. $${Math.round(rec.low / 1000)}k to $${Math.round(rec.high / 1000)}k` : ""}.`
      : tier === "Warm"
        ? `Promising lead on ${route}. ${missing.length ? `Confirm ${missing.join(", ").toLowerCase()} before sourcing.` : "Worth sourcing now."}`
        : `Low intent or incomplete. ${missing.length ? `Missing ${missing.join(", ").toLowerCase()}.` : "Budget or timing is a concern."} Send an auto follow up.`;

  return { qualification: { score, tier, reasons, missing, summary }, estimate };
}

export function categoryList(): AircraftCategory[] {
  return CATEGORIES.map((c) => c.category);
}
