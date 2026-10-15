"use client";

import Link from "next/link";
import { useMemo } from "react";
import { format, formatDistanceToNow, parseISO } from "date-fns";
import { ArrowRight, ClipboardCheck, Clock, Flame, Mail, Plane, PlaneTakeoff, Plus, Repeat, Sparkles, Timer, TrendingUp, Wallet, Zap } from "lucide-react";
import { AircraftArt } from "./brand";
import { LiveFlights } from "./flight-tracker";
import { flightStatus } from "@/lib/tracking";
import { categoryFromAircraft } from "@/lib/fleet";
import { findMatches } from "@/lib/empty-legs";
import { useStore } from "./store-provider";
import { useMergedTrips } from "./use-trips";
import { LoadingBlock, Panel, btnPrimary } from "./ui-bits";
import { getAirport, getAirportCity, getIATA } from "@/lib/airport-lookup";
import { inquiryTripId } from "@/lib/demo-state";
import { money, moneyK } from "@/lib/money";
import type { ActivityItem, InquiryStatus, Trip } from "@/lib/types";

// Minutes of manual broker work each automated step replaces
const MINUTES = { quote: 6, inquiry: 10, rfq: 15, proposal: 25, booking: 30 };

const FUNNEL: InquiryStatus[] = ["New", "Qualified", "Sourcing", "Quoted", "Proposal Sent", "Booked"];

