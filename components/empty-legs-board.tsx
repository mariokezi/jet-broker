"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { format, formatDistanceToNow, parseISO, addDays } from "date-fns";
import { Plane, Plus, Send, Sparkles, Building2, Users, Check, Clock, X, ArrowRight } from "lucide-react";
import { useStore } from "./store-provider";
import { LoadingBlock, PageHeader, Panel, TierBadge, btnPrimary, btnSecondary, inputCls } from "./ui-bits";
import { getAirportCity, getIATA, listAirports } from "@/lib/airport-lookup";
import { categoryList } from "@/lib/qualify";
import { CATEGORIES, categoryFromAircraft } from "@/lib/fleet";
import { newId } from "@/lib/demo-state";
import { money, moneyK } from "@/lib/money";
import { charterEstimateFor, findMatches, legRegions, REGION_NAMES, type EmptyLeg, type LegMatch } from "@/lib/empty-legs";
import type { AircraftCategory, Inquiry } from "@/lib/types";

type Tab = "network" | "mine" | "closed";

const AIRPORTS = listAirports();

function dateRange(leg: EmptyLeg): string {
  const a = parseISO(leg.earliest);
  const b = parseISO(leg.latest);
  return leg.earliest === leg.latest ? format(a, "EEE, MMM d") : `${format(a, "MMM d")} to ${format(b, "MMM d")}`;
}

