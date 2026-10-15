"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Armchair, PlaneLanding, PlaneTakeoff, MessageSquare, X } from "lucide-react";
import { useStore } from "./store-provider";

const ICON = { departed: PlaneTakeoff, landed: PlaneLanding, seat: Armchair, message: MessageSquare } as const;
const TONE = {
  departed: "bg-sky-50 text-sky-600",
  landed: "bg-emerald-50 text-emerald-600",
  seat: "bg-gold-100 text-gold-700",
  message: "bg-navy-50 text-navy-700",
} as const;

/** Pop-up alerts for flight departures, landings and online seat sales. They clear after 10 seconds. */
export function AlertToaster() {
  const store = useStore();
  const router = useRouter();
  const unseen = store?.state.alerts.filter((a) => !a.seen).slice(0, 3) ?? [];
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
          <div key={a.id} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-lg shadow-navy-900/10">
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
              <div className="text-xs text-slate-500">Just now · tap to open</div>
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
