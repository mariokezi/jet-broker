"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { format, isToday, parseISO } from "date-fns";
import { ArrowLeft, Hash, Mail, MessageSquare, Plane, Radio, Send, Smartphone, Users } from "lucide-react";
import { useStore } from "./store-provider";
import { LoadingBlock, PageHeader, btnPrimary, inputCls } from "./ui-bits";
import { buildClients } from "@/lib/clients";
import { clientChannelId, TEAM_CHANNEL, TEAMMATE, tripChannel, unreadIn, type Channel, type ChatMessage, type ChatVia } from "@/lib/messaging";

export function MessagesHub() {
  const store = useStore();
  const router = useRouter();
  const params = useSearchParams();
  const selectedId = params.get("c");
  const [draft, setDraft] = useState("");
  const [via, setVia] = useState<ChatVia>("text");
  const bottom = useRef<HTMLDivElement>(null);

  const channels = useMemo(() => {
    if (!store) return { team: [] as Channel[], trips: [] as Channel[], clients: [] as Channel[] };
    const { state, now } = store;
    const today = new Date(now).toISOString().slice(0, 10);
    const yesterday = new Date(now - 86_400_000).toISOString().slice(0, 10);
    const team: Channel[] = [{ id: TEAM_CHANNEL, kind: "team", name: "Ops room", subtitle: `You and ${TEAMMATE}` }];
    const trips = state.bookings
      .filter((b) => b.date >= yesterday)
      .sort((a, b) => (a.date + a.departureTime).localeCompare(b.date + b.departureTime))
      .map(tripChannel);
    const clients = buildClients(state.clients, state.inquiries, state.bookings, state.emptyLegs, today)
      .map((c): Channel => ({ id: clientChannelId(c.profile.id), kind: "client", name: c.profile.name, subtitle: c.profile.company ?? c.profile.email ?? "Client", clientId: c.profile.id }))
      .sort((a, b) => lastAt(state.messages, b.id).localeCompare(lastAt(state.messages, a.id)));
    return { team, trips, clients };
  }, [store]);

  const all = [...channels.team, ...channels.trips, ...channels.clients];
  const active = all.find((c) => c.id === selectedId) ?? null;

  const activeUnread = store && active ? unreadIn(store.state.messages, store.state.readAt, store.now, active.id) : 0;
  useEffect(() => {
    if (active && activeUnread > 0) store?.markRead(active.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mark read only when the open thread has something new
  }, [active?.id, activeUnread]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [active?.id, store?.state.messages.length]);

  if (!store) return <LoadingBlock />;
  const { state, now } = store;
  const nowIso = new Date(now).toISOString();
  const thread = active ? state.messages.filter((m) => m.channelId === active.id && m.at <= nowIso).sort((a, b) => a.at.localeCompare(b.at)) : [];
  const typing = active ? state.messages.some((m) => m.channelId === active.id && m.at > nowIso) : false;
  const open = (id: string) => router.replace(`/messages?c=${id}`, { scroll: false });

  const send = () => {
    if (!active || !draft.trim()) return;
    store.sendMessage(active.id, draft.trim(), active.kind === "client" ? via : "app");
    setDraft("");
  };

  const client = active?.clientId ? state.clients.find((c) => c.id === active.clientId) : null;
  const booking = active?.bookingId ? state.bookings.find((b) => b.id === active.bookingId) : null;

  return (
    <>
      <PageHeader title="Messages" subtitle="Your team, every trip, and every client in one place. Email and text replies land here too." />
      <div className="grid overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm lg:grid-cols-[320px_1fr] lg:h-[calc(100vh-220px)] lg:min-h-[560px]">
        {/* Channel list */}
        <aside className={`${active ? "hidden lg:block" : "block"} border-r border-slate-100 overflow-y-auto`}>
          <Group title="Team" icon={Users} items={channels.team} activeId={active?.id} onOpen={open} state={state} now={now} />
          <Group title="Trips" icon={Plane} items={channels.trips} activeId={active?.id} onOpen={open} state={state} now={now} />
          <Group title="Clients" icon={MessageSquare} items={channels.clients} activeId={active?.id} onOpen={open} state={state} now={now} />
        </aside>

        {/* Thread */}
        <section className={`${active ? "flex" : "hidden lg:flex"} min-h-[480px] flex-col`}>
          {!active ? (
            <div className="m-auto max-w-xs p-8 text-center text-sm text-slate-500">
              <MessageSquare className="mx-auto mb-3 h-8 w-8 text-slate-300" />
              Pick a conversation. Trip channels get automatic updates when a flight departs and lands.
            </div>
          ) : (
            <>
              <header className="flex items-center gap-3 border-b border-slate-100 px-5 py-3.5">
                <button className="lg:hidden p-1 text-slate-500" onClick={() => router.replace("/messages")} aria-label="Back to conversations">
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <ChannelIcon ch={active} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-navy-900">{active.name}</div>
                  <div className="truncate text-xs text-slate-500">{active.subtitle}</div>
                </div>
                {client && <Link href={`/clients/${client.id}`} className="text-sm font-medium text-navy-700 hover:text-navy-900">Profile</Link>}
                {booking && <Link href={`/schedule?b=${booking.id}`} className="text-sm font-medium text-navy-700 hover:text-navy-900">Booking</Link>}
              </header>
              <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50/50 px-5 py-5">
                {thread.length === 0 && <p className="text-center text-sm text-slate-400">No messages yet. Say hello.</p>}
                {thread.map((m, i) => (
                  <Bubble key={m.id} m={m} showDay={i === 0 || thread[i - 1].at.slice(0, 10) !== m.at.slice(0, 10)} />
                ))}
                {typing && <div className="text-xs text-slate-400">typing…</div>}
                <div ref={bottom} />
              </div>
              <form
                className="border-t border-slate-100 p-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  send();
                }}
              >
                {active.kind === "client" && (
                  <div className="mb-2 flex gap-1 text-xs">
                    {(["text", "email"] as ChatVia[]).map((v) => (
                      <button
                        type="button"
                        key={v}
                        onClick={() => setVia(v)}
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-medium ${via === v ? "bg-navy-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                      >
                        {v === "text" ? <Smartphone className="h-3 w-3" /> : <Mail className="h-3 w-3" />} {v === "text" ? "Text" : "Email"}
                      </button>
                    ))}
                    <span className="ml-1 self-center text-slate-400">
                      {via === "text" ? client?.phone ?? "no phone on file" : client?.email ?? "no email on file"}
                    </span>
                  </div>
                )}
                <div className="flex gap-2">
                  <input id="message-draft" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={`Message ${active.kind === "client" ? active.name.split(" ")[0] : active.kind === "team" ? TEAMMATE.split(" ")[0] : "the trip team"}…`} className={inputCls} />
                  <button className={btnPrimary} disabled={!draft.trim()} aria-label="Send message">
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              </form>
            </>
          )}
        </section>
      </div>
    </>
  );
}

