"use client";

import Link from "next/link";
import { useMemo } from "react";
import { format, formatDistanceToNow, parseISO } from "date-fns";
import { AlertTriangle, ArrowRight, Clock, Flame, Mail, PlaneTakeoff, Sparkles, Zap } from "lucide-react";
import { useStore } from "./store-provider";
import { useMergedTrips } from "./use-trips";
import { LoadingBlock, Panel, TierBadge } from "./ui-bits";
import { getIATA } from "@/lib/airport-lookup";
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
    const attention: { key: string; icon: "hot" | "rfq" | "proposal" | "ops"; text: string; sub: string; href: string }[] = [];
    for (const i of open) {
      const tripId = inquiryTripId(i);
      if ((i.status === "Qualified" || i.status === "New") && i.qualification.tier !== "Cold" && tripId) {
        attention.push({ key: i.id, icon: i.qualification.tier === "Hot" ? "hot" : "rfq", text: `Send RFQ for ${i.clientName ?? "lead"}`, sub: `${getIATA(i.origin!)} to ${getIATA(i.destination!)} · score ${i.qualification.score}`, href: `/inquiries/${i.id}` });
      } else if (i.status === "Quoted" && tripId && !state.proposals[tripId]) {
        const n = merged.find((t) => t.tripId === tripId)?.quotes.length ?? 0;
        attention.push({ key: i.id, icon: "proposal", text: `Send proposal to ${i.clientName ?? "client"}`, sub: `${n} quotes ranked · ${getIATA(i.origin!)} to ${getIATA(i.destination!)}`, href: `/trip/${tripId}` });
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
  const maxFunnel = Math.max(1, ...data.funnel.map((f) => f.count));

  return (
    <>
      <div className="flex items-end justify-between gap-4 flex-wrap mb-6">
        <div>
          <h1 className="text-xl font-semibold text-white tracking-tight">
            {greeting}, {state.settings.brokerName.split(" ")[0]}
          </h1>
          <p className="text-sm text-white/40 mt-1">
            {format(new Date(), "EEEE, MMMM d")} &middot; {data.attention.length} item{data.attention.length === 1 ? "" : "s"} need you. Everything else is running.
          </p>
        </div>
        {mode === "demo" && (
          <span className="rounded-full border border-amber-500/20 bg-amber-500/[0.06] px-3 py-1 text-[11px] text-amber-300/90">Demo data</span>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 mb-6">
        <Tile label="Open inquiries" value={String(data.open.length)} sub={`${data.hot.length} hot`} href="/inquiries" />
        <Tile label="Quotes parsed (24h)" value={String(data.quotes24h)} sub={`${data.allQuotes.length} on the board`} href="/quotes" />
        <Tile label="Pipeline value" value={moneyK(data.pipeline)} sub="est. retail, open leads" />
        <Tile label="Upcoming flights" value={String(data.upcoming.length)} sub="next 14 days" href="/schedule" />
        <Tile label="Booked margin (30d)" value={moneyK(data.margin)} sub={`on ${moneyK(data.revenue)} revenue`} />
        <Tile label="Hours saved (30d)" value={`${Math.round(data.minutes / 60)}h`} sub={`~${Math.round(data.minutes / 60 / 4.3)}h per week`} accent />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6 min-w-0">
          <Panel title="Needs your attention" action={<Link href="/inquiries" className="text-xs text-blue-300 hover:text-blue-200">All inquiries</Link>}>
            {data.attention.length === 0 ? (
              <p className="text-sm text-white/35 py-4 text-center">Inbox zero. Nothing needs you right now.</p>
            ) : (
              <ul className="divide-y divide-white/[0.04]">
                {data.attention.slice(0, 7).map((a) => (
                  <li key={a.key}>
                    <Link href={a.href} className="flex items-center gap-3 py-2.5 group">
                      <AttentionIcon kind={a.icon} />
                      <div className="min-w-0">
                        <div className="text-sm text-white/85 group-hover:text-white">{a.text}</div>
                        <div className="text-xs text-white/35 truncate">{a.sub}</div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-white/15 group-hover:text-white/50 ml-auto shrink-0" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <div className="grid gap-6 md:grid-cols-2">
            <Panel title="Pipeline">
              <div className="space-y-2" role="list">
                {data.funnel.map((f) => (
                  <div key={f.status} role="listitem" className="grid grid-cols-[96px_1fr_24px] items-center gap-2" title={`${f.status}: ${f.count}`}>
                    <span className="text-xs text-white/50">{f.status}</span>
                    <div className="h-4 rounded bg-white/[0.03] overflow-hidden">
                      <div className="h-full rounded bg-blue-500/70" style={{ width: `${(f.count / maxFunnel) * 100}%`, minWidth: f.count ? 4 : 0 }} />
                    </div>
                    <span className="text-xs text-white/70 tabular-nums text-right">{f.count}</span>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel title="Automated this month">
              <ul className="space-y-1.5 text-xs">
                <AutoRow label="Operator quote emails parsed" count={data.counts.quote} mins={MINUTES.quote} />
                <AutoRow label="Inquiries qualified and priced" count={data.counts.inquiry} mins={MINUTES.inquiry} />
                <AutoRow label="RFQs routed to operators" count={data.counts.rfq} mins={MINUTES.rfq} />
                <AutoRow label="Proposals drafted" count={data.counts.proposal} mins={MINUTES.proposal} />
                <AutoRow label="Bookings with ops checklist" count={data.counts.booking} mins={MINUTES.booking} />
              </ul>
              <div className="mt-3 pt-3 border-t border-white/5 flex justify-between text-sm">
                <span className="text-white/50">Manual work replaced</span>
                <span className="font-semibold text-emerald-300 tabular-nums">{Math.round(data.minutes / 60)} hours</span>
              </div>
            </Panel>
          </div>

          <Panel title="Upcoming flights" action={<Link href="/schedule" className="text-xs text-blue-300 hover:text-blue-200">Schedule</Link>}>
            {data.upcoming.length === 0 ? (
              <p className="text-sm text-white/35">No flights in the next 14 days.</p>
            ) : (
              <ul className="divide-y divide-white/[0.04]">
                {data.upcoming.slice(0, 5).map((b) => {
                  const done = b.checklist.filter((c) => c.done).length;
                  return (
                    <li key={b.id} className="flex items-center gap-4 py-2.5">
                      <div className="w-14 text-center shrink-0">
                        <div className="text-[10px] uppercase text-white/35">{format(parseISO(b.date), "EEE")}</div>
                        <div className="text-lg font-semibold text-white leading-tight">{format(parseISO(b.date), "d")}</div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm text-white/85">
                          {getIATA(b.origin)} &rarr; {getIATA(b.destination)} <span className="text-white/35">&middot; {b.departureTime}</span>
                        </div>
                        <div className="text-xs text-white/35 truncate">{b.clientName} &middot; {b.aircraft} ({b.tailNumber}) &middot; {b.operator}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xs tabular-nums text-white/60">{done}/{b.checklist.length} ops</div>
                        <div className="text-[11px] text-emerald-300/80 tabular-nums">+{money(b.clientPrice - b.operatorPrice)}</div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Hot leads">
            {data.hot.length === 0 ? (
              <p className="text-sm text-white/35">No hot leads open.</p>
            ) : (
              <ul className="space-y-2">
                {data.hot.slice(0, 5).map((i) => (
                  <li key={i.id}>
                    <Link href={`/inquiries/${i.id}`} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 -mx-2 hover:bg-white/[0.03]">
                      <div className="min-w-0">
                        <div className="text-sm text-white/85 truncate">{i.clientName}</div>
                        <div className="text-[11px] text-white/35">
                          {i.origin && i.destination ? `${getIATA(i.origin)} → ${getIATA(i.destination)}` : "Route TBD"}
                          {i.date ? ` · ${format(parseISO(i.date), "MMM d")}` : ""}
                        </div>
                      </div>
                      <TierBadge tier={i.qualification.tier} score={i.qualification.score} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Live activity">
            <ul className="space-y-3">
              {state.activity.slice(0, 10).map((a) => (
                <ActivityRow key={a.id} a={a} />
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </>
  );
}

function Tile({ label, value, sub, href, accent }: { label: string; value: string; sub: string; href?: string; accent?: boolean }) {
  const inner = (
    <div className={`h-full rounded-xl border p-4 transition-colors ${accent ? "border-emerald-500/20 bg-emerald-500/[0.05]" : "border-white/[0.06] bg-white/[0.02]"} ${href ? "hover:bg-white/[0.04]" : ""}`}>
      <div className="text-[11px] text-white/40">{label}</div>
      <div className={`text-2xl font-semibold tracking-tight mt-1 tabular-nums ${accent ? "text-emerald-300" : "text-white"}`}>{value}</div>
      <div className="text-[11px] text-white/35 mt-0.5">{sub}</div>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

function AutoRow({ label, count, mins }: { label: string; count: number; mins: number }) {
  return (
    <li className="flex items-center justify-between gap-2">
      <span className="text-white/55">{label}</span>
      <span className="tabular-nums text-white/80">
        {count} <span className="text-white/25">&times; {mins}m</span>
      </span>
    </li>
  );
}

function AttentionIcon({ kind }: { kind: "hot" | "rfq" | "proposal" | "ops" }) {
  const map = {
    hot: { Icon: Flame, cls: "bg-rose-500/10 text-rose-300 border-rose-500/20" },
    rfq: { Icon: Mail, cls: "bg-violet-500/10 text-violet-300 border-violet-500/20" },
    proposal: { Icon: Sparkles, cls: "bg-cyan-500/10 text-cyan-300 border-cyan-500/20" },
    ops: { Icon: AlertTriangle, cls: "bg-amber-500/10 text-amber-300 border-amber-500/20" },
  }[kind];
  return (
    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${map.cls}`}>
      <map.Icon className="h-4 w-4" />
    </span>
  );
}

function ActivityRow({ a }: { a: ActivityItem }) {
  const Icon = a.kind === "booking" ? PlaneTakeoff : a.kind === "quote" ? Zap : a.kind === "ops" ? Clock : a.kind === "inquiry" ? Mail : Sparkles;
  const content = (
    <div className="flex gap-2.5">
      <Icon className="h-3.5 w-3.5 text-white/30 mt-0.5 shrink-0" />
      <div className="min-w-0">
        <div className="text-xs text-white/70 leading-snug">{a.text}</div>
        <div className="text-[10px] text-white/30 mt-0.5">{formatDistanceToNow(parseISO(a.at), { addSuffix: true })}</div>
      </div>
    </div>
  );
  return <li>{a.href ? <Link href={a.href} className="block hover:opacity-80">{content}</Link> : content}</li>;
}
