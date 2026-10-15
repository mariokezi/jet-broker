"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Loader2, Send, Save, Cpu } from "lucide-react";
import { useStore } from "./store-provider";
import { Panel, TierBadge, btnPrimary, btnSecondary, inputCls } from "./ui-bits";
import { EstimateTable, ScoreRing, ReasonsList } from "./qualification-view";
import { qualify, categoryList } from "@/lib/qualify";
import { listAirports, getIATA } from "@/lib/airport-lookup";
import { newId } from "@/lib/demo-state";
import { generateTripId } from "@/lib/trip-id";
import type { Inquiry, InquiryFields, InquirySource, Qualification, TripEstimate } from "@/lib/types";

interface ParseResult {
  fields: InquiryFields;
  qualification: Qualification;
  estimate: TripEstimate;
  aiUsed: boolean;
  elapsedMs: number;
}

export async function parseInquiry(text: string): Promise<ParseResult> {
  const res = await fetch("/api/inquiries/parse", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error(`Parse failed (${res.status})`);
  return res.json();
}

export function buildInquiry(fields: InquiryFields, rawText: string, source: InquirySource, aiUsed: boolean): Inquiry {
  const { qualification, estimate } = qualify(fields);
  const ready = qualification.tier !== "Cold" && fields.origin && fields.destination && fields.date;
  return {
    ...fields,
    id: newId("INQ"),
    createdAt: new Date().toISOString(),
    source,
    rawText,
    status: ready ? "Qualified" : "New",
    qualification,
    estimate,
    aiUsed,
    rfqSentAt: null,
    operatorsContacted: 0,
  };
}

const SAMPLES: { label: string; source: InquirySource; text: string }[] = [
  {
    label: "Hot: NY to Aspen, family ski trip",
    source: "Email",
    text: `Hi there,

We're looking to get to Aspen for a ski week. Teterboro to Aspen next Friday, ideally wheels up around 8am, returning the following Sunday. 7 passengers including 2 kids, plenty of skis and bags. Super midsize or larger please. Budget around $120k round trip, all in.

Thanks,
Catherine Moore
Moore Family Office
cmoore@moorefamilyoffice.com
(646) 555-0114`,
  },
  {
    label: "Warm: call notes, Detroit to Naples",
    source: "Phone",
    text: `Call with David Kline from Kline Automotive. Wants Detroit (Pontiac) to Naples, FL on ${nextDate(12)} in the afternoon. 3 passengers plus a small dog. Light or midsize. No budget given. dkline@klineauto.com`,
  },
  {
    label: "Cold: vague web form",
    source: "Web Form",
    text: `whats the price for a jet to miami for like 10 people

- Jess
jess.party.planner@gmail.com`,
  },
];

function nextDate(days: number): string {
  const d = new Date(Date.now() + days * 86_400_000);
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric" });
}

const AIRPORTS = listAirports();

export function InquiryIntake() {
  const store = useStore();
  const router = useRouter();
  const [text, setText] = useState("");
  const [source, setSource] = useState<InquirySource>("Email");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<InquiryFields | null>(null);
  const [meta, setMeta] = useState<{ aiUsed: boolean; elapsedMs: number } | null>(null);

  const analysis = fields ? qualify(fields) : null;

  async function analyze() {
    setLoading(true);
    setError(null);
    try {
      const result = await parseInquiry(text);
      setFields(result.fields);
      setMeta({ aiUsed: result.aiUsed, elapsedMs: result.elapsedMs });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not analyze request");
    } finally {
      setLoading(false);
    }
  }

  function set<K extends keyof InquiryFields>(key: K, value: InquiryFields[K]) {
    setFields((f) => (f ? { ...f, [key]: value } : f));
  }

  function create(withRfq: boolean) {
    if (!store || !fields) return;
    const inq = buildInquiry(fields, text, source, meta?.aiUsed ?? false);
    store.addInquiry(inq);
    store.log({
      kind: "qualified",
      text: `${inq.clientName ?? "New lead"} scored ${inq.qualification.score} (${inq.qualification.tier})${inq.origin && inq.destination ? `: ${getIATA(inq.origin)} to ${getIATA(inq.destination)}` : ""}`,
      href: `/inquiries/${inq.id}`,
    });
    if (withRfq) store.sendRfq(inq);
    router.push(withRfq && store.mode === "demo" ? `/trip/${tripIdFor(inq)}` : `/inquiries/${inq.id}`);
  }

  const canRfq = !!(fields?.origin && fields?.destination && fields?.date);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <Panel title="Client request">
          <div className="flex flex-wrap gap-1.5 mb-3">
            {SAMPLES.map((s) => (
              <button
                key={s.label}
                onClick={() => {
                  setText(s.text);
                  setSource(s.source);
                  setFields(null);
                }}
                className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-600 hover:text-slate-900 hover:border-slate-300 transition-colors"
              >
                {s.label}
              </button>
            ))}
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={14}
            placeholder="Paste a client email, web form submission, text message, or call notes..."
            className={`${inputCls} font-mono text-xs leading-relaxed`}
          />
          <div className="flex items-center justify-between gap-3 mt-3 flex-wrap">
            <select value={source} onChange={(e) => setSource(e.target.value as InquirySource)} className={`${inputCls} w-auto`}>
              {(["Email", "Web Form", "Phone", "Referral"] as InquirySource[]).map((s) => (
                <option key={s} value={s} className="bg-white">{s}</option>
              ))}
            </select>
            <button onClick={analyze} disabled={loading || !text.trim()} className={btnPrimary}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {loading ? "Analyzing..." : "Qualify and estimate"}
            </button>
          </div>
          {error && <p className="text-xs text-red-700 mt-2">{error}</p>}
        </Panel>

        {fields && (
          <Panel title="Extracted trip details" action={meta && <AiBadge aiUsed={meta.aiUsed} ms={meta.elapsedMs} />}>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Client name"><input className={inputCls} value={fields.clientName ?? ""} onChange={(e) => set("clientName", e.target.value || null)} /></Field>
              <Field label="Company"><input className={inputCls} value={fields.company ?? ""} onChange={(e) => set("company", e.target.value || null)} /></Field>
              <Field label="Email"><input className={inputCls} value={fields.clientEmail ?? ""} onChange={(e) => set("clientEmail", e.target.value || null)} /></Field>
              <Field label="Phone"><input className={inputCls} value={fields.clientPhone ?? ""} onChange={(e) => set("clientPhone", e.target.value || null)} /></Field>
              <Field label="From">
                <AirportSelect value={fields.origin} onChange={(v) => set("origin", v)} />
              </Field>
              <Field label="To">
                <AirportSelect value={fields.destination} onChange={(v) => set("destination", v)} />
              </Field>
              <Field label="Departure date"><input type="date" className={inputCls} value={fields.date ?? ""} onChange={(e) => set("date", e.target.value || null)} /></Field>
              <Field label="Return date"><input type="date" className={inputCls} value={fields.returnDate ?? ""} onChange={(e) => set("returnDate", e.target.value || null)} /></Field>
              <Field label="Passengers"><input type="number" min={1} className={inputCls} value={fields.pax ?? ""} onChange={(e) => set("pax", e.target.value ? Number(e.target.value) : null)} /></Field>
              <Field label="Departure time"><input className={inputCls} value={fields.departureTime ?? ""} onChange={(e) => set("departureTime", e.target.value || null)} /></Field>
              <Field label="Aircraft category">
                <select className={inputCls} value={fields.category ?? ""} onChange={(e) => set("category", (e.target.value || null) as InquiryFields["category"])}>
                  <option value="" className="bg-white">Any</option>
                  {categoryList().map((c) => <option key={c} value={c} className="bg-white">{c}</option>)}
                </select>
              </Field>
              <Field label="Budget (USD)"><input type="number" className={inputCls} value={fields.budget ?? ""} onChange={(e) => set("budget", e.target.value ? Number(e.target.value) : null)} /></Field>
            </div>
            {(fields.notes || fields.pets) && (
              <p className="text-xs text-slate-500 mt-3">
                {fields.pets && <span className="mr-2 rounded bg-slate-50 px-1.5 py-0.5">Pet on board</span>}
                {fields.notes}
              </p>
            )}
          </Panel>
        )}
      </div>

      <div className="space-y-4">
        {!analysis ? (
          <div className="rounded-xl border border-dashed border-slate-200 p-10 text-center text-sm text-slate-500 h-full flex flex-col items-center justify-center min-h-[320px]">
            <Sparkles className="h-6 w-6 text-navy-700 mb-3" />
            Paste any request and the assistant extracts the trip, scores the lead,
            <br className="hidden sm:block" /> and prices it against the market in seconds.
          </div>
        ) : (
          <>
            <Panel title="Lead qualification">
              <div className="flex items-center gap-5">
                <ScoreRing score={analysis.qualification.score} tier={analysis.qualification.tier} />
                <div className="min-w-0">
                  <TierBadge tier={analysis.qualification.tier} score={analysis.qualification.score} />
                  <p className="text-sm text-slate-700 mt-2">{analysis.qualification.summary}</p>
                </div>
              </div>
              <ReasonsList reasons={analysis.qualification.reasons} missing={analysis.qualification.missing} />
            </Panel>

            <Panel title="Instant market estimate">
              <EstimateTable estimate={analysis.estimate} selected={fields?.category ?? null} roundTrip={!!fields?.returnDate} />
            </Panel>

            <div className="flex flex-wrap gap-2 justify-end">
              <button onClick={() => create(false)} className={btnSecondary}>
                <Save className="h-4 w-4" /> Save inquiry
              </button>
              <button onClick={() => create(true)} disabled={!canRfq} className={btnPrimary} title={canRfq ? "" : "Route and date required"}>
                <Send className="h-4 w-4" /> Save and send RFQ to operators
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function tripIdFor(inq: Inquiry): string {
  return generateTripId(inq.origin!, inq.destination!, inq.date!);
}

export function AiBadge({ aiUsed, ms }: { aiUsed: boolean; ms: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-slate-500">
      <Cpu className="h-3 w-3" />
      {aiUsed ? "Claude" : "Rules engine"} &middot; {(ms / 1000).toFixed(1)}s
    </span>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] text-slate-500">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function AirportSelect({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  return (
    <select className={inputCls} value={value ?? ""} onChange={(e) => onChange(e.target.value || null)}>
      <option value="" className="bg-white">Unknown</option>
      {value && !AIRPORTS.some((a) => a.icao === value) && <option value={value} className="bg-white">{value}</option>}
      {AIRPORTS.map((a) => (
        <option key={a.icao} value={a.icao} className="bg-white">
          {a.icao} &middot; {a.city} ({a.name})
        </option>
      ))}
    </select>
  );
}
