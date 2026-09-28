import { distanceNm, getAirportCity, getIATA } from "./airport-lookup";
import type { AircraftCategory, CategoryEstimate, ParsedQuote, TripEstimate } from "./types";

export interface CategorySpec {
  category: AircraftCategory;
  cruiseKts: number;
  rangeNm: number;
  maxPax: number;
  hourlyRate: number; // typical retail charter rate, USD
  models: { name: string; pax: number; years: [number, number] }[];
}

export const CATEGORIES: CategorySpec[] = [
  {
    category: "Turboprop",
    cruiseKts: 270,
    rangeNm: 1400,
    maxPax: 8,
    hourlyRate: 2900,
    models: [
      { name: "Pilatus PC-12", pax: 8, years: [2008, 2024] },
      { name: "King Air 350", pax: 8, years: [2008, 2023] },
    ],
  },
  {
    category: "Light Jet",
    cruiseKts: 400,
    rangeNm: 1700,
    maxPax: 7,
    hourlyRate: 4600,
    models: [
      { name: "Phenom 300", pax: 7, years: [2010, 2024] },
      { name: "Citation CJ3", pax: 7, years: [2006, 2019] },
      { name: "Citation M2", pax: 6, years: [2014, 2024] },
      { name: "Learjet 45", pax: 7, years: [2000, 2012] },
    ],
  },
  {
    category: "Midsize Jet",
    cruiseKts: 430,
    rangeNm: 2100,
    maxPax: 8,
    hourlyRate: 5900,
    models: [
      { name: "Hawker 800XP", pax: 8, years: [1996, 2005] },
      { name: "Citation XLS+", pax: 8, years: [2009, 2021] },
      { name: "Learjet 60", pax: 7, years: [1998, 2011] },
      { name: "Citation VII", pax: 8, years: [1992, 2000] },
    ],
  },
  {
    category: "Super Midsize Jet",
    cruiseKts: 460,
    rangeNm: 3200,
    maxPax: 9,
    hourlyRate: 7900,
    models: [
      { name: "Challenger 350", pax: 9, years: [2014, 2024] },
      { name: "Citation X", pax: 8, years: [1998, 2018] },
      { name: "Citation Longitude", pax: 9, years: [2019, 2024] },
      { name: "Praetor 600", pax: 9, years: [2019, 2024] },
    ],
  },
  {
    category: "Heavy Jet",
    cruiseKts: 470,
    rangeNm: 4000,
    maxPax: 14,
    hourlyRate: 10900,
    models: [
      { name: "Challenger 605", pax: 12, years: [2007, 2015] },
      { name: "Falcon 2000LX", pax: 10, years: [2009, 2019] },
      { name: "Gulfstream G450", pax: 14, years: [2005, 2017] },
    ],
  },
  {
    category: "Ultra Long Range",
    cruiseKts: 490,
    rangeNm: 6500,
    maxPax: 16,
    hourlyRate: 15500,
    models: [
      { name: "Gulfstream G650", pax: 14, years: [2012, 2022] },
      { name: "Global 6000", pax: 14, years: [2012, 2019] },
      { name: "Falcon 7X", pax: 14, years: [2007, 2021] },
    ],
  },
];

export function categoryFromAircraft(aircraft: string | null): AircraftCategory | null {
  if (!aircraft) return null;
  const a = aircraft.toLowerCase();
  for (const spec of CATEGORIES) {
    if (spec.models.some((m) => a.includes(m.name.toLowerCase().replace(/\+$/, "")))) {
      return spec.category;
    }
  }
  return null;
}

const FET_RATE = 0.075;
const SEGMENT_FEE_PER_PAX = 5.5;

function flightHours(distance: number, cruiseKts: number): number {
  // Taxi, climb and descent overhead plus a winds allowance
  return Math.round((distance / cruiseKts + 0.35) * 10) / 10;
}

function tripPrice(spec: CategorySpec, hours: number, pax: number, repositionHrs: number): number {
  const billable = Math.max(hours + repositionHrs, 1.5); // typical 1.5 hr minimum
  const base = billable * spec.hourlyRate;
  const fees = base * FET_RATE + pax * SEGMENT_FEE_PER_PAX + 650; // FET, segment fees, landing/handling
  return Math.round((base + fees) / 25) * 25;
}

export function estimateTrip(origin: string | null, destination: string | null, pax: number | null): TripEstimate {
  const distance = origin && destination ? distanceNm(origin, destination) : null;
  if (distance === null) return { distanceNm: null, recommended: null, options: [] };

  const people = pax ?? 4;
  const options: CategoryEstimate[] = CATEGORIES.map((spec) => {
    const hours = flightHours(distance, spec.cruiseKts);
    const fits = spec.maxPax >= people && spec.rangeNm >= distance;
    return {
      category: spec.category,
      flightHours: hours,
      low: tripPrice(spec, hours, people, 0.3),
      high: tripPrice(spec, hours, people, 1.2),
      fits,
    };
  });

  // Recommend the smallest category that fits and is comfortable for the stage length
  const recommended =
    CATEGORIES.find((spec) => {
      if (spec.maxPax < people || spec.rangeNm < distance) return false;
      if (spec.category === "Turboprop" && distance > 500) return false;
      if (spec.category === "Light Jet" && distance > 1200) return false;
      return true;
    })?.category ?? null;

  return { distanceNm: distance, recommended, options };
}

