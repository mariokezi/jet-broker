import { distanceNm, getIATA } from "./airport-lookup";
import { CATEGORIES, flightHours } from "./fleet";
import { utcDatePlus, demoTripDates } from "./demo-clock";
import { generateTripId } from "./trip-id";
import type { AircraftCategory, Booking, ParsedQuote } from "./types";

// ------------------------------------------------------------
// JetBroker Network: operators sign in to their own portal,
// manage fleet and availability, and answer broker RFQs directly.
// ------------------------------------------------------------

export interface OperatorAccount {
  id: string;
  company: string;
  contact: string;
  email: string;
  phone: string;
  base: string; // ICAO
  argusRating: "Platinum" | "Gold" | "Gold+";
}

export const OPERATOR_ACCOUNTS: OperatorAccount[] = [
  { id: "jet-excellence", company: "Jet Excellence", contact: "Mike Rodriguez", email: "mike@jetexcellence.example", phone: "(201) 555-0110", base: "KTEB", argusRating: "Platinum" },
  { id: "premier", company: "Premier Private Jets", contact: "Dana Whitfield", email: "sales@premierpj.example", phone: "(561) 555-0144", base: "KPBI", argusRating: "Platinum" },
];

export const DEMO_OPERATOR = OPERATOR_ACCOUNTS[0];

export function operatorAccount(id: string | null | undefined): OperatorAccount | null {
  return OPERATOR_ACCOUNTS.find((a) => a.id === id) ?? null;
}

export function operatorByCompany(company: string | null | undefined): OperatorAccount | null {
  if (!company) return null;
  const c = company.toLowerCase();
  return OPERATOR_ACCOUNTS.find((a) => a.company.toLowerCase() === c) ?? null;
}

export interface FleetAircraft {
  id: string;
  operatorId: string;
  tail: string;
  model: string;
  category: AircraftCategory;
  year: number;
  seats: number;
  hourlyRate: number;
  base: string; // ICAO
  refurb: number | null;
  totalHours: number;
  wifi: boolean;
}

export type BlockReason = "Maintenance" | "Owner use" | "Crew rest" | "Other";

export interface AvailabilityBlock {
  id: string;
  aircraftId: string;
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD inclusive
  reason: BlockReason;
  note: string | null;
}

export interface RfqResponse {
  status: "Quoted" | "Declined";
  at: string;
  quoteId: string | null;
  aircraftId: string | null;
  price: number | null;
  note: string | null;
}

export interface RfqRequest {
  id: string;
  tripId: string;
  inquiryId: string | null;
  origin: string;
  destination: string;
  date: string;
  departureTime: string | null;
  pax: number | null;
  category: AircraftCategory | null;
  notes: string | null;
  sentAt: string;
  broker: { name: string; company: string };
  to: string[]; // operator account ids
  responses: Record<string, RfqResponse>;
  seenBy: Record<string, string>;
}

/** Distance and price an operator would quote for one aircraft, using its own hourly rate. */
export function suggestQuote(ac: FleetAircraft, origin: string, destination: string, pax: number | null) {
  const spec = CATEGORIES.find((c) => c.category === ac.category) ?? CATEGORIES[2];
  const distance = distanceNm(origin, destination) ?? 800;
  const hours = flightHours(distance, spec.cruiseKts);
  const repoNm = distanceNm(ac.base, origin) ?? 0;
  const repoHours = repoNm > 20 ? Math.round((repoNm / spec.cruiseKts + 0.3) * 10) / 10 : 0;
  const billable = Math.max(hours + repoHours, 1.5);
  const base = billable * ac.hourlyRate;
  const fees = base * 0.075 + (pax ?? 4) * 5.5 + 650;
  const price = Math.round((base + fees) / 25) * 25;
  return { distance, hours, repoHours, price, fitsPax: !pax || ac.seats >= pax, fitsRange: spec.rangeNm >= distance };
}

