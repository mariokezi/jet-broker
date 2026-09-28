import { distanceNm, getAirport } from "./airport-lookup";
import { estimateTrip } from "./fleet";
import { utcDatePlus } from "./demo-clock";
import type { AircraftCategory, Inquiry } from "./types";
import type { SeatShare } from "./seats";

export type LegStatus = "Open" | "Pending" | "Claimed" | "Withdrawn";
export type PosterKind = "Broker" | "Operator";

export interface LegParty {
  name: string;
  company: string;
  kind: PosterKind;
}

export interface EmptyLeg {
  id: string;
  postedAt: string;
  postedBy: LegParty;
  isMine: boolean;
  origin: string; // ICAO
  destination: string; // ICAO
  earliest: string; // YYYY-MM-DD
  latest: string; // YYYY-MM-DD
  aircraft: string;
  category: AircraftCategory;
  seats: number;
  tailNumber: string | null;
  askingPrice: number;
  notes: string | null;
  status: LegStatus;
  claim: {
    inquiryId: string | null;
    clientName: string;
    clientPrice: number;
    requestedAt: string;
    acceptAt: string; // simulated counterparty acceptance time
  } | null;
  sourceBookingId: string | null;
  /** When set, the leg is sold by cabin zone or seat instead of as a whole aircraft. */
  seatShare?: SeatShare | null;
}

export interface LegMessage {
  id: string;
  legId: string;
  at: string; // may be in the future: simulated replies appear when the clock passes it
  fromMe: boolean;
  author: string;
  text: string;
}

/** Airports within this distance count as "the same area" for matching. */
const NEARBY_NM = 60;

const REGIONS: Record<string, (lat: number, lon: number, icao: string) => boolean> = {
  Florida: (lat, lon) => lat < 31 && lat > 24.3 && lon > -87.7 && lon < -79.8,
  Northeast: (lat, lon) => lat >= 38.5 && lon > -80.5,
  Southeast: (lat, lon) => lat < 38.5 && lat >= 31 && lon > -92,
  "Midwest & Texas": (lat, lon) => lon <= -80.5 && lon > -104 && !(lat < 31 && lon > -87.7),
  West: (_lat, lon) => lon <= -104,
  "Caribbean & Mexico": (_lat, _lon, icao) => !icao.startsWith("K"),
};

export const REGION_NAMES = Object.keys(REGIONS);

export function legRegions(leg: Pick<EmptyLeg, "origin" | "destination">): string[] {
  const out = new Set<string>();
  for (const icao of [leg.origin, leg.destination]) {
    const a = getAirport(icao);
    if (!a) continue;
    for (const [name, test] of Object.entries(REGIONS)) {
      if (test(a.lat, a.lon, a.icao)) out.add(name);
    }
  }
  return [...out];
}

function near(a: string, b: string): boolean {
  if (a === b) return true;
  const d = distanceNm(a, b);
  return d !== null && d <= NEARBY_NM;
}

export interface LegMatch {
  leg: EmptyLeg;
  inquiry: Inquiry;
  charterEstimate: number | null; // typical one way charter for this route and category
  savingsPct: number | null;
}

/** Network legs (not mine) that fit an open inquiry: same area both ends, date in window, seats fit. */
export function findMatches(legs: EmptyLeg[], inquiries: Inquiry[]): LegMatch[] {
  const matches: LegMatch[] = [];
  for (const inq of inquiries) {
    if (!inq.origin || !inq.destination || !inq.date) continue;
    if (inq.status === "Booked" || inq.status === "Lost") continue;
    for (const leg of legs) {
      if (leg.isMine || leg.status !== "Open" || leg.seatShare) continue;
      if (!near(leg.origin, inq.origin) || !near(leg.destination, inq.destination)) continue;
      if (inq.date < leg.earliest || inq.date > leg.latest) continue;
      if (inq.pax && inq.pax > leg.seats) continue;
      const est = estimateTrip(leg.origin, leg.destination, inq.pax).options.find((o) => o.category === leg.category);
      const charter = est ? (est.low + est.high) / 2 : null;
      matches.push({
        leg,
        inquiry: inq,
        charterEstimate: charter,
        savingsPct: charter ? Math.max(0, Math.round((1 - leg.askingPrice / charter) * 100)) : null,
      });
    }
  }
  return matches.sort((a, b) => (b.savingsPct ?? 0) - (a.savingsPct ?? 0));
}

export function charterEstimateFor(leg: Pick<EmptyLeg, "origin" | "destination" | "category" | "seats">): number | null {
  const est = estimateTrip(leg.origin, leg.destination, Math.min(leg.seats, 4)).options.find((o) => o.category === leg.category);
  return est ? (est.low + est.high) / 2 : null;
}

/** Demo only: the counterparty's reply to a message, chosen by what was asked. */
export function simulatedReply(leg: EmptyLeg, text: string): string {
  const t = text.toLowerCase();
  const first = leg.postedBy.name.split(" ")[0];
  if (/\$|price|offer|lower|best|discount|budget/.test(t)) {
    const counter = Math.round((leg.askingPrice * 0.93) / 50) * 50;
    return `We have some room. I can do $${counter.toLocaleString()} all in if you confirm today. ${first}`;
  }
  if (/dog|pet|cat/.test(t)) return "Pets are fine on this tail, small cleaning fee may apply. Crate or leash required.";
  if (/time|when|depart|morning|afternoon|evening/.test(t)) {
    return `Crew is flexible inside the window. Earliest wheels up is 8am on ${leg.earliest}, latest 6pm on ${leg.latest}.`;
  }
  if (/wifi|catering|bag|luggage|ski|golf/.test(t)) return "Wifi on board, standard catering included, and the baggage hold takes skis and golf bags.";
  if (/hold|claim|book|take it|confirm/.test(t)) return "I can hold it for 2 hours. Hit Claim on the leg and I'll confirm right away.";
  return `Yes, still available. ${leg.aircraft}${leg.tailNumber ? ` (${leg.tailNumber})` : ""}, ${leg.seats} seats. Let me know if you have a client for it.`;
}