export function Dashboard({ trips, mode }: { trips: Trip[]; mode: "demo" | "live" }) {
  const store = useStore();
  const merged = useMergedTrips(trips);

  const data = useMemo(() => {
    if (!store) return null;
    const { state, now } = store;
    const inquiries = state.inquiries;
    const open = inquiries.filter((i) => !["Booked", "Lost"].includes(i.status));
    const hot = open.filter((i) => i.qualification.tier === "Hot");
    const allQuotes = merged.flatMap((t) => t.quotes);
    const quotes24h = allQuotes.filter((q) => now - Date.parse(q.receivedAt) < 86_400_000).length;

    const pipeline = open.reduce((sum, i) => {
      const rec = i.estimate.options.find((o) => o.category === (i.category ?? i.estimate.recommended));
      return sum + (rec ? ((rec.low + rec.high) / 2) * (i.returnDate ? 2 : 1) : 0);
    }, 0);

    const today = new Date(now).toISOString().slice(0, 10);
    const in14 = new Date(now + 14 * 86_400_000).toISOString().slice(0, 10);
    const ago30 = new Date(now - 30 * 86_400_000).toISOString().slice(0, 10);
    const upcoming = state.bookings.filter((b) => b.date >= today && b.date <= in14).sort((a, b) => (a.date + a.departureTime).localeCompare(b.date + b.departureTime));
    const recent = state.bookings.filter((b) => b.date >= ago30);
    const revenue = recent.reduce((s, b) => s + b.clientPrice, 0);
    const margin = recent.reduce((s, b) => s + b.clientPrice - b.operatorPrice, 0);

    const proposalsSent = Object.values(state.proposals).filter((p) => p.status !== "Draft").length;
    const rfqs = inquiries.filter((i) => i.rfqSentAt).length;
    const counts = {
      quote: state.history.quotesParsed + allQuotes.length,
      inquiry: state.history.inquiriesQualified + inquiries.length,
      rfq: state.history.rfqsSent + rfqs,
      proposal: state.history.proposalsSent + proposalsSent,
      booking: state.history.bookings + state.bookings.length,
    };
    const minutes = (Object.keys(MINUTES) as (keyof typeof MINUTES)[]).reduce((s, k) => s + counts[k] * MINUTES[k], 0);

    const funnel = FUNNEL.map((status) => ({ status, count: inquiries.filter((i) => i.status === status).length }));

    // Things a broker should do next
    const attention: { key: string; icon: "hot" | "rfq" | "proposal" | "ops" | "leg"; text: string; sub: string; href: string }[] = [];
    for (const m of findMatches(state.emptyLegs, inquiries)) {
      attention.push({
        key: `leg-${m.leg.id}-${m.inquiry.id}`,
        icon: "leg",
        text: `Empty leg fits ${m.inquiry.clientName ?? "a client"}`,
        sub: `${getIATA(m.leg.origin)} to ${getIATA(m.leg.destination)} \u00b7 ${m.leg.aircraft} \u00b7 ${m.savingsPct !== null ? `~${m.savingsPct}% below charter \u00b7 ` : ""}${m.leg.postedBy.company}`,
        href: `/empty-legs?leg=${m.leg.id}`,
      });
    }
    for (const i of open) {
      const tripId = inquiryTripId(i);
      if ((i.status === "Qualified" || i.status === "New") && i.qualification.tier !== "Cold" && tripId) {
        attention.push({ key: i.id, icon: i.qualification.tier === "Hot" ? "hot" : "rfq", text: `Send RFQ for ${i.clientName ?? "lead"}`, sub: `${getIATA(i.origin!)} to ${getIATA(i.destination!)} · score ${i.qualification.score}`, href: `/inquiries/${i.id}` });
      } else if (i.status === "Quoted" && tripId && !state.proposals[tripId]) {
        const n = merged.find((t) => t.tripId === tripId)?.quotes.length ?? 0;
        attention.push({ key: i.id, icon: "proposal", text: `Send proposal to ${i.clientName ?? "client"}`, sub: `${n ? `${n} quotes ranked` : "Quotes in"} · ${getIATA(i.origin!)} to ${getIATA(i.destination!)}`, href: `/trip/${tripId}` });
      } else if (i.status === "New" && i.qualification.missing.length) {
        attention.push({ key: i.id, icon: "rfq", text: `Follow up with ${i.clientName ?? "lead"}`, sub: `Missing ${i.qualification.missing.join(", ").toLowerCase()}`, href: `/inquiries/${i.id}` });
      }
    }
    for (const b of upcoming) {
      const hoursOut = (Date.parse(`${b.date}T${b.departureTime}:00`) - now) / 3_600_000;
      const openItems = b.checklist.filter((c) => !c.done).length;
      if (hoursOut < 96 && openItems > 0) {
        attention.push({ key: b.id, icon: "ops", text: `${openItems} ops item${openItems === 1 ? "" : "s"} open for ${b.clientName}`, sub: `${getIATA(b.origin)} to ${getIATA(b.destination)} departs ${formatDistanceToNow(parseISO(`${b.date}T${b.departureTime}:00`), { addSuffix: true })}`, href: "/schedule" });
      }
    }

    return { open, hot, quotes24h, allQuotes, pipeline, upcoming, revenue, margin, recent, counts, minutes, funnel, attention };
  }, [store, merged]);

  if (!store || !data) return <LoadingBlock />;
  const { state } = store;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const next = data.upcoming.find((b) => flightStatus(b, store.now).departMs > store.now);
  const nextCat = next ? categoryFromAircraft(next.aircraft) ?? "Midsize Jet" : null;

  return (
    <>
      <div className="flex items-end justify-between gap-4 flex-wrap mb-8">
        <div>
          <p className="text-sm text-slate-500">{format(new Date(), "EEEE, MMMM d")}</p>
          <h1 className="mt-1 text-3xl font-semibold text-navy-900 tracking-tight">
            {greeting}, {state.settings.brokerName.split(" ")[0]}
          </h1>
          <p className="text-sm text-slate-500 mt-1.5">
            {data.attention.length} item{data.attention.length === 1 ? "" : "s"} need you today. Everything else is running on its own.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {mode === "demo" && <span className="rounded-full border border-gold-200 bg-gold-50 px-3 py-1 text-xs font-medium text-gold-700">Demo data</span>}
          <Link href="/inquiries/new" className={btnPrimary}>
            <Plus className="h-4 w-4" /> New inquiry
          </Link>
        </div>
      </div>

      {/* Headline numbers */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <Kpi icon={TrendingUp} label="Pipeline value" value={moneyK(data.pipeline)} sub={`${data.open.length} open leads`} href="/inquiries" />
        <Kpi icon={Wallet} label="Booked margin, 30 days" value={moneyK(data.margin)} sub={`on ${moneyK(data.revenue)} revenue`} href="/schedule" />
        <Kpi icon={Flame} label="Hot leads" value={String(data.hot.length)} sub={`${data.quotes24h} quotes parsed today`} href="/inquiries" />
        <Kpi icon={Timer} label="Hours saved, 30 days" value={`${Math.round(data.minutes / 60)}h`} sub={`about ${Math.round(data.minutes / 60 / 4.3)} hours a week`} gold />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_380px] mb-6">
        <Panel
          title={
            <span className="flex items-center gap-2">
              Today <span className="rounded-full bg-navy-50 px-2 py-0.5 text-xs font-semibold text-navy-700 tabular-nums">{data.attention.length}</span>
            </span>
          }
          action={<Link href="/inquiries" className="text-sm font-medium text-navy-700 hover:text-navy-900">All inquiries</Link>}
        >
          {data.attention.length === 0 ? (
            <p className="text-sm text-slate-500 py-6 text-center">You are all caught up. Nothing needs you right now.</p>
          ) : (
            <ul className="-mx-2">
              {data.attention.slice(0, 6).map((a) => (
                <li key={a.key}>
                  <Link href={a.href} className="group flex items-center gap-4 rounded-xl px-2 py-3 hover:bg-slate-50 transition-colors">
                    <AttentionIcon kind={a.icon} />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-navy-900">{a.text}</div>
                      <div className="text-xs text-slate-500 truncate mt-0.5">{a.sub}</div>
                    </div>
                    <span className="hidden sm:inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-navy-900 shadow-sm group-hover:border-navy-200 group-hover:bg-navy-50">
                      {ACTION_LABEL[a.icon]} <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {next && nextCat ? (
          <Link href="/schedule" className="group relative flex flex-col overflow-hidden rounded-2xl bg-navy-900 p-6 text-white shadow-lg shadow-navy-900/10">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-gold-300">Next departure</span>
              <span className="text-xs text-navy-200">{formatDistanceToNow(parseISO(`${next.date}T${next.departureTime}:00`), { addSuffix: true })}</span>
            </div>
            <div className="mt-4 flex items-end justify-between gap-3">
              <div>
                <div className="text-3xl font-semibold tracking-tight">{getIATA(next.origin)}</div>
                <div className="text-xs text-navy-200">{getAirportCity(next.origin)}</div>
              </div>
              <div className="mb-3 flex flex-1 items-center gap-1.5 text-gold-300">
                <span className="h-px flex-1 bg-navy-600" />
                <Plane className="h-4 w-4" />
                <span className="h-px flex-1 bg-navy-600" />
              </div>
              <div className="text-right">
                <div className="text-3xl font-semibold tracking-tight">{getIATA(next.destination)}</div>
                <div className="text-xs text-navy-200">{getAirportCity(next.destination)}</div>
              </div>
            </div>
            <AircraftArt category={nextCat} label={false} className="my-5 flex-1 min-h-36" />
            <div className="flex items-center justify-between text-sm">
              <div>
                <div className="font-medium">{next.clientName}</div>
                <div className="text-xs text-navy-200">{next.aircraft} &middot; {format(parseISO(next.date), "EEE MMM d")} &middot; {next.departureTime}</div>
              </div>
              <div className="text-right">
                <div className="font-semibold text-gold-300 tabular-nums">+{money(next.clientPrice - next.operatorPrice)}</div>
                <div className="text-xs text-navy-200">{next.checklist.filter((c) => c.done).length}/{next.checklist.length} ops done</div>
              </div>
            </div>
          </Link>
        ) : (
          <Panel title="Next departure">
            <p className="text-sm text-slate-500">No flights booked in the next 14 days.</p>
          </Panel>
        )}
      </div>

      {/* Pipeline stages */}
      <Panel title="Pipeline" action={<span className="text-xs text-slate-500">Click a stage to open it</span>} className="mb-6">
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
          {data.funnel.map((f, idx) => (
            <Link
              key={f.status}
              href={`/inquiries?tab=${f.status === "New" || f.status === "Qualified" ? "action" : f.status === "Booked" ? "closed" : "active"}`}
              className="group relative rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-3 hover:border-navy-200 hover:bg-navy-50 transition-colors"
            >
              <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 group-hover:text-navy-700">
                <span className={`h-2 w-2 rounded-full ${STAGE_DOT[idx]}`} /> {f.status}
              </div>
              <div className="mt-1.5 text-2xl font-semibold text-navy-900 tabular-nums">{f.count}</div>
            </Link>
          ))}
        </div>
      </Panel>

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-6 min-w-0">
          <Panel title="Upcoming flights" action={<Link href="/schedule" className="text-sm font-medium text-navy-700 hover:text-navy-900">Open schedule</Link>}>
            <RouteMap bookings={data.upcoming} />
            {data.upcoming.length === 0 ? (
              <p className="text-sm text-slate-500 mt-4">No flights in the next 14 days.</p>
            ) : (
              <ul className="mt-4 divide-y divide-slate-100">
                {data.upcoming.slice(0, 5).map((b) => {
                  const done = b.checklist.filter((c) => c.done).length;
                  return (
                    <li key={b.id} className="flex items-center gap-4 py-3">
                      <div className="w-12 shrink-0 rounded-xl border border-slate-200 bg-white py-1 text-center">
                        <div className="text-[10px] font-medium uppercase text-gold-600">{format(parseISO(b.date), "MMM")}</div>
                        <div className="text-lg font-semibold text-navy-900 leading-tight">{format(parseISO(b.date), "d")}</div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-navy-900">
                          {getIATA(b.origin)} &rarr; {getIATA(b.destination)} <span className="font-normal text-slate-500">&middot; {b.departureTime} &middot; {b.clientName}</span>
                        </div>
                        <div className="text-xs text-slate-500 truncate">{b.aircraft} {b.tailNumber ? `(${b.tailNumber})` : ""} &middot; {b.operator}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="mb-1 h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${(done / b.checklist.length) * 100}%` }} />
                        </div>
                        <div className="text-xs font-medium text-emerald-700 tabular-nums">+{money(b.clientPrice - b.operatorPrice)}</div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
          <Panel title="Automated this month">
            <ul className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
              <AutoRow label="Quote emails parsed" count={data.counts.quote} mins={MINUTES.quote} />
              <AutoRow label="Inquiries qualified" count={data.counts.inquiry} mins={MINUTES.inquiry} />
              <AutoRow label="RFQs sent" count={data.counts.rfq} mins={MINUTES.rfq} />
              <AutoRow label="Proposals drafted" count={data.counts.proposal} mins={MINUTES.proposal} />
              <AutoRow label="Bookings tracked" count={data.counts.booking} mins={MINUTES.booking} />
            </ul>
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel
            title={
              <span className="flex items-center gap-2">
                Live flights <span className="h-2 w-2 rounded-full bg-sky-500 animate-pulse" />
              </span>
            }
            action={<Link href="/schedule" className="text-sm font-medium text-navy-700 hover:text-navy-900">Schedule</Link>}
          >
            <LiveFlights bookings={state.bookings} now={store.now} />
          </Panel>
          <Panel title="Hot leads" action={<Link href="/inquiries" className="text-sm font-medium text-navy-700 hover:text-navy-900">View all</Link>}>
            {data.hot.length === 0 ? (
              <p className="text-sm text-slate-500">No hot leads open.</p>
            ) : (
              <ul className="-mx-2 space-y-1">
                {data.hot.slice(0, 5).map((i) => (
                  <li key={i.id}>
                    <Link href={`/inquiries/${i.id}`} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-slate-50">
                      <Avatar name={i.clientName ?? "?"} />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-navy-900 truncate">{i.clientName}</div>
                        <div className="text-xs text-slate-500">
                          {i.origin && i.destination ? `${getIATA(i.origin)} to ${getIATA(i.destination)}` : "Route TBD"}
                          {i.date ? ` · ${format(parseISO(i.date), "MMM d")}` : ""}
                        </div>
                      </div>
                      <ScoreRing score={i.qualification.score} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>


          <Panel title="Live activity">
            <ul className="space-y-4">
              {state.activity.slice(0, 8).map((a) => (
                <ActivityRow key={a.id} a={a} />
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </>
  );
}

const ACTION_LABEL = { hot: "Send RFQ", rfq: "Open", proposal: "Build proposal", ops: "Review", leg: "View leg" } as const;
const STAGE_DOT = ["bg-slate-400", "bg-violet-500", "bg-navy-500", "bg-cyan-500", "bg-gold-500", "bg-emerald-500"];

function Kpi({ icon: Icon, label, value, sub, href, gold }: { icon: typeof Flame; label: string; value: string; sub: string; href?: string; gold?: boolean }) {
  const inner = (
    <div
      className={`h-full rounded-2xl border p-5 transition-all ${
        gold ? "border-gold-200 bg-gradient-to-br from-gold-50 to-white" : "border-slate-200/80 bg-white"
      } shadow-[0_1px_2px_rgba(14,31,58,0.04)] ${href ? "hover:shadow-md hover:border-slate-300" : ""}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-500">{label}</span>
        <span className={`flex h-9 w-9 items-center justify-center rounded-full ${gold ? "bg-gold-100 text-gold-700" : "bg-navy-50 text-navy-700"}`}>
          <Icon className="h-[18px] w-[18px]" />
        </span>
      </div>
      <div className={`mt-2 text-3xl font-semibold tracking-tight tabular-nums ${gold ? "text-gold-700" : "text-navy-900"}`}>{value}</div>
      <div className="mt-1 text-xs text-slate-500">{sub}</div>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

function Avatar({ name }: { name: string }) {
  const initials = name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
  return <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-navy-50 text-xs font-semibold text-navy-700">{initials}</span>;
}

export function ScoreRing({ score, size = 36 }: { score: number; size?: number }) {
  const r = size / 2 - 3;
  const c = 2 * Math.PI * r;
  const color = score >= 70 ? "#e11d48" : score >= 45 ? "#d97706" : "#0284c7";
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }} title={`Lead score ${score}`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#eef1f6" strokeWidth="3" fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth="3" fill="none" strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)} strokeLinecap="round" />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[11px] font-semibold text-navy-900 tabular-nums">{score}</span>
    </span>
  );
}

function RouteMap({ bookings }: { bookings: { id: string; origin: string; destination: string }[] }) {
  // Simple equirectangular projection over North America and the Caribbean
  const W = 800, H = 300;
  const proj = (lat: number, lon: number) => [((lon + 126) / 62) * W, ((50 - lat) / 32) * H] as const;
  const dots: { x: number; y: number }[] = [];
  for (let x = 12; x < W; x += 16) for (let y = 12; y < H; y += 16) dots.push({ x, y });
  const routes = bookings
    .map((b) => ({ b, o: getAirport(b.origin), d: getAirport(b.destination) }))
    .filter((r) => r.o && r.d);
  const airports = new Map<string, { x: number; y: number; code: string }>();
  for (const r of routes) {
    for (const a of [r.o!, r.d!]) {
      const [x, y] = proj(a.lat, a.lon);
      airports.set(a.icao, { x, y, code: a.iata });
    }
  }
  return (
    <div className="overflow-hidden rounded-xl border border-slate-100 bg-gradient-to-b from-navy-50/70 to-white">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-48 w-full sm:h-56" preserveAspectRatio="xMidYMid slice" aria-label="Route map of upcoming flights">
        {dots.map((d, i) => (
          <circle key={i} cx={d.x} cy={d.y} r="1.2" fill="#c7d3e6" />
        ))}
        {routes.map(({ b, o, d }) => {
          const [x1, y1] = proj(o!.lat, o!.lon);
          const [x2, y2] = proj(d!.lat, d!.lon);
          const mx = (x1 + x2) / 2, my = (y1 + y2) / 2 - Math.hypot(x2 - x1, y2 - y1) * 0.25;
          return <path key={b.id} d={`M${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`} stroke="#b88d38" strokeWidth="2" fill="none" strokeDasharray="5 5" />;
        })}
        {[...airports.values()].map((a) => (
          <g key={a.code}>
            <circle cx={a.x} cy={a.y} r="9" fill="#0e1f3a" opacity="0.08" />
            <circle cx={a.x} cy={a.y} r="4.5" fill="#0e1f3a" stroke="#fff" strokeWidth="2" />
            <text x={a.x + 9} y={a.y - 7} fontSize="13" fontWeight="600" fill="#0e1f3a">{a.code}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function AutoRow({ label, count, mins }: { label: string; count: number; mins: number }) {
  return (
    <li className="flex items-center justify-between gap-2">
      <span className="text-slate-600">{label}</span>
      <span className="tabular-nums font-medium text-navy-900">
        {count} <span className="font-normal text-slate-400">&times; {mins} min</span>
      </span>
    </li>
  );
}

function AttentionIcon({ kind }: { kind: "hot" | "rfq" | "proposal" | "ops" | "leg" }) {
  const map = {
    hot: { Icon: Flame, cls: "bg-rose-50 text-rose-600" },
    rfq: { Icon: Mail, cls: "bg-violet-50 text-violet-600" },
    proposal: { Icon: Sparkles, cls: "bg-navy-50 text-navy-700" },
    ops: { Icon: ClipboardCheck, cls: "bg-amber-50 text-amber-600" },
    leg: { Icon: Repeat, cls: "bg-gold-100 text-gold-700" },
  }[kind];
  return (
    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${map.cls}`}>
      <map.Icon className="h-[18px] w-[18px]" />
    </span>
  );
}

function ActivityRow({ a }: { a: ActivityItem }) {
  const Icon = a.kind === "booking" ? PlaneTakeoff : a.kind === "quote" ? Zap : a.kind === "ops" ? Clock : a.kind === "inquiry" ? Mail : Sparkles;
  const content = (
    <div className="flex gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0">
        <div className="text-sm text-slate-700 leading-snug">{a.text}</div>
        <div className="text-xs text-slate-400 mt-0.5">{formatDistanceToNow(parseISO(a.at), { addSuffix: true })}</div>
      </div>
    </div>
  );
  return <li>{a.href ? <Link href={a.href} className="block hover:opacity-80">{content}</Link> : content}</li>;
}
