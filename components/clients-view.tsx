"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { ArrowLeft, Armchair, Crown, Mail, MapPin, MessageSquare, Phone, Plane, Search, Building2 } from "lucide-react";
import { useStore } from "./store-provider";
import { InquiryStatusBadge, LoadingBlock, PageHeader, Panel, btnPrimary, btnSecondary, inputCls } from "./ui-bits";
import { FlightStatusPill } from "./flight-tracker";
import { buildClients, type ClientProfile, type ClientSummary } from "@/lib/clients";
import { clientChannelId } from "@/lib/messaging";
import { getAirportCity, getIATA } from "@/lib/airport-lookup";
import { money, moneyK } from "@/lib/money";

function useClients(): ClientSummary[] | null {
  const store = useStore();
  return useMemo(() => {
    if (!store) return null;
    const { state, now } = store;
    return buildClients(state.clients, state.inquiries, state.bookings, state.emptyLegs, new Date(now).toISOString().slice(0, 10));
  }, [store]);
}

const TIER_STYLE: Record<ClientProfile["tier"], string> = {
  VIP: "bg-gold-100 text-gold-700 border-gold-200",
  Regular: "bg-navy-50 text-navy-700 border-navy-100",
  New: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

function TierPill({ tier }: { tier: ClientProfile["tier"] }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${TIER_STYLE[tier]}`}>
      {tier === "VIP" && <Crown className="h-3 w-3" />} {tier}
    </span>
  );
}

function Initials({ name, size = "h-10 w-10 text-sm" }: { name: string; size?: string }) {
  const initials = name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
  return <span className={`flex shrink-0 items-center justify-center rounded-full bg-navy-900 font-semibold text-white ${size}`}>{initials}</span>;
}

export function ClientList() {
  const clients = useClients();
  const [q, setQ] = useState("");
  if (!clients) return <LoadingBlock />;
  const rows = clients.filter((c) => `${c.profile.name} ${c.profile.company ?? ""} ${c.profile.email ?? ""}`.toLowerCase().includes(q.toLowerCase()));
  const vip = clients.filter((c) => c.profile.tier === "VIP").length;
  const spend = clients.reduce((s, c) => s + c.spend, 0);

  return (
    <>
      <PageHeader
        title="Clients"
        subtitle={`${clients.length} clients · ${vip} VIP · ${moneyK(spend)} lifetime spend`}
        actions={
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input id="client-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search clients" className={`${inputCls.replace("w-full", "w-64")} pl-9`} />
          </div>
        }
      />
      <div className="overflow-x-auto rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wider text-slate-400">
              <th className="px-5 py-3 font-medium">Client</th>
              <th className="px-3 py-3 font-medium">Tier</th>
              <th className="px-3 py-3 font-medium">Home base</th>
              <th className="px-3 py-3 font-medium text-right">Flights</th>
              <th className="px-3 py-3 font-medium text-right">Lifetime spend</th>
              <th className="px-5 py-3 font-medium">Next flight</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((c) => (
              <tr key={c.profile.id} className="hover:bg-slate-50">
                <td className="px-5 py-3">
                  <Link href={`/clients/${c.profile.id}`} className="flex items-center gap-3">
                    <Initials name={c.profile.name} size="h-9 w-9 text-xs" />
                    <span className="min-w-0">
                      <span className="block font-medium text-navy-900">{c.profile.name}</span>
                      <span className="block truncate text-xs text-slate-500">{c.profile.company ?? c.profile.email ?? "No company on file"}</span>
                    </span>
                  </Link>
                </td>
                <td className="px-3 py-3"><TierPill tier={c.profile.tier} /></td>
                <td className="px-3 py-3 text-slate-600">{c.profile.homeAirport ? `${getIATA(c.profile.homeAirport)} · ${getAirportCity(c.profile.homeAirport)}` : "—"}</td>
                <td className="px-3 py-3 text-right tabular-nums text-slate-700">{c.flights}</td>
                <td className="px-3 py-3 text-right font-medium tabular-nums text-navy-900">{c.spend ? money(c.spend) : "—"}</td>
                <td className="px-5 py-3 text-slate-600">
                  {c.nextFlight ? `${format(parseISO(c.nextFlight.date), "MMM d")} · ${getIATA(c.nextFlight.origin)} to ${getIATA(c.nextFlight.destination)}` : c.inquiries.some((i) => !["Booked", "Lost"].includes(i.status)) ? "Inquiry open" : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function ClientProfileView({ id }: { id: string }) {
  const store = useStore();
  const clients = useClients();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<{ notes: string; prefs: string }>({ notes: "", prefs: "" });
  if (!store || !clients) return <LoadingBlock />;
  const c = clients.find((x) => x.profile.id === id);
  if (!c) {
    return (
      <div className="py-20 text-center">
        <p className="text-slate-500">Client not found.</p>
        <Link href="/clients" className="mt-2 inline-block text-sm font-medium text-navy-700">Back to clients</Link>
      </div>
    );
  }
  const { profile: p } = c;
  const { now } = store;
  const nowIso = new Date(now).toISOString();
  const thread = store.state.messages.filter((m) => m.channelId === clientChannelId(p.id) && m.at <= nowIso).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 4);
  const avg = c.bookings.length ? c.spend / c.flights : 0;

  const save = () => {
    store.saveClient({ ...p, notes: draft.notes.trim() || null, preferences: draft.prefs.split("\n").map((x) => x.trim()).filter(Boolean) });
    setEditing(false);
  };

  return (
    <>
      <Link href="/clients" className="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-navy-900">
        <ArrowLeft className="h-4 w-4" /> All clients
      </Link>
      <div className="mb-8 flex flex-wrap items-center gap-5">
        <Initials name={p.name} size="h-16 w-16 text-xl" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-semibold tracking-tight text-navy-900">{p.name}</h1>
            <TierPill tier={p.tier} />
          </div>
          <div className="mt-1.5 flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-500">
            {p.company && <span className="inline-flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" />{p.company}</span>}
            {p.email && <span className="inline-flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" />{p.email}</span>}
            {p.phone && <span className="inline-flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />{p.phone}</span>}
            {p.homeAirport && <span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{getIATA(p.homeAirport)} · {getAirportCity(p.homeAirport)}</span>}
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/messages?c=${clientChannelId(p.id)}`} className={btnSecondary}><MessageSquare className="h-4 w-4" /> Message</Link>
          <Link href="/inquiries/new" className={btnPrimary}><Plane className="h-4 w-4" /> New trip</Link>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Lifetime spend" value={c.spend ? money(c.spend) : "$0"} />
        <Stat label="Flights" value={String(c.flights)} />
        <Stat label="Average trip" value={avg ? moneyK(avg) : "—"} />
        <Stat label="Client since" value={format(parseISO(p.since), "MMM yyyy")} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-6">
          <Panel title="Trips">
            {c.bookings.length === 0 && c.seatTrips.length === 0 ? (
              <p className="text-sm text-slate-500">No flights yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {[...c.bookings].reverse().map((b) => (
                  <li key={b.id}>
                    <Link href={`/schedule?b=${b.id}`} className="-mx-2 flex items-center gap-4 rounded-xl px-2 py-3 hover:bg-slate-50">
                      <div className="w-12 shrink-0 rounded-xl border border-slate-200 bg-white py-1 text-center">
                        <div className="text-[10px] font-medium uppercase text-gold-600">{format(parseISO(b.date), "MMM")}</div>
                        <div className="text-lg font-semibold leading-tight text-navy-900">{format(parseISO(b.date), "d")}</div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-navy-900">{getIATA(b.origin)} to {getIATA(b.destination)} <span className="font-normal text-slate-500">· {b.departureTime}</span></div>
                        <div className="truncate text-xs text-slate-500">{b.aircraft} · {b.operator}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium tabular-nums text-navy-900">{money(b.clientPrice)}</div>
                        <FlightStatusPill booking={b} now={now} />
                      </div>
                    </Link>
                  </li>
                ))}
                {c.seatTrips.map((t, i) => (
                  <li key={`seat-${i}`}>
                    <Link href={`/empty-legs?leg=${t.leg.id}`} className="-mx-2 flex items-center gap-4 rounded-xl px-2 py-3 hover:bg-slate-50">
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gold-100 text-gold-700"><Armchair className="h-5 w-5" /></span>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-navy-900">{getIATA(t.leg.origin)} to {getIATA(t.leg.destination)} <span className="font-normal text-slate-500">· shared flight</span></div>
                        <div className="truncate text-xs text-slate-500">{t.seats} seat{t.seats === 1 ? "" : "s"} in {t.zone.toLowerCase()} · {t.leg.aircraft}</div>
                      </div>
                      <div className="text-sm font-medium tabular-nums text-navy-900">{money(t.amount)}</div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Inquiries">
            {c.inquiries.length === 0 ? (
              <p className="text-sm text-slate-500">No inquiries on file.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {c.inquiries.map((i) => (
                  <li key={i.id}>
                    <Link href={`/inquiries/${i.id}`} className="-mx-2 flex items-center justify-between gap-3 rounded-xl px-2 py-3 hover:bg-slate-50">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-navy-900">{i.origin && i.destination ? `${getIATA(i.origin)} to ${getIATA(i.destination)}` : "Route to be confirmed"}</div>
                        <div className="text-xs text-slate-500">{i.date ? format(parseISO(i.date), "EEE, MMM d") : "No date"} · {i.pax ?? "?"} pax · {i.source}</div>
                      </div>
                      <InquiryStatusBadge status={i.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel
            title="Preferences and notes"
            action={
              editing ? (
                <button onClick={save} className="text-sm font-medium text-navy-700 hover:text-navy-900">Save</button>
              ) : (
                <button onClick={() => { setDraft({ notes: p.notes ?? "", prefs: p.preferences.join("\n") }); setEditing(true); }} className="text-sm font-medium text-navy-700 hover:text-navy-900">Edit</button>
              )
            }
          >
            {editing ? (
              <div className="space-y-3">
                <label className="block text-xs text-slate-500" htmlFor="prefs">Preferences, one per line</label>
                <textarea id="prefs" rows={4} value={draft.prefs} onChange={(e) => setDraft({ ...draft, prefs: e.target.value })} className={inputCls} />
                <label className="block text-xs text-slate-500" htmlFor="notes">Notes</label>
                <textarea id="notes" rows={3} value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} className={inputCls} />
              </div>
            ) : (
              <>
                <div className="flex flex-wrap gap-1.5">
                  {p.preferences.length === 0 && <span className="text-sm text-slate-500">No preferences yet.</span>}
                  {p.preferences.map((x) => (
                    <span key={x} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700">{x}</span>
                  ))}
                </div>
                {p.notes && <p className="mt-3 text-sm text-slate-600">{p.notes}</p>}
              </>
            )}
          </Panel>

          <Panel title="Recent messages" action={<Link href={`/messages?c=${clientChannelId(p.id)}`} className="text-sm font-medium text-navy-700 hover:text-navy-900">Open</Link>}>
            {thread.length === 0 ? (
              <p className="text-sm text-slate-500">No messages yet.</p>
            ) : (
              <ul className="space-y-3">
                {thread.map((m) => (
                  <li key={m.id} className="text-sm">
                    <div className="text-xs text-slate-400">{m.role === "me" ? "You" : m.author} · {m.via === "text" ? "Text" : m.via === "email" ? "Email" : "App"} · {format(parseISO(m.at), "MMM d, h:mm a")}</div>
                    <div className="text-slate-700">{m.text}</div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Value">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-slate-500">Margin earned</dt><dd className="font-medium tabular-nums text-emerald-700">{money(c.margin)}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Last flight</dt><dd className="text-navy-900">{c.lastFlight ? format(parseISO(c.lastFlight.date), "MMM d, yyyy") : "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Next flight</dt><dd className="text-navy-900">{c.nextFlight ? format(parseISO(c.nextFlight.date), "MMM d, yyyy") : "—"}</dd></div>
            </dl>
          </Panel>
        </div>
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold tracking-tight tabular-nums text-navy-900">{value}</div>
    </div>
  );
}
