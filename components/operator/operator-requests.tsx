"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { formatDistanceToNow, parseISO, format } from "date-fns";
import { ArrowRight, Check, CheckCircle2, Clock, Plane, Send, Users, X, Zap, CircleSlash, Trophy } from "lucide-react";
import { useStore } from "../store-provider";
import { useOperator } from "./operator-shell";
import { AircraftArt } from "../brand";
import { PageHeader, Panel, btnSecondary, inputCls, LoadingBlock } from "../ui-bits";
import { getAirportCity, getIATA } from "@/lib/airport-lookup";
import { money } from "@/lib/money";
import { aircraftConflict, suggestQuote, type FleetAircraft, type RfqRequest } from "@/lib/network";

type Tab = "open" | "answered" | "all";

export function requestState(r: RfqRequest, operatorId: string, today: string, booked: boolean) {
  const resp = r.responses[operatorId];
  if (booked) return "Won" as const;
  if (resp?.status === "Quoted") return "Quoted" as const;
  if (resp?.status === "Declined") return "Declined" as const;
  if (r.date < today) return "Expired" as const;
  return "Open" as const;
}

const PILL: Record<ReturnType<typeof requestState>, string> = {
  Open: "bg-gold-100 text-gold-700 border-gold-200",
  Quoted: "bg-navy-50 text-navy-700 border-navy-200",
  Won: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Declined: "bg-slate-50 text-slate-500 border-slate-200",
  Expired: "bg-white text-slate-400 border-slate-200",
};

