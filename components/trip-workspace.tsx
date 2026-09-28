"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { format, parseISO } from "date-fns";
import { ArrowLeft, Plane, Loader2, Sparkles, ExternalLink, Copy, Check, Send, Radio } from "lucide-react";
import { QuoteDetailTable } from "./quote-detail-table";
import { useStore } from "./store-provider";
import { tripFromInquiry, visibleRfqQuotes } from "./use-trips";
import { LoadingBlock, Panel, TierBadge, btnPrimary, btnSecondary, inputCls } from "./ui-bits";
import { valueScores } from "@/lib/fleet";
import { distanceNm, getAirportCity, getAirportName, getIATA } from "@/lib/airport-lookup";
import { checklistTemplate, inquiryTripId, newId } from "@/lib/demo-state";
import { proposalTemplate } from "@/lib/drafts";
import { money } from "@/lib/money";
import { normalizeTime } from "@/lib/time";
import type { Booking, ParsedQuote, Proposal, ProposalOption, Trip } from "@/lib/types";

export function TripWorkspace({ tripId, serverTrip, mode }: { tripId: string; serverTrip: Trip | null; mode: "demo" | "live" }) {
  const store = useStore();

  const inquiry = store?.state.inquiries.find((i) => inquiryTripId(i) === tripId) ?? null;
  const rfqAll = store?.state.rfqQuotes[tripId];
  const rfqVisible = useMemo(() => visibleRfqQuotes(rfqAll, store?.now ?? 0), [rfqAll, store?.now]);
  const pending = (rfqAll?.length ?? 0) - rfqVisible.length;

  const trip: Trip | null = useMemo(() => {
    if (serverTrip) return { ...serverTrip, quotes: [...serverTrip.quotes, ...rfqVisible].sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity)) };
    if (inquiry) return tripFromInquiry(inquiry, tripId, [...rfqVisible].sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity)));
    return null;
  }, [serverTrip, inquiry, rfqVisible, tripId]);

  // Highlight rows that just streamed in
  const seen = useRef<Set<string> | null>(null);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!trip) return;
    const ids = trip.quotes.map((q) => q.emailId);
    if (seen.current === null) {
      seen.current = new Set(ids);
      return;
    }
    const fresh = ids.filter((id) => !seen.current!.has(id));
    if (fresh.length) {
      fresh.forEach((id) => seen.current!.add(id));
      setNewIds(new Set(fresh));
    }
  }, [trip]);

  if (!store) return <LoadingBlock />;

  if (!trip) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
        <p className="text-slate-600 mb-2">Trip {tripId} was not found.</p>
        <Link href="/quotes" className="text-sm text-navy-700 hover:text-navy-700">Back to quote board</Link>
      </div>
    );
  }

  return <Workspace trip={trip} tripId={tripId} inquiryId={inquiry?.id ?? null} pending={pending} total={rfqAll?.length ?? 0} newIds={newIds} mode={mode} />;
}

