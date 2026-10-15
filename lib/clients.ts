import type { Booking, Inquiry } from "./types";
import type { EmptyLeg } from "./empty-legs";

export interface ClientProfile {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  homeAirport: string | null; // ICAO
  tier: "VIP" | "Regular" | "New";
  preferences: string[];
  notes: string | null;
  since: string; // YYYY-MM-DD
}

export function clientIdFor(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export interface ClientSummary {
  profile: ClientProfile;
  bookings: Booking[];
  inquiries: Inquiry[];
  seatTrips: { leg: EmptyLeg; seats: number; amount: number; zone: string }[];
  spend: number;
  margin: number;
  flights: number;
  nextFlight: Booking | null;
  lastFlight: Booking | null;
}

/** Profiles plus everyone who appears in inquiries, bookings or seat sales, with their history rolled up. */
export function buildClients(profiles: ClientProfile[], inquiries: Inquiry[], bookings: Booking[], legs: EmptyLeg[], today: string): ClientSummary[] {
  const map = new Map<string, ClientProfile>();
  for (const p of profiles) map.set(p.id, p);
  const ensure = (name: string, extra: Partial<ClientProfile> = {}) => {
    const id = clientIdFor(name);
    if (!id) return;
    const existing = map.get(id);
    if (existing) {
      map.set(id, { ...existing, email: existing.email ?? extra.email ?? null, phone: existing.phone ?? extra.phone ?? null, company: existing.company ?? extra.company ?? null });
      return;
    }
    map.set(id, { id, name, company: null, email: null, phone: null, homeAirport: null, tier: "New", preferences: [], notes: null, since: today, ...extra });
  };
  for (const i of inquiries) if (i.clientName) ensure(i.clientName, { email: i.clientEmail, phone: i.clientPhone, company: i.company, homeAirport: i.origin });
  for (const b of bookings) ensure(b.clientName, { homeAirport: b.origin });
  for (const l of legs) for (const s of l.seatShare?.sales ?? []) ensure(s.name, { email: s.email, phone: s.phone });

  return [...map.values()]
    .map((profile) => {
      const mine = bookings.filter((b) => clientIdFor(b.clientName) === profile.id).sort((a, b) => a.date.localeCompare(b.date));
      const seatTrips = legs.flatMap((leg) =>
        (leg.seatShare?.sales ?? [])
          .filter((s) => clientIdFor(s.name) === profile.id)
          .map((s) => ({ leg, seats: s.seats, amount: s.amount, zone: leg.seatShare!.zones.find((z) => z.id === s.zoneId)?.name ?? "" }))
      );
      const spend = mine.reduce((s, b) => s + b.clientPrice, 0) + seatTrips.reduce((s, t) => s + t.amount, 0);
      return {
        profile,
        bookings: mine,
        inquiries: inquiries.filter((i) => i.clientName && clientIdFor(i.clientName) === profile.id),
        seatTrips,
        spend,
        margin: mine.reduce((s, b) => s + b.clientPrice - b.operatorPrice, 0),
        flights: mine.length + seatTrips.length,
        nextFlight: mine.find((b) => b.date >= today) ?? null,
        lastFlight: [...mine].reverse().find((b) => b.date < today) ?? null,
      };
    })
    .sort((a, b) => b.spend - a.spend || a.profile.name.localeCompare(b.profile.name));
}