/** Why an aircraft cannot fly on a date, or null when it is free. */
export function aircraftConflict(ac: FleetAircraft, date: string, blocks: AvailabilityBlock[], bookings: Booking[]): string | null {
  const block = blocks.find((b) => b.aircraftId === ac.id && b.start <= date && b.end >= date);
  if (block) return block.reason;
  const booked = bookings.find((b) => b.tailNumber === ac.tail && b.date === date);
  if (booked) return `Booked (${getIATA(booked.origin)} to ${getIATA(booked.destination)})`;
  return null;
}

export function portalQuoteId(requestId: string, operatorId: string): string {
  return `portal-${requestId}-${operatorId}`;
}

export function isPortalQuote(q: Pick<ParsedQuote, "quoteSource">): boolean {
  return q.quoteSource === "portal";
}

/** Turns an operator's portal answer into the same quote record the broker gets from email. */
export function buildPortalQuote(params: {
  request: RfqRequest;
  account: OperatorAccount;
  aircraft: FleetAircraft;
  price: number;
  note: string | null;
  at: string;
}): ParsedQuote {
  const { request: r, account: a, aircraft: ac, price, note, at } = params;
  const route = `${getIATA(r.origin)}-${getIATA(r.destination)}`;
  const body = `Submitted through the JetBroker Network operator portal.

Route: ${route} on ${r.date}
Aircraft: ${ac.model} (${ac.year}), tail ${ac.tail}
Seats: ${ac.seats}${ac.wifi ? ", wifi on board" : ""}
Based at: ${getIATA(ac.base)}
${ac.refurb ? `Interior refurbished ${ac.refurb}\n` : ""}Total time: ${ac.totalHours.toLocaleString()} hrs

Price: $${price.toLocaleString()} all in (FET, fuel, crew and segment fees included)
Operator safety: ARGUS ${a.argusRating}
${note ? `\nNote from ${a.contact.split(" ")[0]}: ${note}\n` : ""}
${a.contact}
${a.company}
${a.email} · ${a.phone}`;
  return {
    emailId: portalQuoteId(r.id, a.id),
    price,
    priceFormatted: `$${price.toLocaleString()}`,
    aircraft: ac.model,
    yom: ac.year,
    maxPax: ac.seats,
    tailNumber: ac.tail,
    refurbInterior: ac.refurb ? String(ac.refurb) : null,
    refurbExterior: null,
    totalHours: ac.totalHours,
    operator: a.company,
    quoteSource: "portal",
    externalLink: null,
    status: "Unanswered",
    receivedAt: at,
    subject: `JetBroker Network quote: ${route} ${r.date}`,
    from: a.email,
    fromName: a.contact,
    bodyType: "text",
    body,
    attachments: [],
  };
}

export function categoryOfModel(model: string): AircraftCategory | null {
  const m = model.toLowerCase();
  for (const spec of CATEGORIES) {
    if (spec.models.some((x) => m.includes(x.name.toLowerCase().replace(/\+$/, "")))) return spec.category;
  }
  return null;
}

// ------------------------------------------------------------
// Demo seed
// ------------------------------------------------------------

export function seedFleet(): FleetAircraft[] {
  const ac = (id: string, operatorId: string, tail: string, model: string, category: AircraftCategory, year: number, seats: number, hourlyRate: number, base: string, refurb: number | null, totalHours: number, wifi = true): FleetAircraft => ({
    id, operatorId, tail, model, category, year, seats, hourlyRate, base, refurb, totalHours, wifi,
  });
  return [
    ac("AC-JX1", "jet-excellence", "N350JX", "Challenger 350", "Super Midsize Jet", 2019, 9, 7600, "KTEB", null, 2140),
    ac("AC-JX2", "jet-excellence", "N560JX", "Citation XLS+", "Midsize Jet", 2012, 8, 5400, "KTEB", 2021, 6820),
    ac("AC-JX3", "jet-excellence", "N300JX", "Phenom 300", "Light Jet", 2018, 7, 4300, "KTEB", null, 3010),
    ac("AC-JX4", "jet-excellence", "N450JX", "Gulfstream G450", "Heavy Jet", 2014, 14, 10200, "KHPN", 2022, 5480),
    ac("AC-JX5", "jet-excellence", "N750JX", "Citation X", "Super Midsize Jet", 2015, 8, 7200, "KHPN", 2023, 4120),
    ac("AC-PP1", "premier", "N568PP", "Citation XLS+", "Midsize Jet", 2014, 8, 5300, "KPBI", 2022, 5910),
    ac("AC-PP2", "premier", "N355PP", "Challenger 350", "Super Midsize Jet", 2020, 9, 7700, "KPBI", null, 1780),
    ac("AC-PP3", "premier", "N302PP", "Phenom 300", "Light Jet", 2017, 7, 4200, "KFXE", null, 3460, false),
  ];
}

