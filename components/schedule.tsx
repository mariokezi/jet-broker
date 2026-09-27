"use client";

import { useMemo, useState } from "react";
import { addDays, format, parseISO } from "date-fns";
import Link from "next/link";
import { CheckCircle2, Circle, Plane, Repeat } from "lucide-react";
import { useStore } from "./store-provider";
import { LoadingBlock, PageHeader, Panel } from "./ui-bits";
import { getAirportCity, getAirportName, getIATA, distanceNm } from "@/lib/airport-lookup";
import { money } from "@/lib/money";
import type { Booking, BookingStage } from "@/lib/types";

export function bookingStage(b: Booking, now: number): BookingStage {
  const done = (k: string) => b.checklist.find((c) => c.key === k)?.done;
  if (Date.parse(`${b.date}T23:59:00`) < now) return "Flown";
  if (done("operator") && done("crew") && done("payment")) return "Confirmed";
  if (done("payment")) return "Paid";
  return "Contracted";
}

const STAGE_STYLE: Record<BookingStage, string> = {
  Contracted: "bg-amber-500/10 border-amber-500/25 text-amber-300",
  Paid: "bg-blue-500/10 border-blue-500/25 text-blue-300",
  Confirmed: "bg-emerald-500/10 border-emerald-500/25 text-emerald-300",
  Flown: "bg-white/5 border-white/10 text-white/45",
};

export function Schedule() {
  const store = useStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);

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
            <div key={iso} className={`rounded-lg border p-2 min-h-[76px] ${isToday ? "border-blue-500/30 bg-blue-500/[0.06]" : "border-white/[0.05] bg-white/[0.015]"}`}>
              <div className="flex items-baseline justify-between">
                <span className="text-[10px] uppercase text-white/35">{format(d, "EEE")}</span>
                <span className={`text-sm font-semibold ${isToday ? "text-blue-300" : "text-white/70"}`}>{format(d, "d")}</span>
              </div>
              <div className="mt-1 space-y-1">
                {flights.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => setSelectedId(b.id)}
                    className={`w-full truncate rounded px-1 py-0.5 text-left text-[10px] font-medium border ${STAGE_STYLE[bookingStage(b, now)]} ${selected?.id === b.id ? "ring-1 ring-white/40" : ""}`}
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

      <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
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
        <p className="text-sm text-white/35">No flights.</p>
      ) : (
        <ul className="divide-y divide-white/[0.04]">
          {bookings.map((b) => {
            const stage = bookingStage(b, now);
            const done = b.checklist.filter((c) => c.done).length;
            return (
              <li key={b.id}>
                <button onClick={() => onSelect(b.id)} className={`w-full flex items-center gap-4 py-3 px-2 -mx-2 rounded-lg text-left transition-colors ${selectedId === b.id ? "bg-white/[0.04]" : "hover:bg-white/[0.02]"}`}>
                  <div className="w-12 text-center shrink-0">
                    <div className="text-[10px] uppercase text-white/35">{format(parseISO(b.date), "MMM")}</div>
                    <div className="text-lg font-semibold text-white leading-tight">{format(parseISO(b.date), "d")}</div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-white/85">
                      {getIATA(b.origin)} &rarr; {getIATA(b.destination)}
                      <span className="text-white/35"> &middot; {b.departureTime} &middot; {b.clientName}</span>
                    </div>
                    <div className="text-xs text-white/35 truncate">{b.aircraft} {b.tailNumber && `(${b.tailNumber})`} &middot; {b.operator}</div>
                  </div>
                  <div className="text-right shrink-0 space-y-1">
                    <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-medium ${STAGE_STYLE[stage]}`}>{stage}</span>
                    <div className="text-[10px] text-white/35 tabular-nums">{done}/{b.checklist.length} ops</div>
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
          <div className="text-xl font-semibold text-white">{getIATA(b.origin)}</div>
          <div className="text-[11px] text-white/40">{getAirportCity(b.origin)}</div>
        </div>
        <div className="flex-1 flex items-center gap-1.5 text-white/20">
          <div className="h-px flex-1 bg-white/10" />
          <Plane className="h-3.5 w-3.5 text-blue-300/70" />
          <div className="h-px flex-1 bg-white/10" />
        </div>
        <div className="text-right">
          <div className="text-xl font-semibold text-white">{getIATA(b.destination)}</div>
          <div className="text-[11px] text-white/40">{getAirportCity(b.destination)}</div>
        </div>
      </div>

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

      {stage !== "Flown" && (() => {
        const posted = store.state.emptyLegs.find((l) => l.sourceBookingId === b.id && l.status !== "Withdrawn");
        return posted ? (
          <Link href={`/empty-legs?leg=${posted.id}`} className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.05] px-3 py-2 text-xs text-emerald-200 hover:bg-emerald-500/10">
            <Repeat className="h-3.5 w-3.5" /> Empty return posted to the network ({posted.status.toLowerCase()})
          </Link>
        ) : (
          <Link href={`/empty-legs?post=${b.id}`} className="mb-4 flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-white/75 hover:bg-white/10 hover:text-white">
            <Repeat className="h-3.5 w-3.5" /> Post empty return {getIATA(b.destination)} to {getIATA(b.origin)} to the network
          </Link>
        );
      })()}

      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-white/45 uppercase tracking-wider">Ops checklist</span>
        <span className="text-xs text-white/40 tabular-nums">{done}/{b.checklist.length}</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden mb-3">
        <div className="h-full bg-emerald-400/80 transition-all" style={{ width: `${(done / b.checklist.length) * 100}%` }} />
      </div>
      <ul className="space-y-1">
        {b.checklist.map((c) => (
          <li key={c.key}>
            <button
              onClick={() => {
                store.toggleChecklist(b.id, c.key);
                if (!c.done) store.log({ kind: "ops", text: `${b.id}: ${c.label.toLowerCase()}`, href: "/schedule" });
              }}
              className="w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-white/[0.03]"
            >
              {c.done ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <Circle className="h-4 w-4 text-white/25" />}
              <span className={c.done ? "text-white/45 line-through" : "text-white/80"}>{c.label}</span>
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
      <dt className="text-white/35">{label}</dt>
      <dd className="text-white/80">{value}</dd>
    </div>
  );
}

function Money({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className={`rounded-lg border px-2.5 py-2 ${accent ? "border-emerald-500/20 bg-emerald-500/[0.05]" : "border-white/[0.06] bg-white/[0.02]"}`}>
      <div className="text-[10px] uppercase tracking-wider text-white/35">{label}</div>
      <div className={`text-sm font-semibold tabular-nums ${accent ? "text-emerald-300" : "text-white"}`}>{money(value)}</div>
    </div>
  );
}
