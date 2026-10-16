"use client";

import Link from "next/link";
import { format, parseISO, formatDistanceToNow } from "date-fns";
import { ArrowRight, Inbox, Send, Trophy, Wallet, Plane, CheckCircle2, Lock } from "lucide-react";
import { useStore } from "../store-provider";
import { useOperator } from "./operator-shell";
import { requestState } from "./operator-requests";
import { AircraftArt } from "../brand";
import { Panel, LoadingBlock } from "../ui-bits";
import { getIATA } from "@/lib/airport-lookup";
import { money } from "@/lib/money";
import { aircraftConflict } from "@/lib/network";

export function OperatorDashboard() {
  const store = useStore();
  const account = useOperator();
  if (!store) return <LoadingBlock />;
  const { state, now } = store;
  const today = new Date(now).toISOString().slice(0, 10);
  const hour = new Date(now).getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const fleet = state.fleet.filter((a) => a.operatorId === account.id);
  const requests = state.rfqRequests
    .filter((r) => r.to.includes(account.id))
    .map((r) => ({ r, s: requestState(r, account.id, today, state.bookings.some((b) => b.tripId === r.tripId && b.operator === account.company)) }));
  const open = requests.filter((x) => x.s === "Open").sort((a, b) => b.r.sentAt.localeCompare(a.r.sentAt));
  const quoted = requests.filter((x) => x.s === "Quoted" || x.s === "Won");
  const won = requests.filter((x) => x.s === "Won");
  const bookings = state.bookings.filter((b) => b.operator === account.company);
  const upcoming = bookings.filter((b) => b.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  const revenue = upcoming.reduce((s, b) => s + b.operatorPrice, 0);

  const kpis = [
    { label: "Open requests", value: String(open.length), sub: open.length ? "Waiting for your quote" : "All caught up", icon: Inbox, tone: "bg-gold-400 text-navy-950", href: "/operator/requests" },
    { label: "Quotes sent", value: String(quoted.length), sub: "Through the network", icon: Send, tone: "bg-navy-50 text-navy-700", href: "/operator/requests" },
    { label: "Win rate", value: quoted.length ? `${Math.round((won.length / quoted.length) * 100)}%` : "None yet", sub: `${won.length} won`, icon: Trophy, tone: "bg-emerald-50 text-emerald-700", href: "/operator/requests" },
    { label: "Booked revenue", value: money(revenue), sub: `${upcoming.length} upcoming trip${upcoming.length === 1 ? "" : "s"}`, icon: Wallet, tone: "bg-navy-900 text-gold-300", href: "/operator/calendar" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-navy-900">{greeting}, {account.contact.split(" ")[0]}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {open.length > 0 ? `${open.length} broker request${open.length === 1 ? " needs" : "s need"} a quote.` : "No requests waiting."} {fleet.length} aircraft on the network.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => (
          <Link key={k.label} href={k.href} className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(14,31,58,0.04),0_8px_24px_-12px_rgba(14,31,58,0.08)] hover:border-slate-300 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">{k.label}</span>
              <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${k.tone}`}><k.icon className="h-4 w-4" /></span>
            </div>
            <div className="mt-3 text-2xl font-semibold tabular-nums text-navy-900">{k.value}</div>
            <div className="text-xs text-slate-500">{k.sub}</div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Panel title="Requests waiting for you" action={<Link href="/operator/requests" className="text-xs font-medium text-navy-700 hover:underline">All requests</Link>}>
          {open.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">You&apos;re all caught up. New requests pop up here the second a broker sends one.</p>
          ) : (
            <ul className="space-y-2">
              {open.slice(0, 5).map(({ r }) => (
                <li key={r.id}>
                  <Link href={`/operator/requests?r=${r.id}`} className={`flex items-center gap-4 rounded-xl border p-3.5 transition-colors ${r.seenBy[account.id] ? "border-slate-200 hover:border-navy-300" : "border-gold-300 bg-gold-50/60 hover:border-gold-400"}`}>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-sm font-semibold text-navy-900">
                        {getIATA(r.origin)} <ArrowRight className="h-3.5 w-3.5 text-slate-400" /> {getIATA(r.destination)}
                        {!r.seenBy[account.id] && <span className="rounded-full bg-gold-400 px-1.5 py-0.5 text-[10px] font-semibold text-navy-950">NEW</span>}
                      </div>
                      <div className="text-xs text-slate-500">
                        {format(parseISO(r.date), "EEE, MMM d")} · {r.pax ?? "?"} pax · {r.broker.company} · {formatDistanceToNow(parseISO(r.sentAt), { addSuffix: true })}
                      </div>
                    </div>
                    <span className="rounded-lg bg-navy-900 px-3 py-1.5 text-xs font-semibold text-white">Quote now</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Fleet today">
          <ul className="space-y-2">
            {fleet.map((ac) => {
              const conflict = aircraftConflict(ac, today, state.blocks, state.bookings);
              return (
                <li key={ac.id} className="flex items-center gap-3">
                  <AircraftArt category={ac.category} label={false} className="h-11 w-16 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-sm font-semibold text-navy-900">{ac.tail}</div>
                    <div className="text-[11px] text-slate-500">{ac.model} · {getIATA(ac.base)}</div>
                  </div>
                  {conflict ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500"><Lock className="h-3 w-3" /> {conflict}</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700"><CheckCircle2 className="h-3 w-3" /> Available</span>
                  )}
                </li>
              );
            })}
          </ul>
        </Panel>
      </div>

      <Panel title="Next trips" action={<Link href="/operator/calendar" className="text-xs font-medium text-navy-700 hover:underline">Open calendar</Link>}>
        {upcoming.length === 0 ? (
          <p className="text-sm text-slate-500">No trips booked yet.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {upcoming.slice(0, 6).map((b) => (
              <Link key={b.id} href="/operator/calendar" className="rounded-xl border border-slate-200 p-4 hover:border-navy-300 transition-colors">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>{format(parseISO(b.date), "EEE, MMM d")} · {b.departureTime}</span>
                  <span className="font-mono">{b.tailNumber}</span>
                </div>
                <div className="mt-1.5 flex items-center gap-2 text-lg font-semibold text-navy-900">
                  {getIATA(b.origin)} <Plane className="h-4 w-4 text-gold-500" /> {getIATA(b.destination)}
                </div>
                <div className="mt-1 flex items-center justify-between text-xs">
                  <span className="text-slate-500">{b.aircraft} · {b.pax ?? "?"} pax</span>
                  <span className="font-semibold tabular-nums text-navy-900">{money(b.operatorPrice)}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
