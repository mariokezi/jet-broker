"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Armchair, PlaneLanding, PlaneTakeoff, MessageSquare, X, Zap, Inbox, Repeat, Handshake, CalendarCheck } from "lucide-react";
import { useStore } from "./store-provider";

const ICON = {
  departed: PlaneTakeoff,
  landed: PlaneLanding,
  seat: Armchair,
  message: MessageSquare,
  quote: Zap,
  request: Inbox,
  leg: Repeat,
  claim: Handshake,
  booking: CalendarCheck,
} as const;
const TONE = {
  departed: "bg-sky-50 text-sky-600",
  landed: "bg-emerald-50 text-emerald-600",
  seat: "bg-gold-100 text-gold-700",
  message: "bg-navy-50 text-navy-700",
  quote: "bg-gold-400 text-navy-950",
  request: "bg-gold-400 text-navy-950",
  leg: "bg-gold-100 text-gold-700",
  claim: "bg-gold-400 text-navy-950",
  booking: "bg-emerald-500 text-white",
} as const;
// Events that came across the network from the other side get a gold "live" frame
const LIVE = new Set(["quote", "request", "claim", "booking", "leg"]);

/**
 * Pop-up alerts: flight departures and landings, seat sales, and live network events
 * (operator quotes, RFQs, claims, bookings). They clear after 10 seconds.
 * `audience` picks whose alerts show: the broker (default) or one operator account.
 */
export function AlertToaster({ audience }: { audience?: string }) {
  const store = useStore();
  const router = useRouter();
  const unseen =
    store?.state.alerts
      .filter((a) => !a.seen && (audience ? a.audience === audience : !a.audience || a.audience === "broker"))
      .slice(0, 3) ?? [];
  const key = unseen.map((a) => a.id).join(",");

  useEffect(() => {
    if (!store || !key) return;
    const ids = key.split(",");
    const t = setTimeout(() => ids.forEach((id) => store.dismissAlert(id)), 10_000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- restart the timer only when the visible alerts change
  }, [key]);

  if (!store || unseen.length === 0) return null;
  return (
    <div className="fixed bottom-4 right-4 z-50 flex w-[min(380px,calc(100vw-32px))] flex-col gap-2" role="status" aria-live="polite">
      {unseen.map((a) => {
        const Icon = ICON[a.kind];
        return (
          <div
            key={a.id}
            data-alert-kind={a.kind}
            className={`flex items-start gap-3 rounded-2xl border bg-white p-3.5 shadow-lg animate-in fade-in slide-in-from-bottom-3 duration-500 ${
              LIVE.has(a.kind) ? "border-gold-300 shadow-gold-500/20 ring-4 ring-gold-100" : "border-slate-200 shadow-navy-900/10"
            }`}
          >
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${TONE[a.kind]}`}>
              <Icon className="h-[18px] w-[18px]" />
            </span>
            <button
              className="min-w-0 flex-1 text-left"
              onClick={() => {
                store.dismissAlert(a.id);
                router.push(a.href);
              }}
            >
              <div className="text-sm font-medium text-navy-900">{a.text}</div>
              <div className="text-xs text-slate-500">
                {LIVE.has(a.kind) && <span className="mr-1 inline-flex items-center gap-1 font-medium text-gold-700"><span className="h-1.5 w-1.5 rounded-full bg-gold-500 animate-pulse" />Live ·</span>}
                Just now · tap to open
              </div>
            </button>
            <button onClick={() => store.dismissAlert(a.id)} aria-label="Dismiss" className="p-1 text-slate-400 hover:text-slate-700">
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
