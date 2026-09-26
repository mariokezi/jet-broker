"use client";

import { useMemo } from "react";
import { getAirportName } from "@/lib/airport-lookup";
import { inquiryTripId } from "@/lib/demo-state";
import type { Inquiry, ParsedQuote, Trip } from "@/lib/types";
import { useStore } from "./store-provider";

/** RFQ responses that have "arrived" as of now. */
export function visibleRfqQuotes(rfq: ParsedQuote[] | undefined, now: number): ParsedQuote[] {
  return (rfq ?? []).filter((q) => Date.parse(q.receivedAt) <= now);
}

/** Server (email) trips merged with trips sourced from inquiries via RFQ. */
export function useMergedTrips(serverTrips: Trip[]): Trip[] {
  const store = useStore();
  return useMemo(() => {
    if (!store) return serverTrips;
    const { state, now } = store;
    const byId = new Map(serverTrips.map((t) => [t.tripId, { ...t, quotes: [...t.quotes] }]));
    for (const [tripId, rfq] of Object.entries(state.rfqQuotes)) {
      const quotes = visibleRfqQuotes(rfq, now);
      const inq = state.inquiries.find((i) => inquiryTripId(i) === tripId);
      if (!inq || !inq.origin || !inq.destination || !inq.date) continue;
      const existing = byId.get(tripId);
      if (existing) {
        existing.quotes.push(...quotes);
      } else if (quotes.length > 0) {
        byId.set(tripId, tripFromInquiry(inq, tripId, quotes));
      }
    }
    return [...byId.values()].map((t) => ({
      ...t,
      quotes: t.quotes.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity)),
      lastUpdated: t.quotes.reduce((l, q) => (q.receivedAt > l ? q.receivedAt : l), t.lastUpdated),
      status: state.bookings.some((b) => b.tripId === t.tripId) ? "Closed" : t.status,
    }));
  }, [serverTrips, store]);
}

export function tripFromInquiry(inq: Inquiry, tripId: string, quotes: ParsedQuote[]): Trip {
  return {
    tripId,
    origin: inq.origin!,
    originName: getAirportName(inq.origin!),
    destination: inq.destination!,
    destinationName: getAirportName(inq.destination!),
    date: inq.date!,
    quotes,
    status: "Open",
    lastUpdated: quotes.reduce((l, q) => (q.receivedAt > l ? q.receivedAt : l), inq.createdAt),
  };
}