export function OperatorRequests() {
  const store = useStore();
  const account = useOperator();
  const router = useRouter();
  const params = useSearchParams();
  const [tab, setTab] = useState<Tab>("open");
  const selectedId = params.get("r");

  const data = useMemo(() => {
    if (!store) return null;
    const today = new Date(store.now).toISOString().slice(0, 10);
    const mine = store.state.rfqRequests
      .filter((r) => r.to.includes(account.id))
      .map((r) => {
        const booked = store.state.bookings.some((b) => b.tripId === r.tripId && b.operator === account.company);
        return { r, state: requestState(r, account.id, today, booked) };
      })
      .sort((a, b) => b.r.sentAt.localeCompare(a.r.sentAt));
    return { today, mine };
  }, [store, account]);

  const selected = data?.mine.find((x) => x.r.id === selectedId) ?? null;
  const markRequestSeen = store?.markRequestSeen;
  useEffect(() => {
    if (selected && !selected.r.seenBy[account.id]) markRequestSeen?.(selected.r.id, account.id);
  }, [selected, account.id, markRequestSeen]);

  if (!store || !data) return <LoadingBlock />;

  const list = data.mine.filter((x) => (tab === "open" ? x.state === "Open" : tab === "answered" ? x.state === "Quoted" || x.state === "Won" || x.state === "Declined" : true));
  const counts = {
    open: data.mine.filter((x) => x.state === "Open").length,
    answered: data.mine.filter((x) => ["Quoted", "Won", "Declined"].includes(x.state)).length,
    all: data.mine.length,
  };
  const select = (id: string) => router.replace(`/operator/requests?r=${id}`, { scroll: false });

  return (
    <div>
      <PageHeader title="Requests" subtitle="Charter requests from brokers on the network. Quote in one click with your own rates." />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[380px_1fr]">
        <div>
          <div className="mb-3 inline-flex rounded-xl border border-slate-200 bg-white p-1 text-sm">
            {(["open", "answered", "all"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-lg px-3 py-1.5 font-medium capitalize transition-colors ${tab === t ? "bg-navy-900 text-white" : "text-slate-500 hover:text-navy-900"}`}
              >
                {t} <span className="opacity-60 tabular-nums">{counts[t]}</span>
              </button>
            ))}
          </div>
          <div className="space-y-2">
            {list.length === 0 && (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-8 text-center text-sm text-slate-500">
                {tab === "open" ? "You're all caught up. New broker requests appear here instantly." : "Nothing here yet."}
              </div>
            )}
            {list.map(({ r, state }) => {
              const unseen = !r.seenBy[account.id] && state === "Open";
              const active = r.id === selectedId;
              return (
                <button
                  key={r.id}
                  data-request-id={r.id}
                  onClick={() => select(r.id)}
                  className={`w-full rounded-2xl border p-4 text-left transition-all animate-in fade-in slide-in-from-top-2 duration-500 ${
                    active ? "border-navy-900 bg-white shadow-md ring-1 ring-navy-900" : unseen ? "border-gold-300 bg-gold-50/60 shadow-sm hover:border-gold-400" : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {unseen && (
                      <span className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold-500 opacity-75" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-gold-500" />
                      </span>
                    )}
                    <span className="font-semibold text-navy-900">{getIATA(r.origin)}</span>
                    <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
                    <span className="font-semibold text-navy-900">{getIATA(r.destination)}</span>
                    <span className={`ml-auto rounded-full border px-2 py-0.5 text-[11px] font-medium ${PILL[state]}`}>
                      {state === "Quoted" && r.responses[account.id]?.price ? `Quoted ${money(r.responses[account.id].price)}` : state}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {format(parseISO(r.date), "EEE, MMM d")} · {r.pax ?? "?"} pax · {r.category ?? "Any aircraft"}
                  </div>
                  <div className="mt-1 text-[11px] text-slate-400">
                    {r.broker.company} · {formatDistanceToNow(parseISO(r.sentAt), { addSuffix: true })}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          {selected ? (
            <RequestDetail key={selected.r.id} request={selected.r} state={selected.state} />
          ) : (
            <div className="flex h-full min-h-[320px] items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white/60 p-10 text-center">
              <div>
                <Plane className="mx-auto h-8 w-8 text-slate-300" />
                <p className="mt-3 text-sm text-slate-500">Pick a request to see the trip and send a quote.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function RequestDetail({ request: r, state }: { request: RfqRequest; state: ReturnType<typeof requestState> }) {
  const store = useStore()!;
  const account = useOperator();
  const fleet = store.state.fleet.filter((a) => a.operatorId === account.id);
  const options = useMemo(
    () =>
      fleet
        .map((ac) => {
          const q = suggestQuote(ac, r.origin, r.destination, r.pax);
          const conflict = aircraftConflict(ac, r.date, store.state.blocks, store.state.bookings);
          const problem = conflict ?? (!q.fitsPax ? `Only ${ac.seats} seats` : !q.fitsRange ? "Out of range" : null);
          return { ac, q, problem };
        })
        // Free aircraft first, then the category the broker asked for, then cheapest
        .sort(
          (a, b) =>
            Number(!!a.problem) - Number(!!b.problem) ||
            Number(a.ac.category !== r.category) - Number(b.ac.category !== r.category) ||
            a.q.price - b.q.price
        ),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recompute when fleet, blocks or bookings change
    [store.state.fleet, store.state.blocks, store.state.bookings, r, account.id]
  );
  const best = options.find((o) => !o.problem) ?? null;
  const [aircraftId, setAircraftId] = useState<string | null>(best?.ac.id ?? null);
  const chosen = options.find((o) => o.ac.id === aircraftId) ?? null;
  const [price, setPrice] = useState<number>(best?.q.price ?? 0);
  const [note, setNote] = useState("");
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState("No aircraft available that day");
  const [justSent, setJustSent] = useState(false);
  const response = r.responses[account.id];
  const distance = best?.q.distance ?? options[0]?.q.distance ?? null;
  const hours = best?.q.hours ?? options[0]?.q.hours ?? null;

  function pick(ac: FleetAircraft, suggested: number) {
    setAircraftId(ac.id);
    setPrice(suggested);
  }

  function send() {
    if (!chosen) return;
    if (store.submitPortalQuote(r.id, account.id, { aircraftId: chosen.ac.id, price, note: note.trim() || null })) setJustSent(true);
  }

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-2xl bg-navy-950 text-white shadow-lg">
        <div className="flex flex-wrap items-end justify-between gap-4 p-6">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wider text-gold-300">Request {r.id} · from {r.broker.company}</div>
            <div className="mt-2 flex items-center gap-3 text-3xl font-semibold tracking-tight">
              {getIATA(r.origin)} <Plane className="h-6 w-6 text-gold-300" /> {getIATA(r.destination)}
            </div>
            <div className="mt-1 text-sm text-navy-200">
              {getAirportCity(r.origin)} to {getAirportCity(r.destination)}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-6 text-right">
            <Stat label="Date" value={format(parseISO(r.date), "MMM d")} sub={r.departureTime ?? "Flexible"} />
            <Stat label="Passengers" value={String(r.pax ?? "?")} sub={r.category ?? "Any"} />
            <Stat label="Distance" value={distance ? `${Math.round(distance).toLocaleString()} nm` : "?"} sub={hours ? `~${hours.toFixed(1)} hrs` : ""} />
          </div>
        </div>
        {r.notes && <div className="border-t border-white/10 px-6 py-3 text-sm text-navy-100">&ldquo;{r.notes}&rdquo; <span className="text-navy-300">· {r.broker.name}</span></div>}
      </section>

      {justSent || response ? (
        <Answered request={r} state={state} justSent={justSent} />
      ) : state === "Expired" ? (
        <Panel><p className="text-sm text-slate-500">This trip date has passed.</p></Panel>
      ) : (
        <Panel title="Choose an aircraft" action={<span className="text-xs text-slate-500">Priced from your hourly rates, repositioning from base included</span>}>
          <div className="grid gap-3 sm:grid-cols-2">
            {options.map(({ ac, q, problem }) => {
              const on = ac.id === aircraftId;
              return (
                <button
                  key={ac.id}
                  data-aircraft={ac.tail}
                  disabled={!!problem}
                  onClick={() => pick(ac, q.price)}
                  className={`flex gap-3 rounded-xl border p-3 text-left transition-all ${
                    on ? "border-navy-900 ring-2 ring-navy-900 bg-white" : problem ? "border-slate-200 bg-slate-50 opacity-60 cursor-not-allowed" : "border-slate-200 bg-white hover:border-navy-300"
                  }`}
                >
                  <AircraftArt category={ac.category} label={false} className="h-16 w-24 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-navy-900">{ac.model}</span>
                      {on && <Check className="h-4 w-4 text-navy-900" />}
                    </div>
                    <div className="text-xs text-slate-500">{ac.tail} · {ac.year} · {ac.seats} seats</div>
                    <div className="mt-1.5 flex items-center justify-between gap-2">
                      {problem ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-600"><CircleSlash className="h-3 w-3" /> {problem}</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700"><CheckCircle2 className="h-3 w-3" /> Available</span>
                      )}
                      <span className="text-sm font-semibold tabular-nums text-navy-900">{money(q.price)}</span>
                    </div>
                  </div>
                </button>
              );
            })}
            {options.length === 0 && <p className="text-sm text-slate-500">Add aircraft to your fleet to quote.</p>}
          </div>

          {chosen && (
            <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1.4fr]">
              <div className="rounded-xl bg-canvas p-4 text-xs text-slate-600 space-y-1.5">
                <Row k="Flight time" v={`${chosen.q.hours.toFixed(1)} hrs`} />
                <Row k="Repositioning" v={chosen.q.repoHours ? `${chosen.q.repoHours.toFixed(1)} hrs from ${getIATA(chosen.ac.base)}` : "None, based here"} />
                <Row k="Your rate" v={`${money(chosen.ac.hourlyRate)} / hr`} />
                <Row k="Fees" v="FET 7.5%, segment and handling" />
                <Row k="Suggested all in" v={money(chosen.q.price)} strong />
              </div>
              <div className="space-y-3">
                <label className="block">
                  <span className="text-xs font-medium text-slate-600">Your price, all in (USD)</span>
                  <input
                    aria-label="Quote price"
                    type="number"
                    min={0}
                    step={25}
                    className={`${inputCls} mt-1 text-lg font-semibold tabular-nums`}
                    value={price || ""}
                    onChange={(e) => setPrice(Number(e.target.value))}
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-slate-600">Note to the broker (optional)</span>
                  <textarea rows={2} className={`${inputCls} mt-1`} placeholder="e.g. Catering included, crew can wait for a late return" value={note} onChange={(e) => setNote(e.target.value)} />
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={send}
                    disabled={!(price > 0)}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-gold-400 px-4 py-3 text-sm font-semibold text-navy-950 shadow-sm hover:bg-gold-300 disabled:opacity-40 transition-colors"
                  >
                    <Send className="h-4 w-4" /> Send quote to {r.broker.company}
                  </button>
                  <button onClick={() => setDeclining((v) => !v)} className={btnSecondary}>Decline</button>
                </div>
                {declining && (
                  <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3">
                    <select className={`${inputCls} flex-1`} value={reason} onChange={(e) => setReason(e.target.value)}>
                      <option>No aircraft available that day</option>
                      <option>Crew not available</option>
                      <option>Outside our operating area</option>
                      <option>Trip too short for our fleet</option>
                    </select>
                    <button onClick={() => store.declineRequest(r.id, account.id, reason)} className={btnSecondary}>
                      <X className="h-4 w-4" /> Confirm decline
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </Panel>
      )}
    </div>
  );
}

function Answered({ request: r, state, justSent }: { request: RfqRequest; state: ReturnType<typeof requestState>; justSent: boolean }) {
  const store = useStore()!;
  const account = useOperator();
  const resp = r.responses[account.id];
  const ac = resp?.aircraftId ? store.state.fleet.find((a) => a.id === resp.aircraftId) : null;
  const booking = store.state.bookings.find((b) => b.tripId === r.tripId && b.operator === account.company);

  if (booking) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-500 text-white"><Trophy className="h-5 w-5" /></span>
          <div>
            <div className="text-lg font-semibold text-emerald-900">You won this trip</div>
            <div className="text-sm text-emerald-800">
              {booking.clientName} booked {booking.aircraft}{booking.tailNumber ? ` (${booking.tailNumber})` : ""}. {money(booking.operatorPrice)} to you. It is on your calendar.
            </div>
          </div>
        </div>
      </div>
    );
  }
  if (resp?.status === "Declined") {
    return (
      <Panel>
        <div className="flex items-center gap-3 text-sm text-slate-600">
          <CircleSlash className="h-5 w-5 text-slate-400" /> You declined this request{resp.note ? `: ${resp.note}` : ""}.
        </div>
      </Panel>
    );
  }
  return (
    <div className={`rounded-2xl border p-6 ${justSent ? "border-gold-300 bg-gold-50 ring-4 ring-gold-100 animate-in zoom-in-95 fade-in duration-500" : "border-slate-200 bg-white"}`}>
      <div className="flex items-start gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-navy-900 text-gold-300"><Zap className="h-6 w-6" /></span>
        <div className="flex-1">
          <div className="text-lg font-semibold text-navy-900">{justSent ? "Quote delivered" : "Quote sent"} · {money(resp?.price ?? null)}</div>
          <p className="mt-0.5 text-sm text-slate-600">
            {ac ? `${ac.model} (${ac.tail}), ${ac.seats} seats. ` : ""}
            {justSent ? `${r.broker.name} at ${r.broker.company} sees it on their quote board right now, no email needed.` : `Delivered ${resp ? formatDistanceToNow(parseISO(resp.at), { addSuffix: true }) : ""}.`}
          </p>
          {resp?.note && <p className="mt-2 text-sm text-slate-500">&ldquo;{resp.note}&rdquo;</p>}
          <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> Waiting on the client</span>
            <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {state === "Quoted" ? "Broker notified" : state}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-navy-300">{label}</div>
      <div className="text-xl font-semibold tabular-nums">{value}</div>
      <div className="text-[11px] text-navy-300">{sub}</div>
    </div>
  );
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-3 ${strong ? "border-t border-slate-200 pt-1.5 text-sm font-semibold text-navy-900" : ""}`}>
      <span>{k}</span>
      <span className="text-right tabular-nums">{v}</span>
    </div>
  );
}