function lastAt(messages: ChatMessage[], channelId: string): string {
  let last = "";
  for (const m of messages) if (m.channelId === channelId && m.at > last) last = m.at;
  return last;
}

function Group({ title, icon: Icon, items, activeId, onOpen, state, now }: {
  title: string;
  icon: typeof Users;
  items: Channel[];
  activeId?: string;
  onOpen: (id: string) => void;
  state: NonNullable<ReturnType<typeof useStore>>["state"];
  now: number;
}) {
  const nowIso = new Date(now).toISOString();
  return (
    <div className="py-2">
      <div className="flex items-center gap-1.5 px-5 py-2 text-[11px] font-medium uppercase tracking-wider text-slate-400">
        <Icon className="h-3.5 w-3.5" /> {title}
      </div>
      {items.map((c) => {
        const last = [...state.messages].filter((m) => m.channelId === c.id && m.at <= nowIso).sort((a, b) => b.at.localeCompare(a.at))[0];
        const unread = unreadIn(state.messages, state.readAt, now, c.id);
        return (
          <button
            key={c.id}
            onClick={() => onOpen(c.id)}
            className={`flex w-full items-center gap-3 px-5 py-2.5 text-left transition-colors ${activeId === c.id ? "bg-navy-50" : "hover:bg-slate-50"}`}
          >
            <ChannelIcon ch={c} />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className={`truncate text-sm ${unread ? "font-semibold text-navy-900" : "font-medium text-slate-800"}`}>{c.name}</span>
                {last && <span className="shrink-0 text-[11px] text-slate-400">{isToday(parseISO(last.at)) ? format(parseISO(last.at), "h:mm a") : format(parseISO(last.at), "MMM d")}</span>}
              </div>
              <div className="flex items-center gap-2">
                <span className="truncate text-xs text-slate-500">{last ? `${last.role === "me" ? "You: " : ""}${last.text}` : c.subtitle}</span>
                {unread > 0 && <span className="ml-auto shrink-0 rounded-full bg-navy-900 px-1.5 text-[10px] font-semibold text-white">{unread}</span>}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function ChannelIcon({ ch }: { ch: Channel }) {
  if (ch.kind === "client") {
    const initials = ch.name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
    return <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold-100 text-xs font-semibold text-gold-700">{initials}</span>;
  }
  return (
    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${ch.kind === "team" ? "bg-navy-900 text-white" : "bg-navy-50 text-navy-700"}`}>
      {ch.kind === "team" ? <Hash className="h-4 w-4" /> : <Plane className="h-4 w-4" />}
    </span>
  );
}

function Bubble({ m, showDay }: { m: ChatMessage; showDay: boolean }) {
  const day = showDay && <div className="py-1 text-center text-[11px] font-medium uppercase tracking-wider text-slate-400">{isToday(parseISO(m.at)) ? "Today" : format(parseISO(m.at), "EEEE, MMM d")}</div>;
  if (m.role === "system")
    return (
      <>
        {day}
        <div className="flex items-center justify-center gap-2 text-xs text-sky-700">
          <Radio className="h-3.5 w-3.5" /> <span className="rounded-full bg-sky-50 px-3 py-1">{m.text}</span>
          <span className="text-slate-400">{format(parseISO(m.at), "h:mm a")}</span>
        </div>
      </>
    );
  const mine = m.role === "me";
  return (
    <>
      {day}
      <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
        <div className="max-w-[80%]">
          {!mine && <div className="mb-0.5 text-[11px] font-medium text-slate-500">{m.author}{m.role === "operator" ? " · Operator" : m.role === "team" ? " · Ops" : ""}</div>}
          <div className={`rounded-2xl px-3.5 py-2 text-sm ${mine ? "rounded-br-md bg-navy-900 text-white" : "rounded-bl-md border border-slate-200 bg-white text-slate-800"}`}>{m.text}</div>
          <div className={`mt-0.5 flex items-center gap-1 text-[10px] text-slate-400 ${mine ? "justify-end" : ""}`}>
            {m.via === "email" && <Mail className="h-3 w-3" />}
            {m.via === "text" && <Smartphone className="h-3 w-3" />}
            {format(parseISO(m.at), "h:mm a")}
          </div>
        </div>
      </div>
    </>
  );
}

export function useUnreadMessages(): number {
  const store = useStore();
  return store ? unreadIn(store.state.messages, store.state.readAt, store.now) : 0;
}