/** Demo only: another broker's opening message when you post a leg. */
export function simulatedInterest(leg: EmptyLeg): { author: string; text: string } {
  const pax = Math.max(2, Math.min(leg.seats - 1, 5));
  const offer = Math.round((leg.askingPrice * 0.85) / 50) * 50;
  return {
    author: "Nicole Grant, Coastal Air Partners",
    text: `Hi, I have ${pax} pax who could use your leg. Would you take $${offer.toLocaleString()}? Can confirm within the hour.`,
  };
}

function seedLeg(
  anchorMs: number,
  id: string,
  hoursAgo: number,
  postedBy: LegParty,
  origin: string,
  destination: string,
  fromDay: number,
  toDay: number,
  aircraft: string,
  category: AircraftCategory,
  seats: number,
  tailNumber: string,
  askingPrice: number,
  notes: string | null,
  isMine = false,
  sourceBookingId: string | null = null
): EmptyLeg {
  return {
    id,
    postedAt: new Date(anchorMs - hoursAgo * 3_600_000).toISOString(),
    postedBy,
    isMine,
    origin,
    destination,
    earliest: utcDatePlus(anchorMs, fromDay),
    latest: utcDatePlus(anchorMs, toDay),
    aircraft,
    category,
    seats,
    tailNumber,
    askingPrice,
    notes,
    status: "Open",
    claim: null,
    sourceBookingId,
  };
}

export function seedEmptyLegs(anchorMs: number, me: LegParty): { legs: EmptyLeg[]; messages: LegMessage[] } {
  const op = (name: string, company: string): LegParty => ({ name, company, kind: "Operator" });
  const br = (name: string, company: string): LegParty => ({ name, company, kind: "Broker" });

  const legs: EmptyLeg[] = [
    seedLeg(anchorMs, "EL-3108", 3, op("Dana Whitfield", "Premier Private Jets"), "KFXE", "KTEB", 11, 13, "Citation XLS+", "Midsize Jet", 8, "N568PP", 9900, "Repositioning after a drop in Fort Lauderdale. Flexible on time."),
    seedLeg(anchorMs, "EL-3107", 5, br("Nicole Grant", "Coastal Air Partners"), "KMIA", "KHPN", 4, 5, "Challenger 350", "Super Midsize Jet", 9, "N355CA", 14500, "Owner approved for charter. Full galley."),
    seedLeg(anchorMs, "EL-3106", 7, op("Rachel Kim", "Flight Level Services"), "KHPN", "KACK", 14, 16, "Citation CJ3", "Light Jet", 7, "N301FL", 5600, "Summer shuttle aircraft heading to the island for a pickup."),
    seedLeg(anchorMs, "EL-3105", 9, br("Carlos Ortega", "Blue Sky Aviation Group"), "KTPA", "KTEB", 2, 3, "Hawker 800XP", "Midsize Jet", 8, "N812BS", 10500, null),
    seedLeg(anchorMs, "EL-3104", 12, br("Jenna Moss", "Palm Coast Charter"), "KPBI", "MYNN", 5, 7, "King Air 350", "Turboprop", 8, "N350PC", 4200, "Customs handled by operator. Great for a Bahamas weekend."),
    seedLeg(anchorMs, "EL-3103", 16, op("Cody Barnes", "Lone Star Jets"), "KSDL", "KDAL", 3, 4, "Challenger 350", "Super Midsize Jet", 9, "N350LS", 8900, "Return after a drop in Scottsdale."),
    seedLeg(anchorMs, "EL-3102", 20, br("Tom Alvarez", "Summit Charter Group"), "KAPF", "KPTK", 6, 8, "Phenom 300", "Light Jet", 7, "N300SC", 7800, "Naples to Detroit area, can divert to DTW."),
    seedLeg(anchorMs, "EL-3101", 26, op("Evan Brooks", "Pacific Coast Jets"), "KASE", "KVNY", 9, 10, "Gulfstream G450", "Heavy Jet", 14, "N450PC", 18000, null),
    seedLeg(anchorMs, "EL-3100", 30, me, "KJAC", "KSNA", 8, 9, "Gulfstream G450", "Heavy Jet", 14, "N450PC", 21000, "Empty return after our Jackson Hole drop (BK-1187).", true, "BK-1187"),
  ];

  const at = (hoursAgo: number) => new Date(anchorMs - hoursAgo * 3_600_000).toISOString();
  const messages: LegMessage[] = [
    { id: "LM-1", legId: "EL-3100", at: at(6), fromMe: false, author: "Carlos Ortega, Blue Sky Aviation Group", text: "Is the JAC to SNA leg still open? I may have 6 pax heading home to Newport Beach that week." },
    { id: "LM-2", legId: "EL-3100", at: at(5.5), fromMe: true, author: me.name, text: "Still open. Asking $21k all in, date is flexible inside the window." },
    { id: "LM-3", legId: "EL-3100", at: at(5), fromMe: false, author: "Carlos Ortega, Blue Sky Aviation Group", text: "Great, confirming with my client and will circle back today." },
  ];

  return { legs, messages };
}

export function isFloridaLeg(leg: Pick<EmptyLeg, "origin" | "destination">): boolean {
  return legRegions(leg).includes("Florida");
}
