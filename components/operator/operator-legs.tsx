"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { format, parseISO, formatDistanceToNow } from "date-fns";
import { Plus, Plane, Check, X, Handshake, Repeat, Sparkles } from "lucide-react";
import { useStore } from "../store-provider";
import { useOperator } from "./operator-shell";
import { PageHeader, Panel, btnPrimary, btnSecondary, btnGhost, inputCls, LoadingBlock } from "../ui-bits";
import { Field } from "./operator-fleet";
import { getIATA, getAirportCity, listAirports } from "@/lib/airport-lookup";
import { utcDatePlus } from "@/lib/demo-clock";
import { money } from "@/lib/money";
import { newId } from "@/lib/demo-state";
import { suggestQuote } from "@/lib/network";
import type { EmptyLeg } from "@/lib/empty-legs";
import type { Booking } from "@/lib/types";

type Draft = { aircraftId: string; origin: string; destination: string; earliest: string; latest: string; price: number; notes: string; sourceBookingId: string | null };

export function OperatorLegs() {
  const store = useStore();
  const account = useOperator();
  const params = useSearchParams();
  const [draft, setDraft] = useState<Draft | null>(null);
  if (!store) return <LoadingBlock />;
  const { state, now } = store;
  const today = new Date(now).toISOString().slice(0, 10);
  const fleet = state.fleet.filter((a) => a.operatorId === account.id);
  const legs = state.emptyLegs.filter((l) => l.operatorId === account.id).sort((a, b) => b.postedAt.localeCompare(a.postedAt));
  const pending = legs.filter((l) => l.status === "Pending");
  const highlight = params.get("leg");
  // Upcoming one way trips whose aircraft flies home empty: the best empty legs to sell
  const returns = state.bookings.filter(
    (b) => b.operator === account.company && b.date >= today && fleet.some((a) => a.tail === b.tailNumber) && !legs.some((l) => l.sourceBookingId === b.id)
  );

  function blank(): Draft {
    const ac = fleet[0];
    return { aircraftId: ac?.id ?? "", origin: ac?.base ?? account.base, destination: "KPBI", earliest: utcDatePlus(now, 1), latest: utcDatePlus(now, 2), price: 0, notes: "", sourceBookingId: null };
  }
  function fromBooking(b: Booking): Draft {
    const ac = fleet.find((a) => a.tail === b.tailNumber)!;
    const home = ac.base === b.destination ? b.origin : ac.base;
    const full = suggestQuote(ac, b.destination, home, 4).price;
    return {
      aircraftId: ac.id,
      origin: b.destination,
      destination: home,
      earliest: b.date,
      latest: utcDatePlus(Date.parse(`${b.date}T00:00:00Z`), 1),
      price: Math.round((full * 0.4) / 100) * 100,
      notes: `Empty return after a ${getIATA(b.origin)} to ${getIATA(b.destination)} drop.`,
      sourceBookingId: b.id,
    };
  }

  return (
    <div>
      <PageHeader
        title="Empty Legs"
        subtitle="Post a repositioning flight and every broker on the network sees it instantly. Claims come to you to confirm."
        actions={<button className={btnPrimary} onClick={() => setDraft(blank())} disabled={fleet.length === 0}><Plus className="h-4 w-4" /> Post empty leg</button>}
      />

      {pending.length > 0 && (
        <div className="mb-6 space-y-3">
          {pending.map((l) => (
            <div key={l.id} data-claim={l.id} className="flex flex-wrap items-center gap-4 rounded-2xl border border-gold-300 bg-gold-50 p-5 ring-4 ring-gold-100 animate-in fade-in slide-in-from-top-2 duration-500">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gold-400 text-navy-950"><Handshake className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-navy-900">
                  {state.settings.companyName} wants {getIATA(l.origin)} to {getIATA(l.destination)} for {l.claim?.clientName}
                </div>
                <div className="text-xs text-slate-600">
                  {l.aircraft}{l.tailNumber ? ` (${l.tailNumber})` : ""} · {money(l.askingPrice)} to you · requested {l.claim ? formatDistanceToNow(parseISO(l.claim.requestedAt), { addSuffix: true }) : ""}
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => store.respondToClaim(l.id, true)} className="inline-flex items-center gap-1.5 rounded-xl bg-navy-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy-800">
                  <Check className="h-4 w-4" /> Accept and book
                </button>
                <button onClick={() => store.respondToClaim(l.id, false)} className={btnSecondary}><X className="h-4 w-4" /> Decline</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.5fr_1fr]">
        <Panel title="Your posted legs">
          {legs.length === 0 ? (
            <p className="text-sm text-slate-500">Nothing posted yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {legs.map((l) => (
                <li key={l.id} className={`flex flex-wrap items-center gap-x-4 gap-y-2 py-3.5 ${highlight === l.id ? "rounded-xl bg-gold-50 px-3" : ""}`}>
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy-50 text-navy-700"><Repeat className="h-4 w-4" /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-sm font-semibold text-navy-900">
                      {getIATA(l.origin)} <Plane className="h-3.5 w-3.5 text-slate-400" /> {getIATA(l.destination)}
                      <span className="hidden text-xs font-normal text-slate-500 sm:inline">{getAirportCity(l.origin)} to {getAirportCity(l.destination)}</span>
                    </div>
                    <div className="text-xs text-slate-500">
                      {format(parseISO(l.earliest), "MMM d")}{l.latest !== l.earliest ? ` to ${format(parseISO(l.latest), "MMM d")}` : ""} · {l.aircraft}{l.tailNumber ? ` (${l.tailNumber})` : ""} · {l.seats} seats
                    </div>
                    {l.status === "Claimed" && l.claim && <div className="text-xs text-emerald-700">Sold to {state.settings.companyName} for {l.claim.clientName}</div>}
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold tabular-nums text-navy-900">{money(l.askingPrice)}</div>
                    <LegStatus status={l.status} />
                  </div>
                  {l.status === "Open" && (
                    <button className={btnGhost} onClick={() => store.setLegStatus(l.id, "Withdrawn")}>Withdraw</button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title={<span className="inline-flex items-center gap-2"><Sparkles className="h-4 w-4 text-gold-500" /> Empty returns to sell</span>}>
          {returns.length === 0 ? (
            <p className="text-sm text-slate-500">No upcoming trips fly home empty. When you win a one way trip, its return shows up here.</p>
          ) : (
            <ul className="space-y-2">
              {returns.map((b) => (
                <li key={b.id} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3">
                  <div className="min-w-0 flex-1 text-sm">
                    <div className="font-medium text-navy-900">{b.tailNumber} after {getIATA(b.origin)} to {getIATA(b.destination)}</div>
                    <div className="text-xs text-slate-500">{format(parseISO(b.date), "EEE, MMM d")} · {b.aircraft}</div>
                  </div>
                  <button className={btnSecondary} onClick={() => setDraft(fromBooking(b))}>Post return</button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {draft && <LegDialog initial={draft} onClose={() => setDraft(null)} />}
    </div>
  );
}

function LegStatus({ status }: { status: EmptyLeg["status"] }) {
  const cls = {
    Open: "text-emerald-700",
    Pending: "text-gold-700",
    Claimed: "text-navy-700",
    Withdrawn: "text-slate-400",
  }[status];
  return <div className={`text-[11px] font-medium ${cls}`}>{status === "Pending" ? "Claim waiting" : status === "Claimed" ? "Sold" : status}</div>;
}

function LegDialog({ initial, onClose }: { initial: Draft; onClose: () => void }) {
  const store = useStore()!;
  const account = useOperator();
  const fleet = store.state.fleet.filter((a) => a.operatorId === account.id);
  const [f, setF] = useState(initial);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setF((p) => ({ ...p, [k]: v }));
  const ac = fleet.find((a) => a.id === f.aircraftId) ?? null;
  const full = ac && f.origin !== f.destination ? suggestQuote(ac, f.origin, f.destination, 4).price : null;
  const valid = ac && f.origin && f.destination && f.origin !== f.destination && f.price > 0 && f.earliest <= f.latest;
  const airports = listAirports().map((a) => <option key={a.icao} value={a.icao}>{getIATA(a.icao)} · {a.city}</option>);

  function post() {
    if (!valid || !ac) return;
    store.postOperatorLeg(account.id, {
      id: newId("EL"),
      postedAt: new Date().toISOString(),
      postedBy: { name: account.contact, company: account.company, kind: "Operator" },
      isMine: false,
      origin: f.origin,
      destination: f.destination,
      earliest: f.earliest,
      latest: f.latest,
      aircraft: ac.model,
      category: ac.category,
      seats: ac.seats,
      tailNumber: ac.tail,
      askingPrice: f.price,
      notes: f.notes.trim() || null,
      status: "Open",
      claim: null,
      sourceBookingId: f.sourceBookingId,
      operatorId: account.id,
      aircraftId: ac.id,
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 backdrop-blur-sm p-4" onClick={onClose}>
      <div role="dialog" aria-label="Post empty leg" className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-semibold text-navy-900">Post an empty leg</h3>
        <p className="text-xs text-slate-500">Brokers on the network see it the moment you post.</p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Field label="Aircraft">
              <select aria-label="Aircraft" className={inputCls} value={f.aircraftId} onChange={(e) => set("aircraftId", e.target.value)}>
                {fleet.map((a) => <option key={a.id} value={a.id}>{a.tail} · {a.model} · {a.seats} seats</option>)}
              </select>
            </Field>
          </div>
          <Field label="From"><select aria-label="From" className={inputCls} value={f.origin} onChange={(e) => set("origin", e.target.value)}>{airports}</select></Field>
          <Field label="To"><select aria-label="To" className={inputCls} value={f.destination} onChange={(e) => set("destination", e.target.value)}>{airports}</select></Field>
          <Field label="Earliest"><input type="date" className={inputCls} value={f.earliest} onChange={(e) => set("earliest", e.target.value)} /></Field>
          <Field label="Latest"><input type="date" className={inputCls} value={f.latest} onChange={(e) => set("latest", e.target.value)} /></Field>
          <Field label="Asking price (USD)"><input aria-label="Asking price" type="number" min={0} step={100} className={inputCls} value={f.price || ""} onChange={(e) => set("price", Number(e.target.value))} /></Field>
          <div className="flex flex-col justify-end pb-2 text-[11px] text-slate-500">
            {full && (
              <>
                <span>Full charter on this route ~{money(full)}</span>
                <button type="button" className="text-left font-medium text-navy-700 hover:underline" onClick={() => set("price", Math.round((full * 0.4) / 100) * 100)}>
                  Use 60% off: {money(Math.round((full * 0.4) / 100) * 100)}
                </button>
              </>
            )}
          </div>
        </div>
        <div className="mt-3"><Field label="Notes"><textarea rows={2} className={inputCls} value={f.notes} onChange={(e) => set("notes", e.target.value)} /></Field></div>
        <div className="mt-5 flex justify-end gap-2">
          <button className={btnSecondary} onClick={onClose}>Cancel</button>
          <button className={btnPrimary} disabled={!valid} onClick={post}>Post to the network</button>
        </div>
      </div>
    </div>
  );
}
