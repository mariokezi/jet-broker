"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { DEMO_ANCHOR_COOKIE } from "@/lib/demo-clock";
import { checklistTemplate, createSeedState, inquiryTripId, newId, STATE_VERSION, type AppState } from "@/lib/demo-state";
import { matchOperators, simulateOperatorQuotes } from "@/lib/fleet";
import { getIATA } from "@/lib/airport-lookup";
import { simulatedInterest, simulatedReply, type EmptyLeg, type LegMessage, type LegStatus } from "@/lib/empty-legs";
import { normalizeTime } from "@/lib/time";
import { flightStatus } from "@/lib/tracking";
import { createSeatShare, zoneSold } from "@/lib/seats";
import { clientChannelId, simulatedClientReply, simulatedTeamReply, TEAMMATE, tripChannelId, type ChatMessage, type ChatVia } from "@/lib/messaging";
import { clientIdFor, type ClientProfile } from "@/lib/clients";
import type { AppAlert } from "@/lib/demo-seed-extra";
import {
  buildPortalQuote,
  operatorAccount,
  operatorByCompany,
  OPERATOR_ACCOUNTS,
  type AvailabilityBlock,
  type FleetAircraft,
  type RfqRequest,
} from "@/lib/network";
import type {
  ActivityItem,
  Booking,
  BrokerSettings,
  Inquiry,
  Proposal,
  QuoteDecision,
} from "@/lib/types";

const STORAGE_KEY = "jetbroker-state";

