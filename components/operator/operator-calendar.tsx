"use client";

import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { utcDatePlus } from "@/lib/demo-clock";
import { ChevronLeft, ChevronRight, Lock, Plane, Repeat, Trash2 } from "lucide-react";
import { useStore } from "../store-provider";
import { useOperator } from "./operator-shell";
import { PageHeader, Panel, btnPrimary, btnSecondary, btnGhost, inputCls, LoadingBlock } from "../ui-bits";
import { Field } from "./operator-fleet";
import { getIATA, getAirportCity } from "@/lib/airport-lookup";
import { money } from "@/lib/money";
import { newId } from "@/lib/demo-state";
import type { AvailabilityBlock, BlockReason, FleetAircraft } from "@/lib/network";
import type { Booking } from "@/lib/types";

const DAYS = 21;
const iso = (d: Date) => d.toISOString().slice(0, 10);

export function OperatorCalendar() {
  const store = useStore();
  const account = useOperator();
  const [offset, setOffset] = useState(0);
  const [adding, setAdding] = useState<{ aircraftId: string; date: string } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const today = store ? iso(new Date(store.now)) : "";
  const days = useMemo(() => {
    if (!today) return [];
    const start = Date.parse(`${today}T00:00:00Z`);
    return Array.from({ length: DAYS }, (_, i) => utcDatePlus(start, offset + i));
  }, [today, offset]);

  if (!store) return <LoadingBlock />;
  const api = store;
  const { state } = store;
  const fleet = state.fleet.filter((a) => a.operatorId === account.id);
  const tails = new Set(fleet.map((a) => a.tail));
  const bookings = state.bookings.filter((b) => b.operator === account.company).sort((a, b) => a.date.localeCompare(b.date));
  const unassigned = bookings.filter((b) => !b.tailNumber || !tails.has(b.tailNumber));
  const legs = state.emptyLegs.filter((l) => l.operatorId === account.id && l.status !== "Withdrawn");
  const blocks = state.blocks.filter((b) => fleet.some((a) => a.id === b.aircraftId));
  const upcoming = bookings.filter((b) => b.date >= today);
  const first = days[0];
  const last = days[days.length - 1];
  const col = (date: string) => days.indexOf(date) + 1;
  const span = (start: string, end: string) => {
    const s = start < first ? first : start;
    const e = end > last ? last : end;
    if (s > last || e < first) return null;
    return { gridColumn: `${col(s)} / ${col(e) + 1}`, gridRow: 1 };
  };
  const selectedBooking = bookings.find((b) => b.id === selected);

  function row(key: string, label: React.ReactNode, ac: FleetAircraft | null, rowBookings: Booking[]) {
    return (
      <div key={key} className="grid grid-cols-[112px_1fr] sm:grid-cols-[180px_1fr] border-t border-slate-100">
        <div className="sticky left-0 z-10 flex items-center bg-white px-4 py-3">{label}</div>
        <div className="grid py-2" style={{ gridTemplateColumns: `repeat(${DAYS}, minmax(36px, 1fr))` }}>
          {days.map((d, i) => (
            <button
              key={d}
              aria-label={ac ? `Block ${ac.tail} on ${d}` : undefined}
              disabled={!ac}
              onClick={() => ac && setAdding({ aircraftId: ac.id, date: d })}
              className={`h-11 border-l border-slate-100 ${d === today ? "bg-gold-50" : [0, 6].includes(parseISO(d).getDay()) ? "bg-slate-50/70" : ""} ${ac ? "hover:bg-navy-50" : ""}`}
              style={{ gridColumn: i + 1, gridRow: 1 }}
            />
          ))}
          {ac &&
            blocks
              .filter((b) => b.aircraftId === ac.id)
              .map((b) => {
                const pos = span(b.start, b.end);
                return pos ? (
                  <button
                    key={b.id}
                    title={`${b.reason}${b.note ? `: ${b.note}` : ""}. Click to remove.`}
                    onClick={() => confirm(`Remove the ${b.reason.toLowerCase()} block on ${ac.tail}?`) && api.removeBlock(b.id)}
                    className="z-[1] mx-0.5 my-1 flex items-center gap-1 overflow-hidden rounded-lg border border-slate-300 px-2 text-[11px] font-medium text-slate-600"
                    style={{ ...pos, backgroundImage: "repeating-linear-gradient(135deg, #f1f5f9 0 6px, #e2e8f0 6px 12px)" }}
                  >
                    <Lock className="h-3 w-3 shrink-0" /> {b.end > b.start && <span className="truncate">{b.reason}</span>}
                  </button>
                ) : null;
              })}
          {ac &&
            legs
              .filter((l) => l.aircraftId === ac.id || (!l.aircraftId && l.tailNumber === ac.tail))
              .map((l) => {
                const pos = span(l.earliest, l.latest);
                return pos ? (
                  <div key={l.id} className="z-[1] mx-0.5 my-1 flex items-center gap-1 overflow-hidden rounded-lg border border-dashed border-gold-500 bg-gold-50 px-2 text-[11px] font-medium text-gold-700" style={pos} title={`Empty leg ${l.status}`}>
                    <Repeat className="h-3 w-3 shrink-0" /> <span className="truncate">Empty leg {getIATA(l.origin)}-{getIATA(l.destination)}</span>
                  </div>
                ) : null;
              })}
          {rowBookings.map((b) => {
            const pos = span(b.date, b.date);
            return pos ? (
              <button
                key={b.id}
                data-booking={b.id}
                onClick={() => setSelected(b.id)}
                title={`${b.clientName}: ${getIATA(b.origin)} to ${getIATA(b.destination)}`}
                className={`z-[2] mx-0.5 my-1 flex items-center justify-center overflow-hidden rounded-lg px-0.5 text-[9px] font-semibold leading-[1.15] text-white shadow-sm ${b.id === selected ? "bg-gold-500 ring-2 ring-gold-300" : "bg-navy-900 hover:bg-navy-800"}`}
                style={pos}
              >
                <span className="text-center">{getIATA(b.origin)}<br />{getIATA(b.destination)}</span>
              </button>
            ) : null;
          })}
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Calendar"
        subtitle="Booked trips land here automatically. Click any open day to block an aircraft."
        actions={
          <>
            <button className={btnSecondary} onClick={() => setOffset((o) => o - 7)} aria-label="Previous week"><ChevronLeft className="h-4 w-4" /></button>
            <button className={btnSecondary} onClick={() => setOffset(0)}>Today</button>
            <button className={btnSecondary} onClick={() => setOffset((o) => o + 7)} aria-label="Next week"><ChevronRight className="h-4 w-4" /></button>
          </>
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-4 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-5 rounded bg-navy-900" /> Booked trip</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-5 rounded border border-slate-300" style={{ backgroundImage: "repeating-linear-gradient(135deg, #f1f5f9 0 4px, #e2e8f0 4px 8px)" }} /> Blocked</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-5 rounded border border-dashed border-gold-500 bg-gold-50" /> Empty leg for sale</span>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(14,31,58,0.04),0_8px_24px_-12px_rgba(14,31,58,0.08)]">
        <div className="min-w-[880px]">
          <div className="grid grid-cols-[112px_1fr] sm:grid-cols-[180px_1fr]">
            <div className="sticky left-0 z-10 bg-white px-4 py-3 text-xs font-medium text-slate-500">
              {days.length > 0 && `${format(parseISO(first), "MMM d")} to ${format(parseISO(last), "MMM d")}`}
            </div>
            <div className="grid" style={{ gridTemplateColumns: `repeat(${DAYS}, minmax(36px, 1fr))` }}>
              {days.map((d) => (
                <div key={d} className={`py-2 text-center ${d === today ? "text-gold-700" : "text-slate-500"}`}>
                  <div className="text-[10px] uppercase">{format(parseISO(d), "EEEEE")}</div>
                  <div className={`mx-auto mt-0.5 flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${d === today ? "bg-gold-400 text-navy-950" : ""}`}>{format(parseISO(d), "d")}</div>
                </div>
              ))}
            </div>
          </div>
          {fleet.map((ac) =>
            row(
              ac.id,
              <div className="leading-tight">
                <div className="font-mono text-sm font-semibold text-navy-900">{ac.tail}</div>
                <div className="text-[11px] text-slate-500">{ac.model}</div>
              </div>,
              ac,
              bookings.filter((b) => b.tailNumber === ac.tail)
            )
          )}
          {unassigned.length > 0 &&
            row("unassigned", <div className="text-xs font-medium text-slate-500">Other tails</div>, null, unassigned)}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel title="Upcoming trips" action={<span className="text-xs text-slate-500">{upcoming.length} booked · {money(upcoming.reduce((s, b) => s + b.operatorPrice, 0))}</span>}>
          {upcoming.length === 0 ? (
            <p className="text-sm text-slate-500">No upcoming trips yet. Win a request and it lands here.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {upcoming.map((b) => (
                <li key={b.id}>
                  <button onClick={() => setSelected(b.id)} className={`flex w-full items-center gap-3 py-3 text-left ${b.id === selected ? "text-gold-700" : ""}`}>
                    <span className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-xl bg-navy-50 text-navy-900">
                      <span className="text-[9px] uppercase leading-none">{format(parseISO(b.date), "MMM")}</span>
                      <span className="text-sm font-semibold leading-none">{format(parseISO(b.date), "d")}</span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-navy-900">{getIATA(b.origin)} to {getIATA(b.destination)} · {b.departureTime}</span>
                      <span className="block truncate text-xs text-slate-500">{b.aircraft}{b.tailNumber ? ` (${b.tailNumber})` : ""} · {b.pax ?? "?"} pax · via JetBroker</span>
                    </span>
                    <span className="text-sm font-semibold tabular-nums text-navy-900">{money(b.operatorPrice)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title={selectedBooking ? `Trip ${selectedBooking.id}` : "Trip details"}>
          {selectedBooking ? (
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-3 text-xl font-semibold text-navy-900">
                {getIATA(selectedBooking.origin)} <Plane className="h-5 w-5 text-gold-500" /> {getIATA(selectedBooking.destination)}
              </div>
              <p className="text-slate-500">{getAirportCity(selectedBooking.origin)} to {getAirportCity(selectedBooking.destination)}</p>
              <dl className="grid grid-cols-2 gap-3">
                <Item k="Date" v={`${format(parseISO(selectedBooking.date), "EEE, MMM d")} · ${selectedBooking.departureTime}`} />
                <Item k="Aircraft" v={`${selectedBooking.aircraft}${selectedBooking.tailNumber ? ` · ${selectedBooking.tailNumber}` : ""}`} />
                <Item k="Passengers" v={String(selectedBooking.pax ?? "TBC")} />
                <Item k="Payout to you" v={money(selectedBooking.operatorPrice)} />
                <Item k="Broker" v={state.settings.companyName} />
                <Item k="Broker contact" v={`${state.settings.brokerName} · ${state.settings.brokerPhone}`} />
              </dl>
            </div>
          ) : (
            <p className="text-sm text-slate-500">Click a trip on the calendar to see it here.</p>
          )}
        </Panel>
      </div>

      {blocks.length > 0 && (
        <Panel title="Blocked dates" className="mt-6">
          <ul className="divide-y divide-slate-100">
            {blocks
              .slice()
              .sort((a, b) => a.start.localeCompare(b.start))
              .map((b) => {
                const ac = fleet.find((a) => a.id === b.aircraftId)!;
                return (
                  <li key={b.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-sm">
                    <Lock className="h-4 w-4 text-slate-400" />
                    <span className="font-mono font-semibold text-navy-900">{ac.tail}</span>
                    <span className="text-slate-600">{b.reason}{b.note ? ` · ${b.note}` : ""}</span>
                    <span className="ml-auto text-xs text-slate-500">{format(parseISO(b.start), "MMM d")}{b.end !== b.start ? ` to ${format(parseISO(b.end), "MMM d")}` : ""}</span>
                    <button className={btnGhost} onClick={() => store.removeBlock(b.id)} aria-label="Remove block"><Trash2 className="h-3.5 w-3.5" /></button>
                  </li>
                );
              })}
          </ul>
        </Panel>
      )}

      {adding && <BlockDialog aircraft={fleet.find((a) => a.id === adding.aircraftId)!} date={adding.date} onClose={() => setAdding(null)} />}
    </div>
  );
}

function Item({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wider text-slate-400">{k}</dt>
      <dd className="text-navy-900">{v}</dd>
    </div>
  );
}

function BlockDialog({ aircraft, date, onClose }: { aircraft: FleetAircraft; date: string; onClose: () => void }) {
  const store = useStore()!;
  const [end, setEnd] = useState(date);
  const [reason, setReason] = useState<BlockReason>("Maintenance");
  const [note, setNote] = useState("");
  const clash = store.state.bookings.find((b) => b.tailNumber === aircraft.tail && b.date >= date && b.date <= end);

  function save() {
    const block: AvailabilityBlock = { id: newId("BL"), aircraftId: aircraft.id, start: date, end, reason, note: note.trim() || null };
    store.addBlock(block);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 backdrop-blur-sm p-4" onClick={onClose}>
      <div role="dialog" aria-label="Block dates" className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-semibold text-navy-900">Block {aircraft.tail}</h3>
        <p className="text-xs text-slate-500">{aircraft.model}. Brokers can still send requests, but this aircraft shows as unavailable.</p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Field label="From"><input type="date" className={inputCls} value={date} disabled /></Field>
          <Field label="To"><input aria-label="Block until" type="date" className={inputCls} min={date} value={end} onChange={(e) => setEnd(e.target.value < date ? date : e.target.value)} /></Field>
          <Field label="Reason">
            <select aria-label="Reason" className={inputCls} value={reason} onChange={(e) => setReason(e.target.value as BlockReason)}>
              {(["Maintenance", "Owner use", "Crew rest", "Other"] as BlockReason[]).map((r) => <option key={r}>{r}</option>)}
            </select>
          </Field>
          <Field label="Note"><input className={inputCls} placeholder="Optional" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        </div>
        {clash && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">Heads up: {aircraft.tail} is booked {getIATA(clash.origin)} to {getIATA(clash.destination)} on {format(parseISO(clash.date), "MMM d")}.</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button className={btnSecondary} onClick={onClose}>Cancel</button>
          <button className={btnPrimary} onClick={save}>Block dates</button>
        </div>
      </div>
    </div>
  );
}