function Workspace({
  trip,
  tripId,
  inquiryId,
  pending,
  total,
  newIds,
  mode,
}: {
  trip: Trip;
  tripId: string;
  inquiryId: string | null;
  pending: number;
  total: number;
  newIds: Set<string>;
  mode: "demo" | "live";
}) {
  const store = useStore()!;
  const { state } = store;
  const inquiry = inquiryId ? state.inquiries.find((i) => i.id === inquiryId) ?? null : null;
  const proposal = state.proposals[tripId] ?? null;
  const booking = state.bookings.find((b) => b.tripId === tripId) ?? null;
  const scores = useMemo(() => valueScores(trip.quotes), [trip.quotes]);
  const [bookingQuote, setBookingQuote] = useState<ParsedQuote | null>(null);

  const selected = useMemo(
    () => new Set(Object.entries(state.quoteDecisions).filter(([id, d]) => d === "Shortlisted" && trip.quotes.some((q) => q.emailId === id)).map(([id]) => id)),
    [state.quoteDecisions, trip.quotes]
  );

  function toggle(q: ParsedQuote) {
    store.setQuoteDecision(q.emailId, selected.has(q.emailId) ? null : "Shortlisted");
  }

  function autoPick() {
    // Best value first, then the cheapest and the newest aircraft for contrast
    const priced = trip.quotes.filter((q) => q.price !== null);
    const byValue = [...priced].sort((a, b) => (scores.get(b.emailId) ?? 0) - (scores.get(a.emailId) ?? 0));
    const cheapest = [...priced].sort((a, b) => a.price! - b.price!)[0];
    const newest = [...priced].sort((a, b) => (b.yom ?? 0) - (a.yom ?? 0))[0];
    const picks = [byValue[0], cheapest, newest, ...byValue].filter(Boolean);
    const unique: string[] = [];
    for (const p of picks) if (!unique.includes(p.emailId) && unique.length < 3) unique.push(p.emailId);
    for (const id of selected) if (!unique.includes(id)) store.setQuoteDecision(id, null);
    for (const id of unique) store.setQuoteDecision(id, "Shortlisted");
  }

  const prices = trip.quotes.map((q) => q.price).filter((p): p is number => p !== null);
  const dist = distanceNm(trip.origin, trip.destination);

  return (
    <>
      <Link href={inquiry ? `/inquiries/${inquiry.id}` : "/quotes"} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors mb-5">
        <ArrowLeft className="h-4 w-4" />
        {inquiry ? `Back to ${inquiry.clientName ?? "inquiry"}` : "Back to quote board"}
      </Link>

      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-navy-50 border border-navy-200">
            <Plane className="h-5 w-5 text-navy-700" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
              {trip.origin} <span className="text-slate-400">&rarr;</span> {trip.destination}
            </h1>
            <p className="text-sm text-slate-500">
              {getAirportName(trip.origin)} to {getAirportName(trip.destination)}
            </p>
            <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-500 flex-wrap">
              <span className="text-slate-600">{format(parseISO(trip.date), "EEEE, MMMM d, yyyy")}</span>
              {dist && <><span className="text-slate-300">&middot;</span><span>{dist.toLocaleString()} nm</span></>}
              <span className="text-slate-300">&middot;</span>
              <span className="font-mono bg-slate-50 rounded px-1.5 py-0.5">{trip.tripId}</span>
              {inquiry && (
                <>
                  <span className="text-slate-300">&middot;</span>
                  <Link href={`/inquiries/${inquiry.id}`} className="text-navy-700 hover:text-navy-700">{inquiry.clientName ?? "Client"}</Link>
                  <TierBadge tier={inquiry.qualification.tier} score={inquiry.qualification.score} />
                  {inquiry.pax && <span>{inquiry.pax} pax</span>}
                </>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-right">
          <Stat label="Quotes" value={String(trip.quotes.length)} />
          <Stat label="Low" value={prices.length ? money(Math.min(...prices)) : "—"} />
          <Stat label="Spread" value={prices.length > 1 ? money(Math.max(...prices) - Math.min(...prices)) : "—"} />
        </div>
      </div>

      {pending > 0 && (
        <div className="mb-4 rounded-xl border border-navy-200 bg-navy-50 px-4 py-3 flex items-center gap-3">
          <Radio className="h-4 w-4 text-navy-700 animate-pulse" />
          <div className="text-sm text-navy-700">
            Receiving operator responses: <span className="tabular-nums font-medium">{total - pending} of {total}</span> in. Each reply is parsed and ranked the moment it lands.
          </div>
          <div className="ml-auto h-1.5 w-32 rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full bg-navy-900 transition-all duration-700" style={{ width: `${((total - pending) / total) * 100}%` }} />
          </div>
        </div>
      )}

      {booking && (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 flex items-center gap-3 text-sm">
          <Check className="h-4 w-4 text-emerald-700" />
          <span className="text-emerald-700">
            Booked: {booking.aircraft} with {booking.operator}, client price {money(booking.clientPrice)}, margin {money(booking.clientPrice - booking.operatorPrice)}.
          </span>
          <Link href="/schedule" className="ml-auto text-emerald-700 hover:text-emerald-700 text-xs font-medium">Open in schedule</Link>
        </div>
      )}

      <div className="grid gap-6 min-[1700px]:grid-cols-[1fr_360px]">
        <div className="min-w-0">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-medium text-slate-500 uppercase tracking-wider">Operator quotes</h2>
            <button onClick={autoPick} className="inline-flex items-center gap-1.5 text-xs text-navy-700 hover:text-navy-700" disabled={trip.quotes.length === 0}>
              <Sparkles className="h-3.5 w-3.5" /> Auto pick best 3
            </button>
          </div>
          {trip.quotes.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin mx-auto mb-3 text-navy-700" />
              Waiting for the first operator response...
            </div>
          ) : (
            <QuoteDetailTable
              quotes={trip.quotes}
              selected={selected}
              onToggleSelect={toggle}
              decisions={state.quoteDecisions}
              valueScores={scores}
              onBook={booking ? undefined : setBookingQuote}
              newIds={newIds}
            />
          )}
          {mode === "demo" && total > 0 && (
            <p className="mt-2 text-[11px] text-slate-400">Demo mode: RFQ responses for this trip are simulated from market rates and the operator network.</p>
          )}
        </div>

        <ProposalBuilder
          trip={trip}
          selectedQuotes={trip.quotes.filter((q) => selected.has(q.emailId))}
          proposal={proposal}
          defaultClient={inquiry?.clientName ?? ""}
          defaultEmail={inquiry?.clientEmail ?? ""}
          pax={inquiry?.pax ?? null}
        />
      </div>

      {bookingQuote && (
        <BookDialog
          trip={trip}
          quote={bookingQuote}
          defaultClient={proposal?.clientName || inquiry?.clientName || ""}
          markupPct={proposal?.markupPct ?? state.settings.defaultMarkupPct}
          proposalPrice={proposal?.options.find((o) => o.quoteId === bookingQuote.emailId)?.clientPrice ?? null}
          departureTime={inquiry?.departureTime ?? null}
          pax={inquiry?.pax ?? null}
          inquiryId={inquiryId}
          onClose={() => setBookingQuote(null)}
        />
      )}
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 min-w-[92px]">
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className="text-sm font-semibold text-slate-900 tabular-nums">{value}</div>
    </div>
  );
}

function ProposalBuilder({
  trip,
  selectedQuotes,
  proposal,
  defaultClient,
  defaultEmail,
  pax,
}: {
  trip: Trip;
  selectedQuotes: ParsedQuote[];
  proposal: Proposal | null;
  defaultClient: string;
  defaultEmail: string;
  pax: number | null;
}) {
  const store = useStore()!;
  const { settings } = store.state;
  const [markup, setMarkup] = useState(proposal?.markupPct ?? settings.defaultMarkupPct);
  const [clientName, setClientName] = useState(proposal?.clientName ?? defaultClient);
  const [clientEmail, setClientEmail] = useState(proposal?.clientEmail ?? defaultEmail);
  const [message, setMessage] = useState(proposal?.message ?? "");
  const [drafting, setDrafting] = useState(false);
  const [aiUsed, setAiUsed] = useState<boolean | null>(null);
  const [copied, setCopied] = useState(false);

  const options: ProposalOption[] = selectedQuotes
    .filter((q) => q.price !== null)
    .map((q) => ({
      quoteId: q.emailId,
      operator: q.operator,
      aircraft: q.aircraft,
      tailNumber: q.tailNumber,
      yom: q.yom,
      maxPax: q.maxPax,
      refurbInterior: q.refurbInterior,
      operatorPrice: q.price!,
      clientPrice: Math.round((q.price! * (1 + markup / 100)) / 50) * 50,
    }))
    .sort((a, b) => a.clientPrice - b.clientPrice);

  const avgMargin = options.length ? options.reduce((s, o) => s + o.clientPrice - o.operatorPrice, 0) / options.length : 0;

  function build(status: Proposal["status"], msg = message): Proposal {
    return {
      tripId: trip.tripId,
      createdAt: proposal?.createdAt ?? new Date().toISOString(),
      clientName: clientName || "Client",
      clientEmail: clientEmail || null,
      origin: trip.origin,
      destination: trip.destination,
      date: trip.date,
      pax,
      markupPct: markup,
      options,
      message: msg,
      status,
      acceptedQuoteId: proposal?.acceptedQuoteId ?? null,
    };
  }

  async function draft() {
    setDrafting(true);
    const p = build("Draft");
    const fallback = proposalTemplate(p, settings);
    try {
      const res = await fetch("/api/ai/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "proposal",
          context: {
            broker: settings,
            client: { name: p.clientName },
            trip: { from: `${getAirportName(p.origin)} (${getAirportCity(p.origin)})`, to: `${getAirportName(p.destination)} (${getAirportCity(p.destination)})`, date: p.date, passengers: p.pax },
            options: p.options.map((o) => ({ aircraft: o.aircraft, year: o.yom, seats: o.maxPax, interiorRefurb: o.refurbInterior, allInPrice: o.clientPrice })),
          },
        }),
      });
      const data = await res.json();
      const text = data.draft ? `Subject: ${data.draft.subject}\n\n${data.draft.body}` : `Subject: ${fallback.subject}\n\n${fallback.body}`;
      setMessage(text);
      setAiUsed(!!data.draft);
    } catch {
      setMessage(`Subject: ${fallback.subject}\n\n${fallback.body}`);
      setAiUsed(false);
    } finally {
      setDrafting(false);
    }
  }

  function send() {
    const msg = message || (() => {
      const t = proposalTemplate(build("Draft"), settings);
      return `Subject: ${t.subject}\n\n${t.body}`;
    })();
    setMessage(msg);
    store.saveProposal(build("Sent", msg));
    store.log({
      kind: "proposal",
      text: `Proposal with ${options.length} option${options.length === 1 ? "" : "s"} sent to ${clientName || "client"} (${getIATA(trip.origin)} to ${getIATA(trip.destination)})`,
      href: `/trip/${trip.tripId}`,
    });
  }

  const mailto = `mailto:${encodeURIComponent(clientEmail)}?subject=${encodeURIComponent(message.match(/^Subject: (.*)$/m)?.[1] ?? "Your flight options")}&body=${encodeURIComponent(message.replace(/^Subject: .*\n\n?/, ""))}`;

  return (
    <Panel
      title="Client proposal"
      action={proposal && <span className={`text-[11px] font-medium ${proposal.status === "Accepted" ? "text-emerald-700" : proposal.status === "Sent" ? "text-indigo-700" : "text-slate-500"}`}>{proposal.status}</span>}
      className="h-fit xl:sticky xl:top-20"
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <input className={inputCls} placeholder="Client name" value={clientName} onChange={(e) => setClientName(e.target.value)} />
          <input className={inputCls} placeholder="Client email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} />
        </div>

        <div>
          <div className="flex items-center justify-between text-xs mb-1">
            <label htmlFor="markup" className="text-slate-500">Broker markup</label>
            <span className="tabular-nums text-slate-800 font-medium">{markup}%</span>
          </div>
          <input id="markup" type="range" min={0} max={30} step={1} value={markup} onChange={(e) => setMarkup(Number(e.target.value))} className="w-full accent-blue-500" />
        </div>

        {options.length === 0 ? (
          <p className="text-xs text-slate-500 rounded-lg border border-dashed border-slate-200 p-4 text-center">
            Tick quotes in the table, or use <span className="text-navy-700">Auto pick best 3</span>, to build the proposal.
          </p>
        ) : (
          <div className="space-y-1.5">
            {options.map((o, i) => (
              <div key={o.quoteId} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-900 font-medium">
                    <span className="text-slate-400 mr-1.5">{i + 1}</span>
                    {o.aircraft}
                    {o.yom && <span className="text-slate-500 font-normal"> &middot; {o.yom}</span>}
                  </span>
                  <span className="text-sm font-semibold text-slate-900 tabular-nums">{money(o.clientPrice)}</span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 mt-0.5">
                  <span>{o.operator} &middot; op {money(o.operatorPrice)}</span>
                  <span className="text-emerald-700 tabular-nums">+{money(o.clientPrice - o.operatorPrice)}</span>
                </div>
              </div>
            ))}
            <div className="flex justify-between text-xs pt-1">
              <span className="text-slate-500">Avg margin per option</span>
              <span className="text-emerald-700 font-medium tabular-nums">{money(avgMargin)}</span>
            </div>
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-slate-500">Cover email</span>
            <button onClick={draft} disabled={drafting || options.length === 0} className="inline-flex items-center gap-1 text-xs text-navy-700 hover:text-navy-700 disabled:opacity-40">
              {drafting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
              {message ? "Redraft" : "Draft with AI"}
            </button>
          </div>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={9}
            placeholder="Draft the cover email with AI, or write your own."
            className={`${inputCls} font-mono text-[11px] leading-relaxed`}
          />
          {aiUsed !== null && <p className="text-[10px] text-slate-400 mt-1">{aiUsed ? "Drafted by Claude" : "Drafted from template (AI key not configured)"}</p>}
        </div>

        <div className="flex flex-wrap gap-2">
          <button onClick={send} disabled={options.length === 0} className={btnPrimary}>
            <Send className="h-3.5 w-3.5" /> {proposal?.status === "Sent" ? "Update proposal" : "Send proposal"}
          </button>
          {proposal && (
            <Link href={`/proposal/${trip.tripId}`} target="_blank" className={btnSecondary}>
              <ExternalLink className="h-3.5 w-3.5" /> Client view
            </Link>
          )}
          {message && (
            <>
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(message.replace(/^Subject: .*\n\n?/, ""));
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
                className={btnSecondary}
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} Copy
              </button>
              {clientEmail && <a href={mailto} className={btnSecondary}>Open in mail</a>}
            </>
          )}
        </div>
      </div>
    </Panel>
  );
}

function BookDialog({
  trip,
  quote,
  defaultClient,
  markupPct,
  proposalPrice,
  departureTime,
  pax,
  inquiryId,
  onClose,
}: {
  trip: Trip;
  quote: ParsedQuote;
  defaultClient: string;
  markupPct: number;
  proposalPrice: number | null;
  departureTime: string | null;
  pax: number | null;
  inquiryId: string | null;
  onClose: () => void;
}) {
  const store = useStore()!;
  const [clientName, setClientName] = useState(defaultClient);
  const [clientPrice, setClientPrice] = useState(proposalPrice ?? Math.round((quote.price! * (1 + markupPct / 100)) / 50) * 50);
  const [time, setTime] = useState(normalizeTime(departureTime));

  function confirm() {
    const bk: Booking = {
      id: newId("BK"),
      tripId: trip.tripId,
      inquiryId,
      createdAt: new Date().toISOString(),
      clientName: clientName || "Client",
      origin: trip.origin,
      destination: trip.destination,
      date: trip.date,
      departureTime: time,
      pax,
      operator: quote.operator ?? quote.fromName,
      aircraft: quote.aircraft ?? "Aircraft",
      tailNumber: quote.tailNumber,
      operatorPrice: quote.price!,
      clientPrice,
      checklist: checklistTemplate(),
    };
    store.createBooking(bk, quote.emailId);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-semibold text-slate-900">Book {quote.aircraft}</h3>
        <p className="text-xs text-slate-500 mt-0.5">
          {quote.operator} &middot; {quote.tailNumber} &middot; {getIATA(trip.origin)} to {getIATA(trip.destination)}, {format(parseISO(trip.date), "MMM d")}
        </p>
        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="text-xs text-slate-500">Client</span>
            <input className={`${inputCls} mt-1`} value={clientName} onChange={(e) => setClientName(e.target.value)} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs text-slate-500">Client price</span>
              <input type="number" className={`${inputCls} mt-1`} value={clientPrice} onChange={(e) => setClientPrice(Number(e.target.value))} />
            </label>
            <label className="block">
              <span className="text-xs text-slate-500">Departure (local)</span>
              <input type="time" className={`${inputCls} mt-1`} value={time} onChange={(e) => setTime(e.target.value)} />
            </label>
          </div>
          <div className="flex justify-between rounded-lg bg-white px-3 py-2 text-sm">
            <span className="text-slate-500">Operator {money(quote.price)}</span>
            <span className="text-emerald-700 font-medium">Margin {money(clientPrice - quote.price!)}</span>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className={btnSecondary}>Cancel</button>
          <button onClick={confirm} className={btnPrimary}>Confirm booking</button>
        </div>
      </div>
    </div>
  );
}