// ------------------------------------------------------------
// Operator network (used to route RFQs and, in demo mode, to
// simulate operator responses)
// ------------------------------------------------------------

export interface Operator {
  name: string;
  contact: string;
  email: string;
  base: string; // ICAO
  categories: AircraftCategory[];
  argusRating: "Platinum" | "Gold" | "Gold+";
}

export const OPERATORS: Operator[] = [
  { name: "Jet Excellence", contact: "Mike Rodriguez", email: "mike@jetexcellence.example", base: "KTEB", categories: ["Super Midsize Jet", "Midsize Jet"], argusRating: "Platinum" },
  { name: "Flight Level Services", contact: "Sarah Chen", email: "ops@flightlevelservices.example", base: "KHPN", categories: ["Midsize Jet", "Light Jet", "Super Midsize Jet"], argusRating: "Gold+" },
  { name: "Trinity Private Jet Charter", contact: "James Webb", email: "dispatch@trinitypj.example", base: "KOPF", categories: ["Turboprop", "Light Jet", "Midsize Jet"], argusRating: "Gold" },
  { name: "ATI Jet", contact: "Charter Desk", email: "quotes@atijet.example", base: "KAUS", categories: ["Light Jet", "Midsize Jet"], argusRating: "Gold+" },
  { name: "Premier Private Jets", contact: "Dana Whitfield", email: "sales@premierpj.example", base: "KPBI", categories: ["Light Jet", "Super Midsize Jet", "Heavy Jet"], argusRating: "Platinum" },
  { name: "MERLIN1 Aviation", contact: "Ops Desk", email: "ops@merlin1.example", base: "KFXE", categories: ["Midsize Jet", "Super Midsize Jet"], argusRating: "Gold" },
  { name: "Century Aviation", contact: "Tom Alvarez", email: "charter@centuryaviation.example", base: "KVNY", categories: ["Light Jet", "Midsize Jet", "Heavy Jet"], argusRating: "Platinum" },
  { name: "AEM Aviation", contact: "Info Desk", email: "info@aemaviation.example", base: "KTEB", categories: ["Light Jet", "Midsize Jet"], argusRating: "Gold" },
  { name: "Royal Flight Club", contact: "Bookings", email: "bookings@royalflightclub.example", base: "KMIA", categories: ["Midsize Jet", "Heavy Jet"], argusRating: "Gold" },
  { name: "Summit Air Charter", contact: "Rachel Kim", email: "quotes@summitair.example", base: "KAPA", categories: ["Super Midsize Jet", "Heavy Jet", "Ultra Long Range"], argusRating: "Platinum" },
  { name: "Lone Star Jets", contact: "Cody Barnes", email: "charter@lonestarjets.example", base: "KDAL", categories: ["Light Jet", "Midsize Jet", "Super Midsize Jet"], argusRating: "Gold+" },
  { name: "Great Lakes Executive", contact: "Anna Kowalski", email: "fly@glexec.example", base: "KPTK", categories: ["Turboprop", "Light Jet", "Midsize Jet"], argusRating: "Gold" },
  { name: "Pacific Coast Jets", contact: "Evan Brooks", email: "ops@pcjets.example", base: "KSNA", categories: ["Super Midsize Jet", "Heavy Jet", "Ultra Long Range"], argusRating: "Platinum" },
];

/** Operators that fly the requested category (or neighbours), closest bases first. */
export function matchOperators(origin: string, category: AircraftCategory | null): Operator[] {
  const idx = category ? CATEGORIES.findIndex((c) => c.category === category) : -1;
  const wanted = new Set<AircraftCategory>(
    idx < 0
      ? CATEGORIES.map((c) => c.category)
      : CATEGORIES.slice(Math.max(0, idx - 1), idx + 2).map((c) => c.category)
  );
  return OPERATORS.filter((op) => op.categories.some((c) => wanted.has(c))).sort(
    (a, b) => (distanceNm(a.base, origin) ?? 9999) - (distanceNm(b.base, origin) ?? 9999)
  );
}

