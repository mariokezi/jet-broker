"use client";

import Link from "next/link";
import { useState } from "react";
import { format, formatDistanceToNow, parseISO } from "date-fns";
import { ArrowLeft, Send, Sparkles, Loader2, Copy, Check, Plane, Mail, Phone, Building2, PawPrint, XCircle, ArrowRight } from "lucide-react";
import { useStore } from "./store-provider";
import { EstimateTable, ReasonsList, ScoreRing } from "./qualification-view";
import { InquiryStatusBadge, LoadingBlock, Panel, TierBadge, btnPrimary, btnSecondary, inputCls } from "./ui-bits";
import { visibleRfqQuotes } from "./use-trips";
import { getAirportCity, getAirportName, getIATA } from "@/lib/airport-lookup";
import { inquiryTripId } from "@/lib/demo-state";
import { followupTemplate, rfqTemplate } from "@/lib/drafts";
import { matchOperators } from "@/lib/fleet";
import { money } from "@/lib/money";
import type { Inquiry } from "@/lib/types";
import { findMatches } from "@/lib/empty-legs";

export function InquiryDetail({ id, emailQuoteCounts }: { id: string; emailQuoteCounts: Record<string, number> }) {
  const store = useStore();
  if (!store) return <LoadingBlock />;
  const inq = store.state.inquiries.find((i) => i.id === id);
  if (!inq) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
        <p className="text-slate-600 mb-2">Inquiry {id} was not found.</p>
        <Link href="/inquiries" className="text-sm text-navy-700">Back to inquiries</Link>
      </div>
    );
  }
  return <Detail inq={inq} emailQuoteCounts={emailQuoteCounts} />;
}

