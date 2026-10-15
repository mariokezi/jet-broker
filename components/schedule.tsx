"use client";

import { useMemo, useState } from "react";
import { addDays, format, parseISO } from "date-fns";
import Link from "next/link";
import { CheckCircle2, Circle, MessageSquare, Plane, Repeat } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { FlightProgress, FlightStatusPill, TrackingTimeline } from "./flight-tracker";
import { tripChannelId } from "@/lib/messaging";
import { flightStatus } from "@/lib/tracking";
import { useStore } from "./store-provider";
import { LoadingBlock, PageHeader, Panel } from "./ui-bits";
import { getAirportCity, getAirportName, getIATA, distanceNm } from "@/lib/airport-lookup";
import { money } from "@/lib/money";
import { categoryFromAircraft } from "@/lib/fleet";
import { AircraftArt } from "./brand";
import type { Booking, BookingStage } from "@/lib/types";

export function bookingStage(b: Booking, now: number): BookingStage {
  const done = (k: string) => b.checklist.find((c) => c.key === k)?.done;
  if (Date.parse(`${b.date}T23:59:00`) < now) return "Flown";
  if (done("operator") && done("crew") && done("payment")) return "Confirmed";
  if (done("payment")) return "Paid";
  return "Contracted";
}

const STAGE_STYLE: Record<BookingStage, string> = {
  Contracted: "bg-amber-50 border-amber-200 text-amber-700",
  Paid: "bg-navy-50 border-navy-200 text-navy-700",
  Confirmed: "bg-emerald-50 border-emerald-200 text-emerald-700",
  Flown: "bg-slate-50 border-slate-200 text-slate-500",
};

