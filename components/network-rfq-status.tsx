"use client";

import { Eye, Zap, CircleSlash, Radio } from "lucide-react";
import { useStore } from "./store-provider";
import { money } from "@/lib/money";
import { operatorAccount } from "@/lib/network";

/** Where each operator on the network stands on this trip's RFQ: notified, viewing, quoted or declined. */
export function NetworkRfqStatus({ tripId }: { tripId: string }) {
  const store = useStore();
  const request = store?.state.rfqRequests.find((r) => r.tripId === tripId);
  if (!request) return null;

  return (
    <div className="rounded-xl border border-gold-200 bg-gold-50/60 px-4 py-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-gold-700">
          <Radio className="h-3.5 w-3.5" /> JetBroker Network
        </span>
        {request.to.map((id) => {
          const account = operatorAccount(id);
          if (!account) return null;
          const resp = request.responses[id];
          const seen = request.seenBy[id];
          const [cls, icon, text] =
            resp?.status === "Quoted"
              ? ["border-gold-300 bg-white text-navy-900", <Zap key="i" className="h-3 w-3 text-gold-600" />, `quoted ${money(resp.price)}`]
              : resp?.status === "Declined"
                ? ["border-slate-200 bg-white text-slate-500", <CircleSlash key="i" className="h-3 w-3" />, "declined"]
                : seen
                  ? ["border-navy-200 bg-white text-navy-700", <Eye key="i" className="h-3 w-3 animate-pulse" />, "is looking at it"]
                  : ["border-slate-200 bg-white text-slate-500", <span key="i" className="h-1.5 w-1.5 rounded-full bg-slate-400" />, "notified"];
          return (
            <span key={id} data-network-operator={id} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${cls}`}>
              {icon}
              <span className="font-medium">{account.company}</span> {text}
            </span>
          );
        })}
      </div>
    </div>
  );
}
