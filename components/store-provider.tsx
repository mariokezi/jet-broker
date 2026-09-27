"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DEMO_ANCHOR_COOKIE } from "@/lib/demo-clock";
import { checklistTemplate, createSeedState, inquiryTripId, newId, STATE_VERSION, type AppState } from "@/lib/demo-state";
import { matchOperators, simulateOperatorQuotes } from "@/lib/fleet";
import { getIATA } from "@/lib/airport-lookup";
import { simulatedInterest, simulatedReply, type EmptyLeg, type LegMessage, type LegStatus } from "@/lib/empty-legs";
import { normalizeTime } from "@/lib/time";
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
}

const StoreContext = createContext<StoreApi | null>(null);

export function StoreProvider({ children, mode }: { children: React.ReactNode; mode: "demo" | "live" }) {
  const router = useRouter();
  const [state, setState] = useState<AppState | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const loaded = useRef(false);

  // Load once on the client
  useEffect(() => {
    const initial = loadState();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate from localStorage after mount
    setState(initial);
    loaded.current = true;
    if (readAnchorCookie() !== initial.anchorMs) {
      setAnchorCookie(initial.anchorMs);
      router.refresh(); // server demo inbox must use the same anchor
    }
  }, [router]);

  // Persist
  useEffect(() => {
    if (!state || !loaded.current) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // storage full or blocked: state still works for this session
    }
  }, [state]);

  // Clock tick drives streaming RFQ responses
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // When every RFQ response for an inquiry has arrived, advance it to Quoted
  useEffect(() => {
    if (!state) return;
    const ready = state.inquiries.filter((inq) => {
      if (inq.status !== "Sourcing") return false;
      const tripId = inquiryTripId(inq);
      const quotes = tripId ? state.rfqQuotes[tripId] ?? [] : [];
      return quotes.length > 0 && quotes.every((q) => Date.parse(q.receivedAt) <= now);
    });
    if (ready.length === 0) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- derived status transition on clock tick
    setState((s) =>
      s && {
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
              text: `${n} operator quotes parsed and ranked for ${r.clientName ?? "client"} (${getIATA(r.origin!)} to ${getIATA(r.destination!)})`,
              href: `/trip/${tripId}`,
            };
          }),
          ...s.activity,
        ],
      }
    );
  }, [now, state]);

  // Demo network: the poster accepts a claim a few seconds after it is sent
  useEffect(() => {
    if (!state) return;
    const accepted = state.emptyLegs.filter((l) => l.status === "Pending" && l.claim && Date.parse(l.claim.acceptAt) <= now);
    if (accepted.length === 0) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- simulated counterparty acceptance on clock tick
    setState((s) => {
      if (!s) return s;
      const at = new Date().toISOString();
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
      }
      return {
        ...s,
        emptyLegs: s.emptyLegs.map((l) => (accepted.some((a) => a.id === l.id) ? { ...l, status: "Claimed" } : l)),
        legMessages: [...s.legMessages, ...messages],
        bookings: [...bookings, ...s.bookings],
        inquiries: s.inquiries.map((i) => (bookedInquiries.has(i.id) ? { ...i, status: "Booked" } : i)),
        activity: [...activity, ...s.activity],
      };
    });
  }, [now, state]);

  const mutate = useCallback((fn: (s: AppState) => AppState) => {
    setState((s) => (s ? fn(s) : s));
  }, []);

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
        const operators = matchOperators(inq.origin!, inq.category ?? inq.estimate.recommended).length;
        const sentAt = Date.now();
        const simulated = simulate
          ? simulateOperatorQuotes({
              seed: `${inq.id}-${tripId}`,
              origin: inq.origin!,
              destination: inq.destination!,
              date: inq.date!,
              pax: inq.pax,
              category: inq.category ?? inq.estimate.recommended,
            }).map(({ quote, delayMs }) => ({ ...quote, receivedAt: new Date(sentAt + delayMs).toISOString() }))
          : [];
        mutate((s) => ({
          ...s,
          inquiries: s.inquiries.map((i) =>
            i.id === inquiryId ? { ...i, status: "Sourcing", rfqSentAt: new Date(sentAt).toISOString(), operatorsContacted: operators } : i
          ),
          rfqQuotes: simulate ? { ...s.rfqQuotes, [tripId]: simulated } : s.rfqQuotes,
          activity: [
            {
              id: newId("act"),
              at: new Date(sentAt).toISOString(),
              kind: "rfq",
              text: `RFQ sent to ${operators} matched operators for ${getIATA(inq.origin!)} to ${getIATA(inq.destination!)}`,
              href: `/inquiries/${inq.id}`,
            },
            ...s.activity,
          ],
        }));
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
                    claim: { ...claim, requestedAt: new Date(nowMs).toISOString(), acceptAt: new Date(nowMs + (mode === "demo" ? 4500 : 365 * 86_400_000)).toISOString() },
                  }
                : l
            ),
            legMessages: [
              ...s.legMessages,
              { id: newId("LM"), legId, at: new Date(nowMs).toISOString(), fromMe: true, author: s.settings.brokerName, text: `Claim request: I'd like to book this leg for ${claim.clientName}.` },
            ],
          };
        }),
      setLegStatus: (legId, status) =>
        mutate((s) => ({ ...s, emptyLegs: s.emptyLegs.map((l) => (l.id === legId ? { ...l, status } : l)) })),
      resetDemo: () => {
        const fresh = createSeedState(Date.now());
        setAnchorCookie(fresh.anchorMs);
        setState(fresh);
        router.refresh();
      },
    };
  }, [state, now, mode, mutate, log, router]);

  return <StoreContext.Provider value={api}>{children}</StoreContext.Provider>;
}

/** Returns null until client state has loaded. */
export function useStore(): StoreApi | null {
  return useContext(StoreContext);
}