export function EmptyLegsBoard() {
  const store = useStore();
  const router = useRouter();
  const params = useSearchParams();
  const [tab, setTab] = useState<Tab>("network");
  const [region, setRegion] = useState<string>("All");
  const [category, setCategory] = useState<string>("");
  const [picked, setPicked] = useState<string | null>(params.get("leg"));
  const postFrom = params.get("post");
  const [posting, setPosting] = useState<boolean>(postFrom !== null);

  const matches = useMemo(() => (store ? findMatches(store.state.emptyLegs, store.state.inquiries) : []), [store]);

  if (!store) return <LoadingBlock />;
  const { state } = store;

  const inTab = (l: EmptyLeg) =>
    tab === "network" ? !l.isMine && (l.status === "Open" || l.status === "Pending") : tab === "mine" ? l.isMine && l.status !== "Withdrawn" : l.status === "Claimed" || l.status === "Withdrawn";
  const legs = state.emptyLegs
    .filter(inTab)
    .filter((l) => region === "All" || legRegions(l).includes(region))
    .filter((l) => !category || l.category === category)
    .sort((a, b) => a.earliest.localeCompare(b.earliest));

  const selected = state.emptyLegs.find((l) => l.id === picked) ?? legs[0] ?? null;
  const networkOpen = state.emptyLegs.filter((l) => !l.isMine && l.status === "Open").length;
  const floridaOpen = state.emptyLegs.filter((l) => !l.isMine && l.status === "Open" && legRegions(l).includes("Florida")).length;

  function select(id: string) {
    setPicked(id);
    router.replace(`/empty-legs?leg=${id}`, { scroll: false });
  }

  return (
    <>
      <PageHeader
        title="Empty Legs Network"
        subtitle={`${networkOpen} open legs from brokers and operators · ${floridaOpen} touching Florida · ${matches.length} match${matches.length === 1 ? "es" : ""} your open inquiries`}
        actions={
          <button onClick={() => setPosting(true)} className={btnPrimary}>
            <Plus className="h-4 w-4" /> Post empty leg
          </button>
        }
      />

      {matches.length > 0 && (
        <div className="mb-6 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.05] p-4">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-4 w-4 text-emerald-300" />
            <h2 className="text-sm font-medium text-emerald-100">Matches for your clients</h2>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {matches.map((m) => (
              <MatchCard key={`${m.leg.id}-${m.inquiry.id}`} m={m} onOpen={() => { setTab("network"); select(m.leg.id); }} />
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 flex-wrap mb-4">
        <div className="flex items-center gap-1 rounded-lg border border-white/8 bg-white/[0.02] p-0.5">
          {([
            ["network", "Network"],
            ["mine", "My posted legs"],
            ["closed", "Claimed / closed"],
          ] as [Tab, string][]).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${tab === k ? "bg-blue-600/20 text-blue-300 border border-blue-500/20" : "text-white/40 hover:text-white/60 border border-transparent"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {["All", ...REGION_NAMES].map((r) => (
            <button
              key={r}
              onClick={() => setRegion(r)}
              className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors ${region === r ? "border-blue-500/40 bg-blue-500/10 text-blue-200" : "border-white/10 text-white/45 hover:text-white/75"}`}
            >
              {r}
            </button>
          ))}
        </div>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className={`${inputCls.replace("w-full", "w-44")} py-1.5 text-xs`}>
          <option value="" className="bg-slate-900">Any aircraft</option>
          {categoryList().map((c) => <option key={c} value={c} className="bg-slate-900">{c}</option>)}
        </select>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
        <div className="space-y-2 min-w-0">
          {legs.length === 0 && (
            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-12 text-center text-sm text-white/35">
              {tab === "mine" ? "You haven't posted any legs. Post an empty return so other brokers can fill it." : "No legs match these filters."}
            </div>
          )}
          {legs.map((leg) => (
            <LegRow key={leg.id} leg={leg} active={selected?.id === leg.id} matchCount={matches.filter((m) => m.leg.id === leg.id).length} onClick={() => select(leg.id)} />
          ))}
          {store.mode === "demo" && <p className="text-[11px] text-white/25 pt-1">Demo mode: network brokers, operators, and their replies are simulated.</p>}
        </div>

        {selected && <LegDetail key={selected.id} leg={selected} matches={matches.filter((m) => m.leg.id === selected.id)} />}
      </div>

      {posting && <PostLegDialog bookingId={postFrom} onClose={() => { setPosting(false); if (postFrom) router.replace("/empty-legs"); }} onPosted={(id) => { setPosting(false); setTab("mine"); select(id); }} />}
    </>
  );
}

function MatchCard({ m, onOpen }: { m: LegMatch; onOpen: () => void }) {
  return (
    <button onClick={onOpen} className="text-left rounded-lg border border-emerald-500/15 bg-slate-950/40 px-3 py-2.5 hover:border-emerald-400/40 transition-colors">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-white">
          {m.inquiry.clientName ?? "Client"} <span className="text-white/35">&middot; {m.inquiry.pax ?? "?"} pax &middot; {m.inquiry.date && format(parseISO(m.inquiry.date), "MMM d")}</span>
        </span>
        {m.savingsPct !== null && <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[11px] font-medium text-emerald-300 whitespace-nowrap">Save ~{m.savingsPct}%</span>}
      </div>
      <div className="text-xs text-white/50 mt-0.5">
        {getIATA(m.leg.origin)} &rarr; {getIATA(m.leg.destination)} &middot; {m.leg.aircraft} &middot; {money(m.leg.askingPrice)}
        {m.charterEstimate && <span className="text-white/30"> vs ~{moneyK(m.charterEstimate)} charter</span>}
      </div>
      <div className="text-[11px] text-white/30 mt-0.5">Posted by {m.leg.postedBy.company}</div>
    </button>
  );
}

function PosterBadge({ kind }: { kind: "Broker" | "Operator" }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${kind === "Operator" ? "border-sky-500/25 bg-sky-500/10 text-sky-300" : "border-violet-500/25 bg-violet-500/10 text-violet-300"}`}>
      {kind === "Operator" ? <Building2 className="h-2.5 w-2.5" /> : <Users className="h-2.5 w-2.5" />}
      {kind}
    </span>
  );
}

function StatusPill({ leg }: { leg: EmptyLeg }) {
  const map = {
    Open: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
    Pending: "border-amber-500/25 bg-amber-500/10 text-amber-300",
    Claimed: "border-blue-500/25 bg-blue-500/10 text-blue-300",
    Withdrawn: "border-white/10 bg-white/5 text-white/40",
  }[leg.status];
  return <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${map}`}>{leg.status === "Pending" ? "Awaiting confirmation" : leg.status}</span>;
}

function LegRow({ leg, active, matchCount, onClick }: { leg: EmptyLeg; active: boolean; matchCount: number; onClick: () => void }) {
  const store = useStore()!;
  const charter = charterEstimateFor(leg);
  const unread = store.state.legMessages.filter((m) => m.legId === leg.id && !m.fromMe && Date.parse(m.at) <= store.now).length;
  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-xl border p-4 transition-all ${active ? "border-blue-500/40 bg-blue-500/[0.06]" : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-white">{getIATA(leg.origin)}</span>
            <Plane className="h-3.5 w-3.5 text-white/30" />
            <span className="font-semibold text-white">{getIATA(leg.destination)}</span>
            <span className="text-xs text-white/40">{getAirportCity(leg.origin)} to {getAirportCity(leg.destination)}</span>
            {matchCount > 0 && <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-300">{matchCount} client match</span>}
          </div>
          <div className="text-xs text-white/45 mt-1">
            {dateRange(leg)} &middot; {leg.aircraft} &middot; {leg.seats} seats
          </div>
          <div className="flex items-center gap-2 mt-1.5 text-[11px] text-white/35">
            <PosterBadge kind={leg.postedBy.kind} />
            <span>{leg.isMine ? "You" : leg.postedBy.company}</span>
            <span>&middot; {formatDistanceToNow(parseISO(leg.postedAt), { addSuffix: true })}</span>
            {unread > 0 && <span className="text-blue-300">&middot; {unread} message{unread === 1 ? "" : "s"}</span>}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-base font-semibold text-white tabular-nums">{money(leg.askingPrice)}</div>
          {charter && <div className="text-[11px] text-emerald-300/80">~{Math.max(0, Math.round((1 - leg.askingPrice / charter) * 100))}% below charter</div>}
          <div className="mt-1.5"><StatusPill leg={leg} /></div>
        </div>
      </div>
    </button>
  );
}

function LegDetail({ leg, matches }: { leg: EmptyLeg; matches: LegMatch[] }) {
  const store = useStore()!;
  const { state, now } = store;
  const [text, setText] = useState("");
  const [claiming, setClaiming] = useState(false);
  const charter = charterEstimateFor(leg);
  const thread = state.legMessages.filter((m) => m.legId === leg.id && Date.parse(m.at) <= now).sort((a, b) => a.at.localeCompare(b.at));
  const typing = state.legMessages.some((m) => m.legId === leg.id && Date.parse(m.at) > now);

  function send() {
    if (!text.trim()) return;
    store.sendLegMessage(leg.id, text.trim());
    setText("");
  }

  return (
    <Panel title={leg.isMine ? "Your posted leg" : `Leg ${leg.id}`} action={<StatusPill leg={leg} />} className="h-fit lg:sticky lg:top-20">
      <div className="flex items-center gap-3 mb-3">
        <div>
          <div className="text-2xl font-semibold text-white">{getIATA(leg.origin)}</div>
          <div className="text-[11px] text-white/40">{getAirportCity(leg.origin)}</div>
        </div>
        <div className="flex-1 flex items-center gap-1.5 text-white/20">
          <div className="h-px flex-1 bg-white/10" />
          <Plane className="h-3.5 w-3.5 text-blue-300/70" />
          <div className="h-px flex-1 bg-white/10" />
        </div>
        <div className="text-right">
          <div className="text-2xl font-semibold text-white">{getIATA(leg.destination)}</div>
          <div className="text-[11px] text-white/40">{getAirportCity(leg.destination)}</div>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs mb-3">
        <Info label="Window" value={dateRange(leg)} />
        <Info label="Aircraft" value={`${leg.aircraft}${leg.tailNumber ? ` · ${leg.tailNumber}` : ""}`} />
        <Info label="Seats" value={String(leg.seats)} />
        <Info label="Category" value={leg.category} />
        <Info label="Posted by" value={leg.isMine ? `You (${leg.postedBy.company})` : `${leg.postedBy.name}, ${leg.postedBy.company}`} />
        <Info label="Type" value={leg.postedBy.kind} />
      </dl>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
          <div className="text-[10px] uppercase tracking-wider text-white/35">Asking</div>
          <div className="text-sm font-semibold text-white tabular-nums">{money(leg.askingPrice)}</div>
        </div>
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.05] px-3 py-2">
          <div className="text-[10px] uppercase tracking-wider text-white/35">Typical charter</div>
          <div className="text-sm font-semibold text-emerald-300 tabular-nums">{charter ? `~${money(charter)}` : "—"}</div>
        </div>
      </div>
      {leg.notes && <p className="text-xs text-white/55 mb-3">{leg.notes}</p>}

      {matches.length > 0 && (
        <div className="mb-3 rounded-lg border border-emerald-500/15 bg-emerald-500/[0.04] px-3 py-2 text-xs">
          <div className="text-emerald-200 mb-1">Fits your open inquiries:</div>
          {matches.map((m) => (
            <div key={m.inquiry.id} className="flex items-center justify-between py-0.5">
              <span className="text-white/75">{m.inquiry.clientName} &middot; {m.inquiry.pax ?? "?"} pax &middot; {m.inquiry.date}</span>
              <TierBadge tier={m.inquiry.qualification.tier} score={m.inquiry.qualification.score} />
            </div>
          ))}
        </div>
      )}

      {!leg.isMine && leg.status === "Open" && !claiming && (
        <button onClick={() => setClaiming(true)} className={`${btnPrimary} w-full mb-3`}>
          <Check className="h-4 w-4" /> Claim this leg for a client
        </button>
      )}
      {claiming && <ClaimForm leg={leg} matches={matches} onDone={() => setClaiming(false)} />}
      {leg.status === "Pending" && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/[0.06] px-3 py-2 text-xs text-amber-100/90">
          <Clock className="h-3.5 w-3.5 animate-pulse" /> Claim sent for {leg.claim?.clientName}. Waiting for {leg.postedBy.company} to confirm.
        </div>
      )}
      {leg.status === "Claimed" && leg.claim && (
        <a href="/schedule" className="mb-3 flex items-center gap-2 rounded-lg border border-blue-500/20 bg-blue-500/[0.06] px-3 py-2 text-xs text-blue-100/90 hover:bg-blue-500/10">
          <Check className="h-3.5 w-3.5" /> Booked for {leg.claim.clientName} at {money(leg.claim.clientPrice)}. Margin {money(leg.claim.clientPrice - leg.askingPrice)}.
          <ArrowRight className="h-3.5 w-3.5 ml-auto" />
        </a>
      )}
      {leg.isMine && leg.status === "Open" && (
        <div className="flex gap-2 mb-3">
          <button onClick={() => store.setLegStatus(leg.id, "Claimed")} className={`${btnSecondary} flex-1`}><Check className="h-3.5 w-3.5" /> Mark filled</button>
          <button onClick={() => store.setLegStatus(leg.id, "Withdrawn")} className={`${btnSecondary} flex-1`}><X className="h-3.5 w-3.5" /> Withdraw</button>
        </div>
      )}

      <div className="border-t border-white/5 pt-3">
        <div className="text-[11px] uppercase tracking-wider text-white/40 mb-2">Messages</div>
        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {thread.length === 0 && <p className="text-xs text-white/30">No messages yet. Ask about timing, price, or the aircraft.</p>}
          {thread.map((m) => (
            <div key={m.id} className={`flex ${m.fromMe ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-xl px-3 py-2 text-xs ${m.fromMe ? "bg-blue-600/80 text-white" : "bg-white/[0.06] text-white/85"}`}>
                {!m.fromMe && <div className="text-[10px] text-white/45 mb-0.5">{m.author}</div>}
                {m.text}
                <div className={`text-[9px] mt-1 ${m.fromMe ? "text-white/60" : "text-white/30"}`}>{format(parseISO(m.at), "MMM d, h:mm a")}</div>
              </div>
            </div>
          ))}
          {typing && <div className="text-[11px] text-white/35 italic">typing...</div>}
        </div>
        <div className="flex gap-2 mt-3">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder={leg.isMine ? "Reply to interested brokers..." : `Message ${leg.postedBy.name.split(" ")[0]}...`}
            className={inputCls}
          />
          <button onClick={send} disabled={!text.trim()} className={btnPrimary} aria-label="Send message">
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </Panel>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-white/35">{label}</dt>
      <dd className="text-white/80">{value}</dd>
    </div>
  );
}

function ClaimForm({ leg, matches, onDone }: { leg: EmptyLeg; matches: LegMatch[]; onDone: () => void }) {
  const store = useStore()!;
  const open = store.state.inquiries.filter((i) => i.status !== "Booked" && i.status !== "Lost");
  const firstMatch = matches[0]?.inquiry ?? null;
  const [inquiryId, setInquiryId] = useState<string>(firstMatch?.id ?? "");
  const [clientName, setClientName] = useState<string>(firstMatch?.clientName ?? "");
  const [markup, setMarkup] = useState(store.state.settings.defaultMarkupPct + 8);
  const clientPrice = Math.round((leg.askingPrice * (1 + markup / 100)) / 50) * 50;

  function chooseInquiry(id: string) {
    setInquiryId(id);
    const inq: Inquiry | undefined = open.find((i) => i.id === id);
    if (inq?.clientName) setClientName(inq.clientName);
  }

  function confirm() {
    store.claimLeg(leg.id, { inquiryId: inquiryId || null, clientName: clientName || "Client", clientPrice });
    onDone();
  }

  return (
    <div className="mb-3 rounded-lg border border-blue-500/20 bg-blue-500/[0.05] p-3 space-y-2.5">
      <label className="block">
        <span className="text-[11px] text-white/45">For inquiry</span>
        <select className={`${inputCls} mt-1`} value={inquiryId} onChange={(e) => chooseInquiry(e.target.value)}>
          <option value="" className="bg-slate-900">No inquiry (new client)</option>
          {open.map((i) => (
            <option key={i.id} value={i.id} className="bg-slate-900">
              {matches.some((m) => m.inquiry.id === i.id) ? "★ " : ""}{i.clientName ?? i.id} {i.origin && i.destination ? `(${getIATA(i.origin)}-${getIATA(i.destination)})` : ""}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="text-[11px] text-white/45">Client name</span>
        <input className={`${inputCls} mt-1`} value={clientName} onChange={(e) => setClientName(e.target.value)} />
      </label>
      <div>
        <div className="flex items-center justify-between text-[11px] mb-1">
          <span className="text-white/45">Your markup</span>
          <span className="text-white/80 tabular-nums">{markup}%</span>
        </div>
        <input type="range" min={0} max={40} value={markup} onChange={(e) => setMarkup(Number(e.target.value))} className="w-full accent-blue-500" />
      </div>
      <div className="flex justify-between text-xs">
        <span className="text-white/50">Client pays {money(clientPrice)}</span>
        <span className="text-emerald-300 font-medium">Margin {money(clientPrice - leg.askingPrice)}</span>
      </div>
      <div className="flex gap-2">
        <button onClick={onDone} className={`${btnSecondary} flex-1`}>Cancel</button>
        <button onClick={confirm} disabled={!clientName.trim()} className={`${btnPrimary} flex-1`}>Send claim</button>
      </div>
    </div>
  );
}

function PostLegDialog({ bookingId, onClose, onPosted }: { bookingId: string | null; onClose: () => void; onPosted: (id: string) => void }) {
  const store = useStore()!;
  const { settings } = store.state;
  const booking = bookingId ? store.state.bookings.find((b) => b.id === bookingId) : undefined;

  // Posting from a booking pre-fills the empty return: reversed route, same aircraft
  const initial = useMemo(() => {
    const today = format(new Date(), "yyyy-MM-dd");
    if (!booking) {
      return { origin: "KPBI", destination: "KTEB", earliest: today, latest: format(addDays(new Date(), 2), "yyyy-MM-dd"), aircraft: "", category: "Midsize Jet" as AircraftCategory, seats: 8, tail: "", price: 0, notes: "" };
    }
    const base = {
      origin: booking.destination,
      destination: booking.origin,
      category: categoryFromAircraft(booking.aircraft) ?? ("Midsize Jet" as AircraftCategory),
      seats: CATEGORIES.flatMap((c) => c.models).find((m) => booking.aircraft.toLowerCase().includes(m.name.toLowerCase()))?.pax ?? 8,
    };
    const est = charterEstimateFor(base);
    return {
      ...base,
      earliest: booking.date,
      latest: format(addDays(parseISO(booking.date), 2), "yyyy-MM-dd"),
      aircraft: booking.aircraft,
      tail: booking.tailNumber ?? "",
      price: est ? Math.round((est * 0.4) / 100) * 100 : Math.round((booking.operatorPrice * 0.4) / 100) * 100,
      notes: `Empty return after our ${getIATA(booking.origin)} to ${getIATA(booking.destination)} trip (${booking.id}).`,
    };
  }, [booking]);

  const [f, setF] = useState(initial);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF({ ...f, [k]: v });
  const charter = charterEstimateFor({ origin: f.origin, destination: f.destination, category: f.category, seats: f.seats });
  const valid = f.origin && f.destination && f.origin !== f.destination && f.aircraft.trim() && f.price > 0 && f.earliest <= f.latest;

  function post() {
    const id = newId("EL");
    store.postLeg({
      id,
      postedAt: new Date().toISOString(),
      postedBy: { name: settings.brokerName, company: settings.companyName, kind: "Broker" },
      isMine: true,
      origin: f.origin,
      destination: f.destination,
      earliest: f.earliest,
      latest: f.latest,
      aircraft: f.aircraft.trim(),
      category: f.category,
      seats: f.seats,
      tailNumber: f.tail.trim() || null,
      askingPrice: f.price,
      notes: f.notes.trim() || null,
      status: "Open",
      claim: null,
      sourceBookingId: booking?.id ?? null,
    });
    onPosted(id);
  }

  const airportOptions = AIRPORTS.map((a) => (
    <option key={a.icao} value={a.icao} className="bg-slate-900">{a.icao} &middot; {a.city}</option>
  ));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-slate-900 p-5 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-semibold text-white">Post an empty leg</h3>
        <p className="text-xs text-white/40 mt-0.5">Brokers and operators on the network can message you and claim it.</p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Field label="From"><select className={inputCls} value={f.origin} onChange={(e) => set("origin", e.target.value)}>{airportOptions}</select></Field>
          <Field label="To"><select className={inputCls} value={f.destination} onChange={(e) => set("destination", e.target.value)}>{airportOptions}</select></Field>
          <Field label="Earliest"><input type="date" className={inputCls} value={f.earliest} onChange={(e) => set("earliest", e.target.value)} /></Field>
          <Field label="Latest"><input type="date" className={inputCls} value={f.latest} onChange={(e) => set("latest", e.target.value)} /></Field>
          <Field label="Aircraft"><input className={inputCls} placeholder="e.g. Citation XLS+" value={f.aircraft} onChange={(e) => set("aircraft", e.target.value)} /></Field>
          <Field label="Category">
            <select className={inputCls} value={f.category} onChange={(e) => set("category", e.target.value as AircraftCategory)}>
              {categoryList().map((c) => <option key={c} value={c} className="bg-slate-900">{c}</option>)}
            </select>
          </Field>
          <Field label="Seats"><input type="number" min={1} className={inputCls} value={f.seats} onChange={(e) => set("seats", Number(e.target.value))} /></Field>
          <Field label="Tail number"><input className={inputCls} value={f.tail} onChange={(e) => set("tail", e.target.value)} /></Field>
          <Field label="Asking price (USD)"><input type="number" min={0} className={inputCls} value={f.price || ""} onChange={(e) => set("price", Number(e.target.value))} /></Field>
          <div className="flex items-end text-[11px] text-white/40 pb-2">{charter ? <>Typical charter ~{money(charter)}{f.price > 0 && <span className="text-emerald-300 ml-1">({Math.max(0, Math.round((1 - f.price / charter) * 100))}% below)</span>}</> : null}</div>
        </div>
        <Field label="Notes"><textarea rows={2} className={`${inputCls} mt-0`} value={f.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className={btnSecondary}>Cancel</button>
          <button onClick={post} disabled={!valid} className={btnPrimary}>Post to network</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block mt-1">
      <span className="text-[11px] text-white/40">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