function Detail({ inq, emailQuoteCounts }: { inq: Inquiry; emailQuoteCounts: Record<string, number> }) {
  const store = useStore()!;
  const tripId = inquiryTripId(inq);
  const rfq = tripId ? store.state.rfqQuotes[tripId] : undefined;
  const received = visibleRfqQuotes(rfq, store.now).length + (tripId ? emailQuoteCounts[tripId] ?? 0 : 0);
  const pending = (rfq?.length ?? 0) - visibleRfqQuotes(rfq, store.now).length;
  const booking = tripId ? store.state.bookings.find((b) => b.tripId === tripId) : undefined;
  const proposal = tripId ? store.state.proposals[tripId] : undefined;
  const operators = inq.origin ? matchOperators(inq.origin, inq.category ?? inq.estimate.recommended) : [];
  const canRfq = !!tripId;
  const timeline = store.state.activity.filter((a) => a.href === `/inquiries/${inq.id}` || (tripId && a.href === `/trip/${tripId}`));

  return (
    <>
      <Link href="/inquiries" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors mb-5">
        <ArrowLeft className="h-4 w-4" /> All inquiries
      </Link>

      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">{inq.clientName ?? "Unknown client"}</h1>
            <TierBadge tier={inq.qualification.tier} score={inq.qualification.score} />
            <InquiryStatusBadge status={inq.status} />
          </div>
          <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500 flex-wrap">
            {inq.company && <span className="inline-flex items-center gap-1"><Building2 className="h-3 w-3" />{inq.company}</span>}
            {inq.clientEmail && <a href={`mailto:${inq.clientEmail}`} className="inline-flex items-center gap-1 hover:text-slate-700"><Mail className="h-3 w-3" />{inq.clientEmail}</a>}
            {inq.clientPhone && <a href={`tel:${inq.clientPhone}`} className="inline-flex items-center gap-1 hover:text-slate-700"><Phone className="h-3 w-3" />{inq.clientPhone}</a>}
            <span>{inq.source} &middot; {formatDistanceToNow(parseISO(inq.createdAt), { addSuffix: true })}</span>
            <span className="font-mono text-slate-400">{inq.id}</span>
          </div>
        </div>
        {inq.status !== "Lost" && inq.status !== "Booked" && (
          <button onClick={() => store.updateInquiry(inq.id, { status: "Lost" })} className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-rose-700">
            <XCircle className="h-3.5 w-3.5" /> Mark lost
          </button>
        )}
      </div>

      {findMatches(store.state.emptyLegs, [inq]).map((m) => (
        <Link
          key={m.leg.id}
          href={`/empty-legs?leg=${m.leg.id}`}
          className="mb-3 flex items-center gap-3 flex-wrap rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm hover:bg-emerald-50"
        >
          <span className="text-[10px] uppercase tracking-wider text-emerald-700 font-medium">Empty leg match</span>
          <span className="text-emerald-700">
            {getIATA(m.leg.origin)} to {getIATA(m.leg.destination)}, {m.leg.aircraft}, {money(m.leg.askingPrice)} from {m.leg.postedBy.company}
            {m.savingsPct !== null && <span className="text-emerald-700"> (about {m.savingsPct}% below charter)</span>}
          </span>
          <ArrowRight className="h-4 w-4 text-emerald-700 ml-auto" />
        </Link>
      ))}

      <NextStep inq={inq} tripId={tripId} received={received} pending={pending} total={rfq?.length ?? 0} proposalStatus={proposal?.status} bookingId={booking?.id} />

      <div className="grid gap-6 xl:grid-cols-[1fr_380px] mt-6">
        <div className="space-y-6 min-w-0">
          <Panel title="Trip">
            {inq.origin && inq.destination ? (
              <div className="flex items-center gap-4 mb-4">
                <AirportBlock icao={inq.origin} />
                <div className="flex-1 flex items-center gap-2 text-slate-400">
                  <div className="h-px flex-1 bg-slate-100" />
                  <Plane className="h-4 w-4 text-navy-700" />
                  <div className="h-px flex-1 bg-slate-100" />
                </div>
                <AirportBlock icao={inq.destination} right />
              </div>
            ) : (
              <p className="text-sm text-amber-700 mb-3">Route not identified yet.</p>
            )}
            <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <Item label="Departure" value={inq.date ? format(parseISO(inq.date), "EEE, MMM d") : null} sub={inq.departureTime} />
              <Item label="Return" value={inq.returnDate ? format(parseISO(inq.returnDate), "EEE, MMM d") : "One way"} />
              <Item label="Passengers" value={inq.pax ? String(inq.pax) : null} />
              <Item label="Aircraft" value={inq.category ?? (inq.estimate.recommended ? `${inq.estimate.recommended} (rec.)` : null)} />
              <Item label="Budget" value={inq.budget ? money(inq.budget) : "Not stated"} />
              <Item label="Distance" value={inq.estimate.distanceNm ? `${inq.estimate.distanceNm.toLocaleString()} nm` : null} />
              {inq.pets && <Item label="Pets" value="Yes" icon={<PawPrint className="h-3 w-3" />} />}
              {inq.notes && <Item label="Notes" value={inq.notes} />}
            </dl>
          </Panel>

          <Panel title="Original request">
            <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-slate-600">{inq.rawText}</pre>
          </Panel>

          {timeline.length > 0 && (
            <Panel title="Timeline">
              <ol className="space-y-2">
                {timeline.map((a) => (
                  <li key={a.id} className="flex gap-3 text-xs">
                    <span className="text-slate-400 w-28 shrink-0 tabular-nums">{format(parseISO(a.at), "MMM d, h:mm a")}</span>
                    <span className="text-slate-700">{a.text}</span>
                  </li>
                ))}
              </ol>
            </Panel>
          )}
        </div>

        <div className="space-y-6">
          <Panel title="Qualification">
            <div className="flex items-center gap-4">
              <ScoreRing score={inq.qualification.score} tier={inq.qualification.tier} size={68} />
              <p className="text-sm text-slate-700">{inq.qualification.summary}</p>
            </div>
            <ReasonsList reasons={inq.qualification.reasons} missing={inq.qualification.missing} />
          </Panel>

          <Panel title="Market estimate">
            <EstimateTable estimate={inq.estimate} selected={inq.category} roundTrip={!!inq.returnDate} />
          </Panel>

          {inq.qualification.missing.length > 0 && inq.status !== "Lost" && <DraftBox kind="followup" inq={inq} title="Auto follow up" />}

          {canRfq && inq.status !== "Lost" && (
            <Panel title={`Operator network · ${operators.length} matched`}>
              <ul className="space-y-1 mb-3">
                {operators.slice(0, 6).map((op) => (
                  <li key={op.name} className="flex items-center justify-between text-xs">
                    <span className="text-slate-700">{op.name}</span>
                    <span className="text-slate-500">{getIATA(op.base)} &middot; ARGUS {op.argusRating}</span>
                  </li>
                ))}
                {operators.length > 6 && <li className="text-[11px] text-slate-400">+ {operators.length - 6} more</li>}
              </ul>
              {store.mode === "live" && <DraftBox kind="rfq" inq={inq} title="RFQ email" bcc={operators.map((o) => o.email)} embedded />}
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}

function NextStep({
  inq,
  tripId,
  received,
  pending,
  total,
  proposalStatus,
  bookingId,
}: {
  inq: Inquiry;
  tripId: string | null;
  received: number;
  pending: number;
  total: number;
  proposalStatus?: string;
  bookingId?: string;
}) {
  const store = useStore()!;
  let body: React.ReactNode;

  if (inq.status === "Lost") {
    body = <span className="text-slate-600">Marked lost.</span>;
  } else if (bookingId) {
    body = (
      <>
        <span className="text-emerald-700">Booked ({bookingId}). Ops checklist is tracking contract, payment, crew, and catering.</span>
        <Link href="/schedule" className={`${btnSecondary} ml-auto`}>Open schedule <ArrowRight className="h-3.5 w-3.5" /></Link>
      </>
    );
  } else if (!tripId) {
    body = <span className="text-amber-700">Needs route and date before operators can quote. Send the auto follow up below.</span>;
  } else if (inq.status === "New" || inq.status === "Qualified") {
    body = (
      <>
        <span className="text-slate-800">
          Ready to source. {received > 0 ? `${received} quotes already on file for this trip.` : "Send an RFQ to matched operators."}
        </span>
        <div className="ml-auto flex gap-2">
          {received > 0 && <Link href={`/trip/${tripId}`} className={btnSecondary}>View {received} quotes</Link>}
          <button onClick={() => store.sendRfq(inq)} className={btnPrimary}>
            <Send className="h-3.5 w-3.5" /> Send RFQ
          </button>
        </div>
      </>
    );
  } else if (pending > 0) {
    body = (
      <>
        <Loader2 className="h-4 w-4 animate-spin text-navy-700" />
        <span className="text-navy-700">RFQ out to {inq.operatorsContacted} operators. {total - pending} of {total} responses parsed.</span>
        <Link href={`/trip/${tripId}`} className={`${btnPrimary} ml-auto`}>Watch quotes arrive <ArrowRight className="h-3.5 w-3.5" /></Link>
      </>
    );
  } else {
    body = (
      <>
        <span className="text-slate-800">
          {received} quote{received === 1 ? "" : "s"} received and ranked.{" "}
          {proposalStatus === "Sent" ? "Proposal sent, awaiting client decision." : "Pick the best options and send the client a proposal."}
        </span>
        <Link href={`/trip/${tripId}`} className={`${btnPrimary} ml-auto`}>
          {proposalStatus === "Sent" ? "Open trip" : "Compare and propose"} <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </>
    );
  }

  return (
    <div className="rounded-xl border border-navy-200 bg-navy-50 px-4 py-3 flex items-center gap-3 flex-wrap text-sm">
      <span className="text-[10px] uppercase tracking-wider text-navy-700 font-medium">Next step</span>
      {body}
    </div>
  );
}

function AirportBlock({ icao, right }: { icao: string; right?: boolean }) {
  return (
    <div className={right ? "text-right" : ""}>
      <div className="text-2xl font-semibold text-slate-900 tracking-tight">{getIATA(icao)}</div>
      <div className="text-xs text-slate-500">{getAirportCity(icao)}</div>
      <div className="text-[10px] text-slate-400">{getAirportName(icao)} &middot; {icao}</div>
    </div>
  );
}

function Item({ label, value, sub, icon }: { label: string; value: string | null; sub?: string | null; icon?: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] text-slate-500">{label}</dt>
      <dd className={`mt-0.5 flex items-center gap-1 ${value ? "text-slate-800" : "text-amber-700"}`}>
        {icon}
        {value ?? "Missing"}
      </dd>
      {sub && <dd className="text-[11px] text-slate-500">{sub}</dd>}
    </div>
  );
}

function DraftBox({ kind, inq, title, bcc, embedded }: { kind: "followup" | "rfq"; inq: Inquiry; title: string; bcc?: string[]; embedded?: boolean }) {
  const store = useStore()!;
  const { settings } = store.state;
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [aiUsed, setAiUsed] = useState<boolean | null>(null);

  async function draft() {
    setLoading(true);
    const fallback = kind === "followup" ? followupTemplate(inq, settings) : rfqTemplate(inq, settings);
    try {
      const res = await fetch("/api/ai/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          context: {
            broker: settings,
            client: { name: inq.clientName, company: inq.company },
            request: inq.rawText,
            extracted: {
              from: inq.origin && `${getAirportName(inq.origin)} (${inq.origin})`,
              to: inq.destination && `${getAirportName(inq.destination)} (${inq.destination})`,
              date: inq.date, time: inq.departureTime, returnDate: inq.returnDate, passengers: inq.pax,
              category: inq.category ?? inq.estimate.recommended, pets: inq.pets, notes: inq.notes,
            },
            missing: inq.qualification.missing,
          },
        }),
      });
      const data = await res.json();
      const d = data.draft ?? fallback;
      setText(`Subject: ${d.subject}\n\n${d.body}`);
      setAiUsed(!!data.draft);
    } catch {
      setText(`Subject: ${fallback.subject}\n\n${fallback.body}`);
      setAiUsed(false);
    } finally {
      setLoading(false);
    }
  }

  const subject = text.match(/^Subject: (.*)$/m)?.[1] ?? "";
  const body = text.replace(/^Subject: .*\n\n?/, "");
  const to = kind === "followup" ? inq.clientEmail ?? "" : "";
  const mailto = `mailto:${encodeURIComponent(to)}?${bcc?.length ? `bcc=${encodeURIComponent(bcc.join(","))}&` : ""}subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  const content = (
    <div className="space-y-2">
      {!text ? (
        <button onClick={draft} disabled={loading} className={`${btnSecondary} w-full`}>
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          {kind === "followup" ? "Draft follow up asking for missing details" : "Draft RFQ email"}
        </button>
      ) : (
        <>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={10} className={`${inputCls} font-mono text-[11px] leading-relaxed`} />
          <div className="flex items-center gap-2">
            <a href={mailto} className={btnPrimary} onClick={() => store.log({ kind: "ai", text: `${kind === "followup" ? "Follow up" : "RFQ"} sent for ${inq.clientName ?? inq.id}`, href: `/inquiries/${inq.id}` })}>
              <Mail className="h-3.5 w-3.5" /> Open in mail
            </a>
            <button
              onClick={() => {
                navigator.clipboard?.writeText(body);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              className={btnSecondary}
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} Copy
            </button>
            <span className="ml-auto text-[10px] text-slate-400">{aiUsed ? "Drafted by Claude" : "Template"}</span>
          </div>
        </>
      )}
    </div>
  );

  return embedded ? content : <Panel title={title}>{content}</Panel>;
}