export function seedBlocks(anchorMs: number): AvailabilityBlock[] {
  const d = (n: number) => utcDatePlus(anchorMs, n);
  return [
    { id: "BL-1", aircraftId: "AC-JX4", start: d(2), end: d(5), reason: "Maintenance", note: "Phase inspection at Duncan Aviation" },
    { id: "BL-2", aircraftId: "AC-JX2", start: d(10), end: d(11), reason: "Owner use", note: "Owner trip to Nantucket" },
    { id: "BL-3", aircraftId: "AC-JX3", start: d(14), end: d(14), reason: "Crew rest", note: null },
    { id: "BL-4", aircraftId: "AC-PP2", start: d(6), end: d(8), reason: "Maintenance", note: null },
  ];
}

/** Network history for the seeded inquiries: one open request, one quoted, one declined. */
export function seedNetwork(anchorMs: number, broker: { name: string; company: string }, fleet: FleetAircraft[]): { requests: RfqRequest[]; quotes: Record<string, ParsedQuote[]> } {
  const { A, B, C } = demoTripDates(anchorMs);
  const at = (hoursAgo: number) => new Date(anchorMs - hoursAgo * 3_600_000).toISOString();
  const to = OPERATOR_ACCOUNTS.map((a) => a.id);
  const req = (id: string, inquiryId: string, origin: string, destination: string, date: string, time: string, pax: number, category: AircraftCategory, hoursAgo: number, notes: string | null): RfqRequest => ({
    id, inquiryId, origin, destination, date, departureTime: time, pax, category, notes,
    tripId: generateTripId(origin, destination, date), sentAt: at(hoursAgo), broker, to, responses: {}, seenBy: {},
  });
  const open = req("RQ-501", "INQ-2037", "KTEB", "KPBI", A.iso, "09:00", 6, "Midsize Jet", 30, "Midsize or larger, all in pricing please.");
  const quoted = req("RQ-500", "INQ-2033", "KOPF", "KTEB", C.iso, "07:00", 5, "Midsize Jet", 18, "Early morning departure.");
  const declined = req("RQ-499", "INQ-2035", "KVNY", "KASE", B.iso, "14:00", 7, "Midsize Jet", 22, "7 passengers with skis, newer midsize preferred.");

  const jx = OPERATOR_ACCOUNTS[0];
  const ch = fleet.find((f) => f.id === "AC-JX1")!;
  const quote = buildPortalQuote({ request: quoted, account: jx, aircraft: ch, price: suggestQuote(ch, quoted.origin, quoted.destination, quoted.pax).price, note: "Aircraft overnights in Miami the night before, so no repositioning charge.", at: at(16.5) });
  quoted.responses[jx.id] = { status: "Quoted", at: quote.receivedAt, quoteId: quote.emailId, aircraftId: ch.id, price: quote.price, note: null };
  quoted.seenBy[jx.id] = at(17);
  declined.responses[jx.id] = { status: "Declined", at: at(21), quoteId: null, aircraftId: null, price: null, note: "No aircraft positioned on the West Coast that week." };
  declined.seenBy[jx.id] = at(21.5);

  return { requests: [open, quoted, declined], quotes: { [quoted.tripId]: [quote] } };
}
