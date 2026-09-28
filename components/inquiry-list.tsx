"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatDistanceToNow, format, parseISO } from "date-fns";
import { Plus, ExternalLink } from "lucide-react";
import { useStore } from "./store-provider";
import { InquiryStatusBadge, LoadingBlock, PageHeader, TierBadge, btnPrimary, btnSecondary } from "./ui-bits";
import { getIATA } from "@/lib/airport-lookup";
import { moneyK } from "@/lib/money";
import type { Inquiry, InquiryStatus } from "@/lib/types";

type Tab = "action" | "active" | "all" | "closed";

const TABS: { key: Tab; label: string; match: (s: InquiryStatus) => boolean }[] = [
  { key: "action", label: "Needs action", match: (s) => s === "New" || s === "Qualified" },
  { key: "active", label: "In progress", match: (s) => s === "Sourcing" || s === "Quoted" || s === "Proposal Sent" },
  { key: "closed", label: "Booked / Lost", match: (s) => s === "Booked" || s === "Lost" },
  { key: "all", label: "All", match: () => true },
];

export function InquiryList() {
  const store = useStore();
  const [tab, setTab] = useState<Tab>("all");

  const sorted = useMemo(() => {
    if (!store) return [];
    return [...store.state.inquiries].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [store]);

  if (!store) return <LoadingBlock />;

  const active = TABS.find((t) => t.key === tab)!;
  const rows = sorted.filter((i) => active.match(i.status));

  return (
    <>
      <PageHeader
        title="Inquiries"
        subtitle="Every request from email, web form, and phone, scored and priced automatically."
        actions={
          <>
            <Link href="/request" target="_blank" className={btnSecondary}>
              <ExternalLink className="h-3.5 w-3.5" /> Client request form
            </Link>
            <Link href="/inquiries/new" className={btnPrimary}>
              <Plus className="h-4 w-4" /> New Inquiry
            </Link>
          </>
        }
      />

      <div className="flex items-center gap-1 rounded-lg border border-white/8 bg-white/[0.02] p-0.5 w-fit mb-4">
        {TABS.map((t) => {
          const count = sorted.filter((i) => t.match(i.status)).length;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                tab === t.key ? "bg-blue-600/20 text-blue-300 border border-blue-500/20" : "text-white/40 hover:text-white/60 border border-transparent"
              }`}
            >
              {t.label} <span className="opacity-60 tabular-nums">{count}</span>
            </button>
          );
        })}
      </div>

      <div className="rounded-xl border border-white/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 bg-white/[0.02] text-left text-[11px] uppercase tracking-wider text-white/35">
                <th className="px-4 py-3 font-medium">Client</th>
                <th className="px-4 py-3 font-medium">Trip</th>
                <th className="px-4 py-3 font-medium">Lead</th>
                <th className="px-4 py-3 font-medium">Estimate</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Received</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((inq) => (
                <Row key={inq.id} inq={inq} />
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-white/30">Nothing here right now.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function Row({ inq }: { inq: Inquiry }) {
  const rec = inq.estimate.options.find((o) => o.category === (inq.category ?? inq.estimate.recommended));
  const legs = inq.returnDate ? 2 : 1;
  return (
    <tr className="border-b border-white/[0.03] hover:bg-white/[0.03] transition-colors">
      <td className="px-4 py-3">
        <Link href={`/inquiries/${inq.id}`} className="block">
          <div className="font-medium text-white">{inq.clientName ?? "Unknown client"}</div>
          <div className="text-xs text-white/35">{inq.company ?? inq.clientEmail ?? inq.source}</div>
        </Link>
      </td>
      <td className="px-4 py-3">
        <Link href={`/inquiries/${inq.id}`} className="block">
          <div className="text-white/80">
            {inq.origin && inq.destination ? `${getIATA(inq.origin)} → ${getIATA(inq.destination)}` : <span className="text-white/30">Route unknown</span>}
            {inq.returnDate && <span className="ml-1.5 text-[10px] text-white/35">RT</span>}
          </div>
          <div className="text-xs text-white/35">
            {inq.date ? format(parseISO(inq.date), "EEE, MMM d") : "No date"}
            {inq.pax ? ` · ${inq.pax} pax` : ""}
          </div>
        </Link>
      </td>
      <td className="px-4 py-3"><TierBadge tier={inq.qualification.tier} score={inq.qualification.score} /></td>
      <td className="px-4 py-3 text-white/60 tabular-nums text-xs">
        {rec ? `${moneyK(rec.low * legs)} to ${moneyK(rec.high * legs)}` : "—"}
        {rec && <div className="text-[10px] text-white/30">{rec.category}</div>}
      </td>
      <td className="px-4 py-3"><InquiryStatusBadge status={inq.status} /></td>
      <td className="px-4 py-3 text-xs text-white/40 whitespace-nowrap">
        {formatDistanceToNow(parseISO(inq.createdAt), { addSuffix: true })}
        <div className="text-[10px] text-white/25">{inq.source}</div>
      </td>
    </tr>
  );
}