function setAnchorCookie(anchorMs: number) {
  document.cookie = `${DEMO_ANCHOR_COOKIE}=${anchorMs}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
}

function readAnchorCookie(): number | null {
  const m = document.cookie.match(new RegExp(`(?:^|; )${DEMO_ANCHOR_COOKIE}=(\\d+)`));
  return m ? Number(m[1]) : null;
}

/** The newest state any window has written, or null when storage is unavailable. */
function readStored(): AppState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AppState;
    return parsed.version === STATE_VERSION ? parsed : null;
  } catch {
    return null;
  }
}

function writeStored(state: AppState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // storage full or blocked: state still works for this window
  }
}

function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppState;
      // Demo data older than 5 days would show past trips; start fresh instead
      if (parsed.version === STATE_VERSION && Date.now() - parsed.anchorMs < 5 * 86_400_000) return parsed;
    }
  } catch {
    // storage unavailable or corrupt: fall through to a fresh seed
  }
  return createSeedState(Date.now());
}

interface StoreApi {
  state: AppState;
  now: number;
  addInquiry: (inq: Inquiry) => void;
  updateInquiry: (id: string, patch: Partial<Inquiry>) => void;
  mode: "demo" | "live";
  sendRfq: (inquiry: Inquiry) => number;
  setQuoteDecision: (quoteId: string, decision: QuoteDecision | null) => void;
  saveProposal: (proposal: Proposal) => void;
  createBooking: (booking: Booking, quoteId: string | null) => void;
  toggleChecklist: (bookingId: string, key: string) => void;
  updateSettings: (patch: Partial<BrokerSettings>) => void;
  log: (item: Omit<ActivityItem, "id" | "at">) => void;
  resetDemo: () => void;
  postLeg: (leg: EmptyLeg) => void;
  sendLegMessage: (legId: string, text: string) => void;
  claimLeg: (legId: string, claim: { inquiryId: string | null; clientName: string; clientPrice: number }) => void;
  setLegStatus: (legId: string, status: LegStatus) => void;
  sendMessage: (channelId: string, text: string, via?: ChatVia) => void;
  markRead: (channelId: string) => void;
  sellSeats: (legId: string, sale: { zoneId: string; seats: number; wholeZone: boolean; name: string; email: string | null; phone: string | null; source: "Broker" | "Online" }) => boolean;
  enableSeatShare: (legId: string) => void;
  toggleNotifyClient: (bookingId: string) => void;
  dismissAlert: (id: string) => void;
  saveClient: (profile: ClientProfile) => void;
  // Operator portal
  saveAircraft: (aircraft: FleetAircraft) => void;
  removeAircraft: (id: string) => void;
  addBlock: (block: AvailabilityBlock) => void;
  removeBlock: (id: string) => void;
  markRequestSeen: (requestId: string, operatorId: string) => void;
  submitPortalQuote: (requestId: string, operatorId: string, quote: { aircraftId: string; price: number; note: string | null }) => boolean;
  declineRequest: (requestId: string, operatorId: string, note: string | null) => void;
  postOperatorLeg: (operatorId: string, leg: EmptyLeg) => void;
  respondToClaim: (legId: string, accept: boolean) => void;
}

const StoreContext = createContext<StoreApi | null>(null);

export function StoreProvider({ children, mode }: { children: React.ReactNode; mode: "demo" | "live" }) {
  const router = useRouter();
  const [state, setState] = useState<AppState | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const stateRef = useRef<AppState | null>(null);

  const adopt = useCallback(
    (next: AppState) => {
      const anchorChanged = stateRef.current?.anchorMs !== next.anchorMs;
      stateRef.current = next;
      setState(next);
      if (anchorChanged && readAnchorCookie() !== next.anchorMs) {
        setAnchorCookie(next.anchorMs);
        router.refresh(); // server demo inbox must use the same anchor
      }
    },
    [router]
  );

  // Load once on the client
  useEffect(() => {
    const initial = loadState();
    writeStored(initial);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate from localStorage after mount
    adopt(initial);
  }, [adopt]);

  // Live sync: the broker workspace and operator portal can run in separate windows.
  // Every write goes to storage, and other windows adopt it the moment it lands.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      const latest = readStored();
      if (latest) adopt(latest);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [adopt]);

  // Read, change and write in one step against the newest stored state, so a change
  // made in another window a moment ago is never overwritten.
  const mutate = useCallback((fn: (s: AppState) => AppState) => {
    const base = readStored() ?? stateRef.current;
    if (!base) return;
    const next = fn(base);
    if (next === base) return;
    stateRef.current = next;
    setState(next);
    writeStored(next);
  }, []);

  // Clock tick drives streaming RFQ responses
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // When every RFQ response for an inquiry has arrived, advance it to Quoted
  useEffect(() => {
    if (!state) return;
    const readyIn = (s: AppState) =>
      s.inquiries.filter((inq) => {
        if (inq.status !== "Sourcing") return false;
        const tripId = inquiryTripId(inq);
        const quotes = tripId ? s.rfqQuotes[tripId] ?? [] : [];
        return quotes.length > 0 && quotes.every((q) => Date.parse(q.receivedAt) <= now);
      });
    if (readyIn(state).length === 0) return;
    mutate((s) => {
      const ready = readyIn(s);
      if (ready.length === 0) return s;
      return {
        ...s,
        inquiries: s.inquiries.map((i) => (ready.some((r) => r.id === i.id) ? { ...i, status: "Quoted" } : i)),
        activity: [
          ...ready.map((r) => {
            const tripId = inquiryTripId(r)!;
            const n = s.rfqQuotes[tripId]?.length ?? 0;
            return {
              id: newId("act"),
              at: new Date().toISOString(),
              kind: "quote" as const,
              text: `${n} operator quote${n === 1 ? "" : "s"} parsed and ranked for ${r.clientName ?? "client"} (${getIATA(r.origin!)} to ${getIATA(r.destination!)})`,
              href: `/trip/${tripId}`,
            };
          }),
          ...s.activity,
        ],
      };
    });
  }, [now, state, mutate]);

  // Demo network: the poster accepts a claim a few seconds after it is sent
  useEffect(() => {
    if (!state) return;
    const dueIn = (s: AppState) => s.emptyLegs.filter((l) => l.status === "Pending" && l.claim && Date.parse(l.claim.acceptAt) <= now);
    if (dueIn(state).length === 0) return;
    mutate((s) => {
      const accepted = dueIn(s);
      if (accepted.length === 0) return s;
      const at = new Date().toISOString();
      const alerts: AppAlert[] = [];
      const bookings: Booking[] = [];
      const messages: LegMessage[] = [];
      const activity: ActivityItem[] = [];
      const bookedInquiries = new Set<string>();
      for (const leg of accepted) {
        const claim = leg.claim!;
        const inq = claim.inquiryId ? s.inquiries.find((i) => i.id === claim.inquiryId) : undefined;
        if (inq) bookedInquiries.add(inq.id);
        const date = inq?.date && inq.date >= leg.earliest && inq.date <= leg.latest ? inq.date : leg.earliest;
        bookings.push({
          id: newId("BK"),
          tripId: (inq && inquiryTripId(inq)) || `EL-${leg.id}`,
          inquiryId: inq?.id ?? null,
          createdAt: at,
          clientName: claim.clientName,
          origin: leg.origin,
          destination: leg.destination,
          date,
          departureTime: normalizeTime(inq?.departureTime ?? null),
          pax: inq?.pax ?? null,
          operator: leg.postedBy.company,
          aircraft: leg.aircraft,
          tailNumber: leg.tailNumber,
          operatorPrice: leg.askingPrice,
          clientPrice: claim.clientPrice,
          checklist: checklistTemplate(),
        });
        messages.push({
          id: newId("LM"),
          legId: leg.id,
          at,
          fromMe: false,
          author: `${leg.postedBy.name}, ${leg.postedBy.company}`,
          text: `Confirmed, the leg is yours for ${claim.clientName}. Sending the trip sheet and agreement now.`,
        });
        activity.push({
          id: newId("act"),
          at,
          kind: "booking",
          text: `Empty leg ${getIATA(leg.origin)} to ${getIATA(leg.destination)} confirmed by ${leg.postedBy.company} for ${claim.clientName}. Margin $${(claim.clientPrice - leg.askingPrice).toLocaleString()}`,
          href: "/schedule",
        });
        if (leg.operatorId) {
          alerts.push({ id: newId("AL"), at, kind: "booking", text: `${leg.postedBy.company} confirmed your claim: ${getIATA(leg.origin)} to ${getIATA(leg.destination)} for ${claim.clientName}`, href: "/schedule", seen: false });
        }
      }
      return {
        ...s,
        emptyLegs: s.emptyLegs.map((l) => (accepted.some((a) => a.id === l.id) ? { ...l, status: "Claimed" } : l)),
        legMessages: [...s.legMessages, ...messages],
        bookings: [...bookings, ...s.bookings],
        inquiries: s.inquiries.map((i) => (bookedInquiries.has(i.id) ? { ...i, status: "Booked" } : i)),
        activity: [...activity, ...s.activity],
        alerts: [...alerts, ...s.alerts].slice(0, 60),
      };
    });
  }, [now, state, mutate]);

  // Flight tracking: departure and landing alerts, team channel updates, and client texts
  useEffect(() => {
    if (!state) return;
    const dueIn = (s: AppState) =>
      s.bookings.filter((b) => {
        const st = flightStatus(b, now);
        const t = b.tracking;
        return (st.phase === "Departed" && !t?.departedAt) || (st.phase === "Landed" && !t?.landedAt);
      });
    if (dueIn(state).length === 0) return;
    mutate((s) => {
      const due = dueIn(s);
      if (due.length === 0) return s;
      const at = new Date(now).toISOString();
      const alerts: AppAlert[] = [];
      const messages: ChatMessage[] = [];
      const activity: ActivityItem[] = [];
      const updated = new Map<string, Booking>();
      for (const b of due) {
        const st = flightStatus(b, now);
        const t = b.tracking ?? { departedAt: null, landedAt: null, notifyClient: false };
        const route = `${getIATA(b.origin)} to ${getIATA(b.destination)}`;
        const eta = new Date(st.arriveMs).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
        const clientCh = clientChannelId(clientIdFor(b.clientName));
        const next = { ...t };
        // Alert only for changes that just happened; older ones are recorded quietly
        const recent = (ms: number) => now - ms < 30 * 60_000;
        if (!t.departedAt && (st.phase === "Departed" || st.phase === "Landed")) {
          next.departedAt = new Date(st.departMs).toISOString();
          if (recent(st.departMs) && st.phase === "Departed") {
            alerts.push({ id: newId("AL"), at, kind: "departed", text: `Wheels up: ${b.clientName}, ${route} (${b.tailNumber ?? b.aircraft}). ETA ${eta}`, href: `/schedule?b=${b.id}`, seen: false });
            messages.push({ id: newId("M"), channelId: tripChannelId(b.id), at, author: "Flight tracker", role: "system", text: `Departed ${getIATA(b.origin)}. Estimated arrival ${getIATA(b.destination)} at ${eta}.`, via: "app" });
            activity.push({ id: newId("act"), at, kind: "ops", text: `${b.id} departed ${getIATA(b.origin)}, ETA ${eta}`, href: `/schedule?b=${b.id}` });
            if (t.notifyClient) messages.push({ id: newId("M"), channelId: clientCh, at, author: s.settings.brokerName, role: "me", text: `Wheels up from ${getIATA(b.origin)}! Estimated arrival in ${getIATA(b.destination)} at ${eta}. Enjoy the flight.`, via: "text" });
          }
        }
        if (!t.landedAt && st.phase === "Landed") {
          next.landedAt = new Date(st.arriveMs).toISOString();
          if (recent(st.arriveMs)) {
            alerts.push({ id: newId("AL"), at, kind: "landed", text: `Landed: ${b.clientName} is on the ground in ${getIATA(b.destination)}`, href: `/schedule?b=${b.id}`, seen: false });
            messages.push({ id: newId("M"), channelId: tripChannelId(b.id), at, author: "Flight tracker", role: "system", text: `Landed at ${getIATA(b.destination)}. Block time complete.`, via: "app" });
            activity.push({ id: newId("act"), at, kind: "ops", text: `${b.id} landed at ${getIATA(b.destination)}`, href: `/schedule?b=${b.id}` });
            if (t.notifyClient) {
              messages.push({ id: newId("M"), channelId: clientCh, at, author: s.settings.brokerName, role: "me", text: `Welcome to ${getIATA(b.destination)}! You're on the ground. Your car is waiting at the FBO.`, via: "text" });
              if (mode === "demo") messages.push({ id: newId("M"), channelId: clientCh, at: new Date(now + 6000).toISOString(), author: b.clientName, role: "client", text: "Smooth flight, thank you so much!", via: "text" });
            }
          }
        }
        updated.set(b.id, { ...b, tracking: next });
      }
      return {
        ...s,
        bookings: s.bookings.map((b) => updated.get(b.id) ?? b),
        alerts: [...alerts, ...s.alerts].slice(0, 60),
        messages: [...s.messages, ...messages],
        activity: [...activity, ...s.activity],
      };
    });
  }, [now, state, mode, mutate]);


  const log = useCallback(
    (item: Omit<ActivityItem, "id" | "at">) =>
      mutate((s) => ({ ...s, activity: [{ ...item, id: newId("act"), at: new Date().toISOString() }, ...s.activity].slice(0, 200) })),
    [mutate]
  );

  const api = useMemo<StoreApi | null>(() => {
    if (!state) return null;
    return {
      state,
      now,
      mode,
      log,
      addInquiry: (inq) => mutate((s) => ({ ...s, inquiries: [inq, ...s.inquiries] })),
      updateInquiry: (id, patch) =>
        mutate((s) => ({ ...s, inquiries: s.inquiries.map((i) => (i.id === id ? { ...i, ...patch } : i)) })),
      sendRfq: (inq) => {
        const inquiryId = inq.id;
        const simulate = mode === "demo";
        const tripId = inquiryTripId(inq);
        if (!tripId) return 0;
        const category = inq.category ?? inq.estimate.recommended;
        const portalCompanies = OPERATOR_ACCOUNTS.map((a) => a.company);
        const emailed = matchOperators(inq.origin!, category).filter((op) => !portalCompanies.includes(op.name)).length;
        const operators = emailed + OPERATOR_ACCOUNTS.length;
        const sentAt = Date.now();
        const sentIso = new Date(sentAt).toISOString();
        const simulated = simulate
          ? simulateOperatorQuotes({
              seed: `${inq.id}-${tripId}`,
              origin: inq.origin!,
              destination: inq.destination!,
              date: inq.date!,
              pax: inq.pax,
              category,
              exclude: portalCompanies,
            }).map(({ quote, delayMs }) => ({ ...quote, receivedAt: new Date(sentAt + delayMs).toISOString() }))
          : [];
        const route = `${getIATA(inq.origin!)} to ${getIATA(inq.destination!)}`;
        mutate((s) => {
          const request: RfqRequest = {
            id: newId("RQ"),
            tripId,
            inquiryId,
            origin: inq.origin!,
            destination: inq.destination!,
            date: inq.date!,
            departureTime: normalizeTime(inq.departureTime ?? null),
            pax: inq.pax,
            category,
            notes: inq.notes,
            sentAt: sentIso,
            broker: { name: s.settings.brokerName, company: s.settings.companyName },
            to: OPERATOR_ACCOUNTS.map((a) => a.id),
            responses: {},
            seenBy: {},
          };
          // Keep answers operators already sent through the portal for this trip
          const kept = (s.rfqQuotes[tripId] ?? []).filter((q) => q.quoteSource === "portal");
          return {
            ...s,
            inquiries: s.inquiries.map((i) =>
              i.id === inquiryId ? { ...i, status: "Sourcing", rfqSentAt: sentIso, operatorsContacted: operators } : i
            ),
            rfqQuotes: { ...s.rfqQuotes, [tripId]: [...kept, ...(simulate ? simulated : [])] },
            rfqRequests: [request, ...s.rfqRequests.filter((r) => r.tripId !== tripId || Object.keys(r.responses).length > 0)],
            alerts: [
              ...OPERATOR_ACCOUNTS.map((a) => ({
                id: newId("AL"),
                at: sentIso,
                kind: "request" as const,
                text: `New RFQ from ${s.settings.companyName}: ${route} on ${format(parseISO(inq.date!), "EEE, MMM d")}${inq.pax ? `, ${inq.pax} pax` : ""}`,
                href: `/operator/requests?r=${request.id}`,
                seen: false,
                audience: a.id,
              })),
              ...s.alerts,
            ].slice(0, 60),
            activity: [
              {
                id: newId("act"),
                at: sentIso,
                kind: "rfq",
                text: `RFQ sent to ${operators} operators for ${route}, ${OPERATOR_ACCOUNTS.length} of them live on JetBroker Network`,
                href: `/inquiries/${inq.id}`,
              },
              ...s.activity,
            ],
          };
        });
        return operators;
      },
      setQuoteDecision: (quoteId, decision) =>
        mutate((s) => {
          const next = { ...s.quoteDecisions };
          if (decision) next[quoteId] = decision;
          else delete next[quoteId];
          return { ...s, quoteDecisions: next };
        }),
      saveProposal: (proposal) =>
        mutate((s) => ({
          ...s,
          proposals: { ...s.proposals, [proposal.tripId]: proposal },
          inquiries: s.inquiries.map((i) =>
            inquiryTripId(i) === proposal.tripId && proposal.status === "Sent" && i.status !== "Booked"
              ? { ...i, status: "Proposal Sent" }
              : i
          ),
        })),
      createBooking: (bk, quoteId) =>
        mutate((s) => ({
          ...s,
          alerts: (() => {
            const account = operatorByCompany(bk.operator);
            if (!account) return s.alerts;
            const alert: AppAlert = {
              id: newId("AL"),
              at: new Date().toISOString(),
              kind: "booking",
              text: `Booked: ${bk.clientName}, ${getIATA(bk.origin)} to ${getIATA(bk.destination)} on ${format(parseISO(bk.date), "MMM d")}${bk.tailNumber ? ` (${bk.tailNumber})` : ""}. $${bk.operatorPrice.toLocaleString()} to you`,
              href: "/operator/calendar",
              seen: false,
              audience: account.id,
            };
            return [alert, ...s.alerts].slice(0, 60);
          })(),
          bookings: [bk, ...s.bookings.filter((b) => b.tripId !== bk.tripId)],
          quoteDecisions: quoteId ? { ...s.quoteDecisions, [quoteId]: "Accepted" } : s.quoteDecisions,
          proposals: s.proposals[bk.tripId]
            ? { ...s.proposals, [bk.tripId]: { ...s.proposals[bk.tripId], status: "Accepted", acceptedQuoteId: quoteId } }
            : s.proposals,
          inquiries: s.inquiries.map((i) => (inquiryTripId(i) === bk.tripId ? { ...i, status: "Booked" } : i)),
          activity: [
            {
              id: newId("act"),
              at: new Date().toISOString(),
              kind: "booking",
              text: `${bk.clientName} booked ${bk.aircraft}, ${getIATA(bk.origin)} to ${getIATA(bk.destination)}. Margin $${(bk.clientPrice - bk.operatorPrice).toLocaleString()}`,
              href: "/schedule",
            },
            ...s.activity,
          ],
        })),
      toggleChecklist: (bookingId, key) =>
        mutate((s) => ({
          ...s,
          bookings: s.bookings.map((b) =>
            b.id === bookingId ? { ...b, checklist: b.checklist.map((c) => (c.key === key ? { ...c, done: !c.done } : c)) } : b
          ),
        })),
      updateSettings: (patch) => mutate((s) => ({ ...s, settings: { ...s.settings, ...patch } })),
      postLeg: (leg) =>
        mutate((s) => {
          const interest = simulatedInterest(leg);
          const incoming: LegMessage[] =
            mode === "demo"
              ? [{ id: newId("LM"), legId: leg.id, at: new Date(Date.now() + 9000).toISOString(), fromMe: false, author: interest.author, text: interest.text }]
              : [];
          return {
            ...s,
            emptyLegs: [leg, ...s.emptyLegs],
            legMessages: [...s.legMessages, ...incoming],
            activity: [
              {
                id: newId("act"),
                at: new Date().toISOString(),
                kind: "ops",
                text: `Posted empty leg ${getIATA(leg.origin)} to ${getIATA(leg.destination)} (${leg.aircraft}) to the broker network`,
                href: `/empty-legs?leg=${leg.id}`,
              },
              ...s.activity,
            ],
          };
        }),
      sendLegMessage: (legId, text) =>
        mutate((s) => {
          const leg = s.emptyLegs.find((l) => l.id === legId);
          if (!leg) return s;
          const nowMs = Date.now();
          const mine: LegMessage = { id: newId("LM"), legId, at: new Date(nowMs).toISOString(), fromMe: true, author: s.settings.brokerName, text };
          const replies: LegMessage[] = [];
          if (mode === "demo") {
            if (!leg.isMine) {
              replies.push({ id: newId("LM"), legId, at: new Date(nowMs + 2500).toISOString(), fromMe: false, author: `${leg.postedBy.name}, ${leg.postedBy.company}`, text: simulatedReply(leg, text) });
            } else {
              const other = [...s.legMessages].reverse().find((m) => m.legId === legId && !m.fromMe);
              if (other) replies.push({ id: newId("LM"), legId, at: new Date(nowMs + 3000).toISOString(), fromMe: false, author: other.author, text: "Understood, thanks. I'll confirm with my client and come back to you shortly." });
            }
          }
          return { ...s, legMessages: [...s.legMessages, mine, ...replies] };
        }),
      claimLeg: (legId, claim) =>
        mutate((s) => {
          const nowMs = Date.now();
          return {
            ...s,
            emptyLegs: s.emptyLegs.map((l) =>
              l.id === legId
                ? {
                    ...l,
                    status: "Pending",
                    // Portal operators confirm by hand; other posters are simulated in demo mode
                    claim: { ...claim, requestedAt: new Date(nowMs).toISOString(), acceptAt: new Date(nowMs + (mode === "demo" && !l.operatorId ? 4500 : 365 * 86_400_000)).toISOString() },
                  }
                : l
            ),
            alerts: (() => {
              const leg = s.emptyLegs.find((l) => l.id === legId);
              if (!leg?.operatorId) return s.alerts;
              const alert: AppAlert = {
                id: newId("AL"),
                at: new Date(nowMs).toISOString(),
                kind: "claim",
                text: `${s.settings.companyName} wants your ${getIATA(leg.origin)} to ${getIATA(leg.destination)} empty leg for ${claim.clientName}`,
                href: `/operator/empty-legs?leg=${legId}`,
                seen: false,
                audience: leg.operatorId,
              };
              return [alert, ...s.alerts].slice(0, 60);
            })(),
            legMessages: [
              ...s.legMessages,
              { id: newId("LM"), legId, at: new Date(nowMs).toISOString(), fromMe: true, author: s.settings.brokerName, text: `Claim request: I'd like to book this leg for ${claim.clientName}.` },
            ],
          };
        }),
      setLegStatus: (legId, status) =>
        mutate((s) => ({ ...s, emptyLegs: s.emptyLegs.map((l) => (l.id === legId ? { ...l, status } : l)) })),
      sendMessage: (channelId, text, via = "app") =>
        mutate((s) => {
          const nowMs = Date.now();
          const mine: ChatMessage = { id: newId("M"), channelId, at: new Date(nowMs).toISOString(), author: s.settings.brokerName, role: "me", text, via };
          const replies: ChatMessage[] = [];
          if (mode === "demo") {
            if (channelId.startsWith("client-")) {
              const client = s.clients.find((c) => clientChannelId(c.id) === channelId);
              const name = client?.name ?? channelId.replace("client-", "").replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
              replies.push({ id: newId("M"), channelId, at: new Date(nowMs + 3500).toISOString(), author: name, role: "client", text: simulatedClientReply(name.split(" ")[0], text), via });
            } else {
              replies.push({ id: newId("M"), channelId, at: new Date(nowMs + 2500).toISOString(), author: TEAMMATE, role: "team", text: simulatedTeamReply(text), via: "app" });
            }
          }
          return { ...s, messages: [...s.messages, mine, ...replies], readAt: { ...s.readAt, [channelId]: new Date(nowMs).toISOString() } };
        }),
      markRead: (channelId) =>
        mutate((s) => (s.readAt[channelId] && s.readAt[channelId] >= new Date(Date.now() - 1000).toISOString() ? s : { ...s, readAt: { ...s.readAt, [channelId]: new Date().toISOString() } })),
      sellSeats: (legId, sale) => {
        const leg = state.emptyLegs.find((l) => l.id === legId);
        const zone = leg?.seatShare?.zones.find((z) => z.id === sale.zoneId);
        if (!leg?.seatShare || !zone) return false;
        const open = zone.seats - zoneSold(leg.seatShare, zone.id);
        const seats = sale.wholeZone ? zone.seats : sale.seats;
        if (seats < 1 || seats > open || (sale.wholeZone && open !== zone.seats)) return false;
        const amount = sale.wholeZone ? zone.zonePrice : zone.pricePerSeat * seats;
        const at = new Date().toISOString();
        const route = `${getIATA(leg.origin)} to ${getIATA(leg.destination)}`;
        mutate((s) => ({
          ...s,
          emptyLegs: s.emptyLegs.map((l) =>
            l.id === legId && l.seatShare
              ? { ...l, seatShare: { ...l.seatShare, sales: [...l.seatShare.sales, { ...sale, id: newId("SS"), seats, amount, at }] } }
              : l
          ),
          alerts:
            sale.source === "Online"
              ? [{ id: newId("AL"), at, kind: "seat" as const, text: `Seat sold online: ${sale.name} took ${seats} seat${seats === 1 ? "" : "s"} (${zone.name}) on ${route}`, href: `/empty-legs?leg=${legId}`, seen: false }, ...s.alerts]
              : s.alerts,
          activity: [
            { id: newId("act"), at, kind: "booking", text: `${sale.name} ${sale.wholeZone ? `bought the ${zone.name.toLowerCase()} zone` : `bought ${seats} seat${seats === 1 ? "" : "s"} in ${zone.name.toLowerCase()}`} on ${route}, $${amount.toLocaleString()}`, href: `/empty-legs?leg=${legId}` },
            ...s.activity,
          ],
        }));
        return true;
      },
      enableSeatShare: (legId) =>
        mutate((s) => ({
          ...s,
          emptyLegs: s.emptyLegs.map((l) => (l.id === legId && !l.seatShare ? { ...l, seatShare: createSeatShare(l.category, l.seats, l.askingPrice) } : l)),
        })),
      toggleNotifyClient: (bookingId) =>
        mutate((s) => ({
          ...s,
          bookings: s.bookings.map((b) =>
            b.id === bookingId ? { ...b, tracking: { departedAt: b.tracking?.departedAt ?? null, landedAt: b.tracking?.landedAt ?? null, notifyClient: !b.tracking?.notifyClient } } : b
          ),
        })),
      dismissAlert: (id) => mutate((s) => ({ ...s, alerts: s.alerts.map((a) => (a.id === id ? { ...a, seen: true } : a)) })),
      saveClient: (profile) =>
        mutate((s) => ({ ...s, clients: s.clients.some((c) => c.id === profile.id) ? s.clients.map((c) => (c.id === profile.id ? profile : c)) : [profile, ...s.clients] })),
      saveAircraft: (aircraft) =>
        mutate((s) => ({
          ...s,
          fleet: s.fleet.some((a) => a.id === aircraft.id) ? s.fleet.map((a) => (a.id === aircraft.id ? aircraft : a)) : [...s.fleet, aircraft],
        })),
      removeAircraft: (id) =>
        mutate((s) => ({ ...s, fleet: s.fleet.filter((a) => a.id !== id), blocks: s.blocks.filter((b) => b.aircraftId !== id) })),
      addBlock: (block) => mutate((s) => ({ ...s, blocks: [...s.blocks, block] })),
      removeBlock: (id) => mutate((s) => ({ ...s, blocks: s.blocks.filter((b) => b.id !== id) })),
      markRequestSeen: (requestId, operatorId) =>
        mutate((s) => {
          const r = s.rfqRequests.find((x) => x.id === requestId);
          if (!r || r.seenBy[operatorId]) return s;
          return { ...s, rfqRequests: s.rfqRequests.map((x) => (x.id === requestId ? { ...x, seenBy: { ...x.seenBy, [operatorId]: new Date().toISOString() } } : x)) };
        }),
      submitPortalQuote: (requestId, operatorId, input) => {
        let ok = false;
        mutate((s) => {
          const r = s.rfqRequests.find((x) => x.id === requestId);
          const account = operatorAccount(operatorId);
          const aircraft = s.fleet.find((a) => a.id === input.aircraftId && a.operatorId === operatorId);
          if (!r || !account || !aircraft || r.responses[operatorId] || !(input.price > 0)) return s;
          ok = true;
          const at = new Date().toISOString();
          const quote = buildPortalQuote({ request: r, account, aircraft, price: Math.round(input.price), note: input.note, at });
          const route = `${getIATA(r.origin)} to ${getIATA(r.destination)}`;
          const inq = r.inquiryId ? s.inquiries.find((i) => i.id === r.inquiryId) : undefined;
          return {
            ...s,
            rfqRequests: s.rfqRequests.map((x) =>
              x.id === requestId
                ? { ...x, responses: { ...x.responses, [operatorId]: { status: "Quoted" as const, at, quoteId: quote.emailId, aircraftId: aircraft.id, price: quote.price, note: input.note } } }
                : x
            ),
            rfqQuotes: { ...s.rfqQuotes, [r.tripId]: [...(s.rfqQuotes[r.tripId] ?? []).filter((q) => q.emailId !== quote.emailId), quote] },
            alerts: [
              {
                id: newId("AL"),
                at,
                kind: "quote" as const,
                text: `${account.company} just quoted ${quote.priceFormatted} live: ${aircraft.model} (${aircraft.tail}) for ${inq?.clientName ?? "your client"}, ${route}`,
                href: `/trip/${r.tripId}`,
                seen: false,
              },
              ...s.alerts,
            ].slice(0, 60),
            activity: [
              { id: newId("act"), at, kind: "quote", text: `${account.company} quoted ${quote.priceFormatted} through the operator portal for ${route} (${aircraft.model})`, href: `/trip/${r.tripId}` },
              ...s.activity,
            ],
          };
        });
        return ok;
      },
      declineRequest: (requestId, operatorId, note) =>
        mutate((s) => {
          const r = s.rfqRequests.find((x) => x.id === requestId);
          const account = operatorAccount(operatorId);
          if (!r || !account || r.responses[operatorId]) return s;
          const at = new Date().toISOString();
          return {
            ...s,
            rfqRequests: s.rfqRequests.map((x) =>
              x.id === requestId ? { ...x, responses: { ...x.responses, [operatorId]: { status: "Declined" as const, at, quoteId: null, aircraftId: null, price: null, note } } } : x
            ),
            activity: [
              { id: newId("act"), at, kind: "rfq", text: `${account.company} declined ${getIATA(r.origin)} to ${getIATA(r.destination)}${note ? `: ${note}` : ""}`, href: r.inquiryId ? `/inquiries/${r.inquiryId}` : undefined },
              ...s.activity,
            ],
          };
        }),
      postOperatorLeg: (operatorId, leg) =>
        mutate((s) => {
          const account = operatorAccount(operatorId);
          if (!account) return s;
          const posted: EmptyLeg = { ...leg, operatorId, isMine: false, postedBy: { name: account.contact, company: account.company, kind: "Operator" } };
          const route = `${getIATA(leg.origin)} to ${getIATA(leg.destination)}`;
          const at = new Date().toISOString();
          return {
            ...s,
            emptyLegs: [posted, ...s.emptyLegs],
            alerts: [
              { id: newId("AL"), at, kind: "leg" as const, text: `New empty leg from ${account.company}: ${route}, ${leg.aircraft}, $${leg.askingPrice.toLocaleString()}`, href: `/empty-legs?leg=${leg.id}`, seen: false },
              ...s.alerts,
            ].slice(0, 60),
            activity: [
              { id: newId("act"), at, kind: "ops", text: `${account.company} posted an empty leg ${route} (${leg.aircraft}) from the operator portal`, href: `/empty-legs?leg=${leg.id}` },
              ...s.activity,
            ],
          };
        }),
      respondToClaim: (legId, accept) =>
        mutate((s) => {
          const leg = s.emptyLegs.find((l) => l.id === legId);
          if (!leg || leg.status !== "Pending" || !leg.claim) return s;
          const at = new Date().toISOString();
          if (accept) {
            // The claim effect turns this into a booking on the next tick
            return { ...s, emptyLegs: s.emptyLegs.map((l) => (l.id === legId ? { ...l, claim: { ...l.claim!, acceptAt: at } } : l)) };
          }
          return {
            ...s,
            emptyLegs: s.emptyLegs.map((l) => (l.id === legId ? { ...l, status: "Open", claim: null } : l)),
            legMessages: [...s.legMessages, { id: newId("LM"), legId, at, fromMe: false, author: `${leg.postedBy.name}, ${leg.postedBy.company}`, text: "Sorry, we can't take this one after all. The leg is open again." }],
            alerts: [
              { id: newId("AL"), at, kind: "claim" as const, text: `${leg.postedBy.company} declined your claim on ${getIATA(leg.origin)} to ${getIATA(leg.destination)}`, href: `/empty-legs?leg=${legId}`, seen: false },
              ...s.alerts,
            ].slice(0, 60),
          };
        }),
      resetDemo: () => {
        const fresh = createSeedState(Date.now());
        writeStored(fresh);
        adopt(fresh);
      },
    };
  }, [state, now, mode, mutate, log, adopt]);

  return <StoreContext.Provider value={api}>{children}</StoreContext.Provider>;
}

/** Returns null until client state has loaded. */
export function useStore(): StoreApi | null {
  return useContext(StoreContext);
}