export function Schedule() {
  const store = useStore();
  const params = useSearchParams();
  const [selectedId, setSelectedId] = useState<string | null>(params.get("b"));

  const sorted = useMemo(
    () => (store ? [...store.state.bookings].sort((a, b) => (a.date + a.departureTime).localeCompare(b.date + b.departureTime)) : []),
    [store]
  );

  if (!store) return <LoadingBlock />;
  const { now } = store;
  const today = new Date(now);
  const todayIso = today.toISOString().slice(0, 10);
  const upcoming = sorted.filter((b) => b.date >= todayIso);
  const past = sorted.filter((b) => b.date < todayIso).reverse();
  const selected = sorted.find((b) => b.id === (selectedId ?? upcoming[0]?.id)) ?? null;
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i));

  return (
    <>
      <PageHeader
        title="Schedule"
        subtitle={`${upcoming.length} upcoming flight${upcoming.length === 1 ? "" : "s"} · ${money(upcoming.reduce((s, b) => s + b.clientPrice - b.operatorPrice, 0))} margin on the books`}
      />

      {/* Two week strip */}
      <div className="grid grid-cols-7 lg:grid-cols-14 gap-1.5 mb-6">
        {days.map((d) => {
          const iso = format(d, "yyyy-MM-dd");
          const flights = sorted.filter((b) => b.date === iso);
          const isToday = iso === todayIso;
          return (
            <div key={iso} className={`rounded-lg border p-2 min-h-[76px] ${isToday ? "border-navy-200 bg-navy-50" : "border-slate-200 bg-white"}`}>
              <div className="flex items-baseline justify-between">
                <span className="text-[10px] uppercase text-slate-500">{format(d, "EEE")}</span>
                <span className={`text-sm font-semibold ${isToday ? "text-navy-700" : "text-slate-700"}`}>{format(d, "d")}</span>
              </div>
              <div className="mt-1 space-y-1">
                {flights.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => setSelectedId(b.id)}
                    className={`w-full truncate rounded px-1 py-0.5 text-left text-[10px] font-medium border ${STAGE_STYLE[bookingStage(b, now)]} ${selected?.id === b.id ? "ring-1 ring-slate-300" : ""}`}
                    title={`${b.clientName}: ${b.origin} to ${b.destination}`}
                  >
                    {getIATA(b.origin)}-{getIATA(b.destination)}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_400px]">
        <div className="space-y-6 min-w-0">
          <FlightList title="Upcoming" bookings={upcoming} selectedId={selected?.id ?? null} onSelect={setSelectedId} now={now} />
          {past.length > 0 && <FlightList title="Completed (last 30 days)" bookings={past} selectedId={selected?.id ?? null} onSelect={setSelectedId} now={now} />}
        </div>
        {selected && <BookingDetail booking={selected} />}
      </div>
    </>
  );
}

function FlightList({ title, bookings, selectedId, onSelect, now }: { title: string; bookings: Booking[]; selectedId: string | null; onSelect: (id: string) => void; now: number }) {
  return (
    <Panel title={title}>
      {bookings.length === 0 ? (
        <p className="text-sm text-slate-500">No flights.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {bookings.map((b) => {
            const stage = bookingStage(b, now);
            const done = b.checklist.filter((c) => c.done).length;
            return (
              <li key={b.id}>
                <button onClick={() => onSelect(b.id)} className={`w-full flex items-center gap-4 py-3 px-2 -mx-2 rounded-lg text-left transition-colors ${selectedId === b.id ? "bg-slate-50" : "hover:bg-slate-50"}`}>
                  <div className="w-12 text-center shrink-0">
                    <div className="text-[10px] uppercase text-slate-500">{format(parseISO(b.date), "MMM")}</div>
                    <div className="text-lg font-semibold text-slate-900 leading-tight">{format(parseISO(b.date), "d")}</div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-slate-800">
                      {getIATA(b.origin)} &rarr; {getIATA(b.destination)}
                      <span className="text-slate-500"> &middot; {b.departureTime} &middot; {b.clientName}</span>
                    </div>
                    <div className="text-xs text-slate-500 truncate">{b.aircraft} {b.tailNumber && `(${b.tailNumber})`} &middot; {b.operator}</div>
                  </div>
                  <div className="text-right shrink-0 space-y-1">
                    {(() => {
                      const ph = flightStatus(b, now).phase;
                      return ph === "Departed" || ph === "Boarding" || (ph === "Landed" && now - flightStatus(b, now).arriveMs < 6 * 3_600_000) ? (
                        <div><FlightStatusPill booking={b} now={now} /></div>
                      ) : null;
                    })()}
                    <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-medium ${STAGE_STYLE[stage]}`}>{stage}</span>
                    <div className="text-[10px] text-slate-500 tabular-nums">{done}/{b.checklist.length} ops</div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

function BookingDetail({ booking: b }: { booking: Booking }) {
  const store = useStore()!;
  const stage = bookingStage(b, store.now);
  const dist = distanceNm(b.origin, b.destination);
  const done = b.checklist.filter((c) => c.done).length;

  return (
    <Panel title={`Booking ${b.id}`} action={<span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${STAGE_STYLE[stage]}`}>{stage}</span>} className="h-fit lg:sticky lg:top-20">
      <div className="flex items-center gap-3 mb-4">
        <div>
          <div className="text-xl font-semibold text-slate-900">{getIATA(b.origin)}</div>
          <div className="text-[11px] text-slate-500">{getAirportCity(b.origin)}</div>
        </div>
        <div className="flex-1 flex items-center gap-1.5 text-slate-400">
          <div className="h-px flex-1 bg-slate-100" />
          <Plane className="h-3.5 w-3.5 text-navy-700" />
          <div className="h-px flex-1 bg-slate-100" />
        </div>
        <div className="text-right">
          <div className="text-xl font-semibold text-slate-900">{getIATA(b.destination)}</div>
          <div className="text-[11px] text-slate-500">{getAirportCity(b.destination)}</div>
        </div>
      </div>

      <AircraftArt category={categoryFromAircraft(b.aircraft) ?? "Midsize Jet"} className="mb-4 h-32" />
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs mb-4">
        <Row label="Date" value={format(parseISO(b.date), "EEE, MMM d, yyyy")} />
        <Row label="Wheels up" value={`${b.departureTime} local`} />
        <Row label="Client" value={b.clientName} />
        <Row label="Passengers" value={b.pax ? String(b.pax) : "TBD"} />
        <Row label="Aircraft" value={`${b.aircraft}${b.tailNumber ? ` · ${b.tailNumber}` : ""}`} />
        <Row label="Operator" value={b.operator} />
        <Row label="Departs" value={getAirportName(b.origin)} />
        <Row label="Distance" value={dist ? `${dist.toLocaleString()} nm` : "—"} />
      </dl>

      <div className="grid grid-cols-3 gap-2 mb-4">
        <Money label="Client" value={b.clientPrice} />
        <Money label="Operator" value={b.operatorPrice} />
        <Money label="Margin" value={b.clientPrice - b.operatorPrice} accent />
      </div>

      <div className="mb-4 rounded-xl border border-slate-200 p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wider text-slate-500">Flight tracking</span>
          <FlightStatusPill booking={b} now={store.now} />
        </div>
        <FlightProgress booking={b} now={store.now} />
        <div className="mt-4 border-t border-slate-100 pt-4">
          <TrackingTimeline booking={b} now={store.now} />
        </div>
        <label className="mt-4 flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
          Text {b.clientName.split(" ")[0]} at wheels up and landing
          <input type="checkbox" checked={!!b.tracking?.notifyClient} onChange={() => store.toggleNotifyClient(b.id)} className="h-4 w-4 accent-[#0e1f3a]" />
        </label>
        <Link href={`/messages?c=${tripChannelId(b.id)}`} className="mt-2 flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-navy-900 hover:bg-slate-50">
          <MessageSquare className="h-3.5 w-3.5" /> Open trip channel
        </Link>
      </div>

      {stage !== "Flown" && (() => {
        const posted = store.state.emptyLegs.find((l) => l.sourceBookingId === b.id && l.status !== "Withdrawn");
        return posted ? (
          <Link href={`/empty-legs?leg=${posted.id}`} className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700 hover:bg-emerald-50">
            <Repeat className="h-3.5 w-3.5" /> Empty return posted to the network ({posted.status.toLowerCase()})
          </Link>
        ) : (
          <Link href={`/empty-legs?post=${b.id}`} className="mb-4 flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900">
            <Repeat className="h-3.5 w-3.5" /> Post empty return {getIATA(b.destination)} to {getIATA(b.origin)} to the network
          </Link>
        );
      })()}

      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Ops checklist</span>
        <span className="text-xs text-slate-500 tabular-nums">{done}/{b.checklist.length}</span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-50 overflow-hidden mb-3">
        <div className="h-full bg-emerald-100 transition-all" style={{ width: `${(done / b.checklist.length) * 100}%` }} />
      </div>
      <ul className="space-y-1">
        {b.checklist.map((c) => (
          <li key={c.key}>
            <button
              onClick={() => {
                store.toggleChecklist(b.id, c.key);
                if (!c.done) store.log({ kind: "ops", text: `${b.id}: ${c.label.toLowerCase()}`, href: "/schedule" });
              }}
              className="w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-slate-50"
            >
              {c.done ? <CheckCircle2 className="h-4 w-4 text-emerald-700" /> : <Circle className="h-4 w-4 text-slate-400" />}
              <span className={c.done ? "text-slate-500 line-through" : "text-slate-800"}>{c.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-slate-800">{value}</dd>
    </div>
  );
}

function Money({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className={`rounded-lg border px-2.5 py-2 ${accent ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-white"}`}>
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`text-sm font-semibold tabular-nums ${accent ? "text-emerald-700" : "text-slate-900"}`}>{money(value)}</div>
    </div>
  );
}
