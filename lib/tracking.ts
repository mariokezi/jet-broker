import { distanceNm } from "./airport-lookup";
import { CATEGORIES, categoryFromAircraft } from "./fleet";
import type { Booking } from "./types";

export type FlightPhase = "Scheduled" | "Boarding" | "Departed" | "Landed";

export interface FlightStatus {
  phase: FlightPhase;
  departMs: number;
  arriveMs: number;
  progress: number; // 0 to 1 while airborne
  minutesToGo: number; // until departure (Scheduled, Boarding) or arrival (Departed)
}

/** Scheduled wheels up in the viewer's local time. */
export function departureMs(b: Pick<Booking, "date" | "departureTime">): number {
  return Date.parse(`${b.date}T${b.departureTime}:00`);
}

/** Block time from great circle distance and the aircraft's cruise speed, plus taxi and climb. */
export function blockMinutes(b: Pick<Booking, "origin" | "destination" | "aircraft">): number {
  const nm = distanceNm(b.origin, b.destination) ?? 800;
  const spec = CATEGORIES.find((c) => c.category === categoryFromAircraft(b.aircraft)) ?? CATEGORIES[2];
  return Math.round((nm / spec.cruiseKts) * 60 + 20);
}

export function flightStatus(b: Booking, now: number): FlightStatus {
  const departMs = departureMs(b);
  const arriveMs = departMs + blockMinutes(b) * 60_000;
  if (now >= arriveMs) return { phase: "Landed", departMs, arriveMs, progress: 1, minutesToGo: 0 };
  if (now >= departMs)
    return { phase: "Departed", departMs, arriveMs, progress: (now - departMs) / (arriveMs - departMs), minutesToGo: Math.ceil((arriveMs - now) / 60_000) };
  const toGo = Math.ceil((departMs - now) / 60_000);
  return { phase: toGo <= 45 ? "Boarding" : "Scheduled", departMs, arriveMs, progress: 0, minutesToGo: toGo };
}

export function durationLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}
