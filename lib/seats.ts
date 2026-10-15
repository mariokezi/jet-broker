import type { AircraftCategory } from "./types";

/** A section of the cabin sold on its own: a whole zone or seat by seat. */
export interface CabinZone {
  id: string;
  name: string;
  kind: "club" | "conference" | "divan" | "aft";
  seats: number;
  pricePerSeat: number;
  zonePrice: number; // price to buy every seat in the zone at once
}

export interface SeatSale {
  id: string;
  zoneId: string;
  seats: number;
  wholeZone: boolean;
  name: string;
  email: string | null;
  phone: string | null;
  amount: number;
  at: string;
  source: "Broker" | "Online";
}

export interface SeatShare {
  zones: CabinZone[];
  sales: SeatSale[];
}

const round50 = (n: number) => Math.round(n / 50) * 50;

type ZoneShape = { name: string; kind: CabinZone["kind"]; seats: number; weight: number };

/** Typical cabin sections by aircraft size, front to back. */
function layoutFor(category: AircraftCategory, seats: number): ZoneShape[] {
  if (seats >= 12)
    return [
      { name: "Forward club", kind: "club", seats: 4, weight: 1.15 },
      { name: "Conference", kind: "conference", seats: 4, weight: 1 },
      { name: "Aft club", kind: "club", seats: seats - 11, weight: 0.95 },
      { name: "Divan", kind: "divan", seats: 3, weight: 0.8 },
    ].filter((z) => z.seats > 0) as ZoneShape[];
  if (seats === 9 || category === "Super Midsize Jet")
    return [
      { name: "Forward club", kind: "club", seats: 4, weight: 1.15 },
      { name: "Conference", kind: "conference", seats: Math.max(1, seats - 7), weight: 1 },
      { name: "Divan", kind: "divan", seats: 3, weight: 0.8 },
    ];
  if (seats >= 8)
    return [
      { name: "Forward club", kind: "club", seats: 4, weight: 1.1 },
      { name: "Aft club", kind: "club", seats: seats - 4, weight: 0.9 },
    ];
  return [
    { name: "Club", kind: "club", seats: Math.min(4, seats), weight: 1.1 },
    { name: "Aft seats", kind: "aft", seats: Math.max(1, seats - 4), weight: 0.85 },
  ];
}

/**
 * Split a leg into sellable cabin zones. Selling every seat earns about 25% more than
 * the whole aircraft price; buying a full zone is about 8% cheaper than its seats.
 */
export function createSeatShare(category: AircraftCategory, seats: number, askingPrice: number): SeatShare {
  const shapes = layoutFor(category, seats);
  const target = askingPrice * 1.25;
  const weightedSeats = shapes.reduce((s, z) => s + z.seats * z.weight, 0);
  const base = target / weightedSeats;
  const zones = shapes.map((z, i) => {
    const pricePerSeat = round50(base * z.weight);
    return { id: `Z${i + 1}`, name: z.name, kind: z.kind, seats: z.seats, pricePerSeat, zonePrice: round50(pricePerSeat * z.seats * 0.92) };
  });
  return { zones, sales: [] };
}

export function zoneSold(share: SeatShare, zoneId: string): number {
  return share.sales.filter((s) => s.zoneId === zoneId).reduce((n, s) => n + s.seats, 0);
}

export function seatStats(share: SeatShare) {
  const total = share.zones.reduce((n, z) => n + z.seats, 0);
  const sold = share.sales.reduce((n, s) => n + s.seats, 0);
  const revenue = share.sales.reduce((n, s) => n + s.amount, 0);
  const fromPrice = Math.min(...share.zones.map((z) => z.pricePerSeat));
  return { total, sold, open: total - sold, revenue, fromPrice };
}

export interface SeatDot {
  zoneId: string;
  zoneIndex: number;
  seatIndex: number; // within the zone
  x: number;
  y: number;
  sold: boolean;
}

/** Seat positions for a top down cabin drawing, nose on the left, in a 600 x 160 box. */
export function cabinSeats(share: SeatShare): { dots: SeatDot[]; zoneBounds: { zoneId: string; x0: number; x1: number }[] } {
  const pad = 20; // space between a seat's center and its zone edge
  const between = 12; // space between zones
  let x = 150 + pad;
  const dots: SeatDot[] = [];
  const zoneBounds: { zoneId: string; x0: number; x1: number }[] = [];
  share.zones.forEach((z, zi) => {
    const sold = zoneSold(share, z.id);
    let last = x;
    if (z.kind === "divan") {
      // Long couch along one wall
      for (let i = 0; i < z.seats; i++) dots.push({ zoneId: z.id, zoneIndex: zi, seatIndex: i, x: x + i * 28, y: 48, sold: i < sold });
      last = x + (z.seats - 1) * 28;
    } else {
      for (let i = 0; i < z.seats; i++) {
        const col = Math.floor(i / 2);
        dots.push({ zoneId: z.id, zoneIndex: zi, seatIndex: i, x: x + col * 40, y: i % 2 === 0 ? 48 : 112, sold: i < sold });
      }
      last = x + (Math.ceil(z.seats / 2) - 1) * 40;
    }
    zoneBounds.push({ zoneId: z.id, x0: x - pad, x1: last + pad });
    x = last + pad + between + pad;
  });
  return { dots, zoneBounds };
}