// Small deterministic PRNG so the same inquiry always produces the same quotes
function rng(seedText: string) {
  let h = 1779033703 ^ seedText.length;
  for (let i = 0; i < seedText.length; i++) {
    h = Math.imul(h ^ seedText.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

export interface SimulatedQuote {
  quote: ParsedQuote;
  delayMs: number;
}

/**
 * Demo mode only: synthesize operator responses to an RFQ. Each response is
 * a plain-text email that runs through the same quote table as real email.
 */
export function simulateOperatorQuotes(params: {
  seed: string;
  origin: string;
  destination: string;
  date: string;
  pax: number | null;
  category: AircraftCategory | null;
}): SimulatedQuote[] {
  const rand = rng(params.seed);
  const distance = distanceNm(params.origin, params.destination) ?? 800;
  const people = params.pax ?? 4;
  const estimate = estimateTrip(params.origin, params.destination, people);
  const target = params.category ?? estimate.recommended ?? "Midsize Jet";
  const targetIdx = CATEGORIES.findIndex((c) => c.category === target);
  const operators = matchOperators(params.origin, target).slice(0, 8);
  const count = Math.min(operators.length, 6 + Math.floor(rand() * 3));
  const results: SimulatedQuote[] = [];
  const route = `${getIATA(params.origin)}-${getIATA(params.destination)}`;
  const [y, m, d] = params.date.split("-").map(Number);
  const dateText = `${m}/${d}/${String(y).slice(2)}`;

  for (let i = 0; i < count; i++) {
    const op = operators[i];
    // Mostly the target category, sometimes one size up or down
    const shift = rand() < 0.65 ? 0 : rand() < 0.5 ? -1 : 1;
    const spec =
      CATEGORIES[Math.min(CATEGORIES.length - 1, Math.max(0, targetIdx + shift))];
    const usable = spec.models.filter((mdl) => mdl.pax >= Math.min(people, spec.maxPax));
    const model = (usable.length ? usable : spec.models)[Math.floor(rand() * (usable.length || spec.models.length))];
    const hours = flightHours(distance, spec.cruiseKts);
    const reposition = (distanceNm(op.base, params.origin) ?? 300) / spec.cruiseKts;
    const price =
      Math.round((tripPrice(spec, hours, people, Math.min(reposition, 2.5)) * (0.9 + rand() * 0.22)) / 25) * 25;
    const [firstYear, lastYear] = model.years;
    const yom = firstYear + Math.floor(rand() * (lastYear - firstYear + 1));
    // Older airframes have been refurbished; recent ones still wear the factory interior
    const refurbI = yom >= 2020 ? null : Math.min(2025, yom + 5 + Math.floor(rand() * (2025 - yom - 4)));
    const refurbE = refurbI === null ? null : Math.max(yom + 3, refurbI - Math.floor(rand() * 3));
    const tail = `N${100 + Math.floor(rand() * 899)}${String.fromCharCode(65 + Math.floor(rand() * 26))}${String.fromCharCode(65 + Math.floor(rand() * 26))}`;
    const totalHours = Math.round((2026 - yom) * (280 + rand() * 180));
    const id = `rfq-${params.seed}-${i}`;

    const body = `Hi,

Thanks for the RFQ. We can support your ${route} trip on ${dateText} (${getAirportCity(params.origin)} to ${getAirportCity(params.destination)}).

Aircraft: ${model.name}
Tail: ${tail}
YOM: ${yom}
Max passengers: ${model.pax}
Total time: ${totalHours.toLocaleString()} hrs
${refurbI ? `Interior/Exterior refurb: ${refurbI}/${refurbE}` : "Interior: factory original"}
Est. flight time: ${hours.toFixed(1)} hrs

Price: $${price.toLocaleString()} all-in (incl. FET, fuel, crew, and segment fees)
Operator safety: ARGUS ${op.argusRating}, Wyvern registered

Quote valid 24 hours, subject to availability at time of booking.

${op.contact}
${op.name}
${op.email}`;

    results.push({
      delayMs: 1800 + i * (1400 + Math.floor(rand() * 1600)),
      quote: {
        emailId: id,
        price,
        priceFormatted: `$${price.toLocaleString()}`,
        aircraft: model.name,
        yom,
        maxPax: model.pax,
        tailNumber: tail,
        refurbInterior: refurbI ? String(refurbI) : null,
        refurbExterior: refurbE ? String(refurbE) : null,
        totalHours,
        operator: op.name,
        quoteSource: "inline",
        externalLink: null,
        status: "Unanswered",
        receivedAt: new Date().toISOString(),
        subject: `RE: RFQ ${route} ${dateText}`,
        from: op.email,
        fromName: op.contact,
        bodyType: "text",
        body,
        attachments: [],
      },
    });
  }

  return results;
}

/** 0-100 value score: cheaper, newer, recently refurbished, lower time aircraft score higher. */
export function valueScores(quotes: ParsedQuote[]): Map<string, number> {
  const priced = quotes.filter((q) => q.price !== null);
  const scores = new Map<string, number>();
  if (priced.length === 0) return scores;
  const year = new Date().getFullYear();
  const prices = priced.map((q) => q.price!);
  const minP = Math.min(...prices);
  const maxP = Math.max(...prices);
  for (const q of priced) {
    const priceScore = maxP === minP ? 1 : 1 - (q.price! - minP) / (maxP - minP);
    const age = q.yom ? Math.max(0, year - q.yom) : 18;
    const ageScore = Math.max(0, 1 - age / 30);
    const refurb = q.refurbInterior ? parseInt(q.refurbInterior) : NaN;
    const refurbScore = Number.isFinite(refurb) ? Math.max(0, 1 - (year - refurb) / 12) : age <= 6 ? 0.8 : 0.3;
    const score = priceScore * 0.55 + ageScore * 0.25 + refurbScore * 0.2;
    scores.set(q.emailId, Math.round(score * 100));
  }
  return scores;
}
