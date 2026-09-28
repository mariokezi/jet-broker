"use client";

import Link from "next/link";
import { Plane, PlaneLanding, PlaneTakeoff, Radio } from "lucide-react";
import { getAirportCity, getIATA } from "@/lib/airport-lookup";
import { durationLabel, flightStatus, type FlightPhase } from "@/lib/tracking";
import type { Booking } from "@/lib/types";

const PHASE_STYLE: Record<FlightPhase, string> = {
  Scheduled: "bg-slate-100 text-slate-600 border-slate-200",
  Boarding: "bg-amber-50 text-amber-700 border-amber-200",
  Departed: "bg-sky-50 text-sky-700 border-sky-200",
  Landed: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

const PHASE_LABEL: Record<FlightPhase, string> = { Scheduled: "Scheduled", Boarding: "Boarding", Departed: "In flight", Landed: "Landed" };

export function FlightStatusPill({ booking, now }: { booking: Booking; now: number }) {
  const st = flightStatus(booking, now);
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium ${PHASE_STYLE[st.phase]}`}>
      {st.phase === "Departed" && <span className="h-1.5 w-1.5 rounded-full bg-sky-500 animate-pulse" />}
      {PHASE_LABEL[st.phase]}
    </span>
  );
}

const time = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

/** Route bar with the aircraft's position, departure and arrival times, and what's next. */
export function FlightProgress({ booking, now, compact = false }: { booking: Booking; now: number; compact?: boolean }) {
  const st = flightStatus(booking, now);
  const pct = Math.round(st.progress * 100);
  const caption =
    st.phase === "Departed"
      ? `${durationLabel(st.minutesToGo)} to go · lands ${time(st.arriveMs)}`
      : st.phase === "Landed"
        ? `Landed ${time(st.arriveMs)}`
        : st.minutesToGo < 24 * 60
          ? `Departs in ${durationLabel(st.minutesToGo)}`
          : `Departs ${new Date(st.departMs).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}`;
  return (
    <div>
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className={`${compact ? "text-base" : "text-xl"} font-semibold text-navy-900`}>{getIATA(booking.origin)}</div>
          {!compact && <div className="text-[11px] text-slate-500">{getAirportCity(booking.origin)}</div>}
          <div className="text-[11px] text-slate-500 tabular-nums">{time(st.departMs)}</div>
        </div>
        <div className="text-right">
          <div className={`${compact ? "text-base" : "text-xl"} font-semibold text-navy-900`}>{getIATA(booking.destination)}</div>
          {!compact && <div className="text-[11px] text-slate-500">{getAirportCity(booking.destination)}</div>}
          <div className="text-[11px] text-slate-500 tabular-nums">{time(st.arriveMs)}</div>
        </div>
      </div>
      <div className="relative mt-3 h-1.5 rounded-full bg-slate-100">
        <div className={`absolute inset-y-0 left-0 rounded-full ${st.phase === "Landed" ? "bg-emerald-500" : "bg-sky-500"}`} style={{ width: `${pct}%` }} />
        <span
          className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white shadow ${st.phase === "Landed" ? "bg-emerald-500" : st.phase === "Departed" ? "bg-sky-500" : "bg-slate-300"}`}
          style={{ left: `${Math.min(97, Math.max(3, pct))}%` }}
        >
          <Plane className="h-3 w-3 text-white" />
        </span>
      </div>
      <div className="mt-2 text-xs text-slate-500">{caption}</div>
    </div>
  );
}

/** Tracking timeline for a booking: scheduled, wheels up, landed. */
export function TrackingTimeline({ booking, now }: { booking: Booking; now: number }) {
  const st = flightStatus(booking, now);
  const steps = [
    { icon: Radio, label: "Tracking on", sub: `${booking.tailNumber ?? booking.aircraft} · ${booking.operator}`, done: true },
    { icon: PlaneTakeoff, label: st.departMs <= now ? `Wheels up ${time(st.departMs)}` : `Wheels up ${time(st.departMs)} (scheduled)`, sub: getAirportCity(booking.origin), done: st.departMs <= now },
    { icon: PlaneLanding, label: st.arriveMs <= now ? `Landed ${time(st.arriveMs)}` : `Landing ${time(st.arriveMs)} (estimated)`, sub: getAirportCity(booking.destination), done: st.arriveMs <= now },
  ];
  return (
    <ol className="space-y-3">
      {steps.map((s) => (
        <li key={s.label} className="flex items-center gap-3">
          <span className={`flex h-8 w-8 items-center justify-center rounded-full ${s.done ? "bg-navy-900 text-white" : "bg-slate-100 text-slate-400"}`}>
            <s.icon className="h-4 w-4" />
          </span>
          <div>
            <div className={`text-sm ${s.done ? "font-medium text-navy-900" : "text-slate-500"}`}>{s.label}</div>
            <div className="text-xs text-slate-500">{s.sub}</div>
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Dashboard card: flights in the air now, then the next departures today. */
export function LiveFlights({ bookings, now }: { bookings: Booking[]; now: number }) {
  const live = bookings
    .filter((b) => {
      const st = flightStatus(b, now);
      return st.phase === "Departed" || st.phase === "Boarding" || (st.phase === "Landed" && now - st.arriveMs < 3 * 3_600_000) || (st.phase === "Scheduled" && st.departMs - now < 12 * 3_600_000);
    })
    .sort((a, b) => flightStatus(a, now).departMs - flightStatus(b, now).departMs);
  return (
    <div className="space-y-4">
      {live.length === 0 && <p className="text-sm text-slate-500">No flights in the air or departing in the next 12 hours.</p>}
      {live.map((b) => (
        <Link key={b.id} href={`/schedule?b=${b.id}`} className="block rounded-xl border border-slate-200 p-4 hover:border-navy-200 hover:bg-navy-50/40 transition-colors">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-navy-900">{b.clientName}</div>
              <div className="truncate text-xs text-slate-500">{b.aircraft} {b.tailNumber ? `· ${b.tailNumber}` : ""}</div>
            </div>
            <FlightStatusPill booking={b} now={now} />
          </div>
          <FlightProgress booking={b} now={now} compact />
        </Link>
      ))}
    </div>
  );
}
