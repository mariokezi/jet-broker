import type { InquiryStatus, LeadTier } from "@/lib/types";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-4 flex-wrap mb-8">
      <div>
        <h1 className="text-2xl font-semibold text-navy-900 tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  );
}

export function Panel({ title, action, children, className }: { title?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(14,31,58,0.04),0_8px_24px_-12px_rgba(14,31,58,0.08)] ${className ?? ""}`}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-3">
          {title && <h2 className="text-[15px] font-semibold text-navy-900 tracking-tight">{title}</h2>}
          {action}
        </div>
      )}
      <div className="px-5 pb-5 pt-1">{children}</div>
    </section>
  );
}

const TIER_STYLES: Record<LeadTier, string> = {
  Hot: "bg-rose-50 border-rose-200 text-rose-700",
  Warm: "bg-amber-50 border-amber-200 text-amber-700",
  Cold: "bg-sky-50 border-sky-200 text-sky-700",
};

export function TierBadge({ tier, score }: { tier: LeadTier; score?: number }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${TIER_STYLES[tier]}`}>
      <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${tier === "Hot" ? "bg-rose-500" : tier === "Warm" ? "bg-amber-500" : "bg-sky-500"}`} />
      {tier}
      {score !== undefined && <span className="opacity-70 tabular-nums">{score}</span>}
    </span>
  );
}

const STATUS_STYLES: Record<InquiryStatus, string> = {
  New: "bg-slate-50 border-slate-300 text-slate-700",
  Qualified: "bg-violet-50 border-violet-200 text-violet-700",
  Sourcing: "bg-navy-50 border-navy-200 text-navy-700",
  Quoted: "bg-cyan-50 border-cyan-200 text-cyan-700",
  "Proposal Sent": "bg-indigo-50 border-indigo-200 text-indigo-700",
  Booked: "bg-emerald-50 border-emerald-200 text-emerald-700",
  Lost: "bg-white border-slate-200 text-slate-500",
};

export function InquiryStatusBadge({ status }: { status: InquiryStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${STATUS_STYLES[status]}`}>
      {status === "Sourcing" && <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-navy-900 animate-pulse" />}
      {status}
    </span>
  );
}

export function LoadingBlock({ label = "Loading" }: { label?: string }) {
  return (
    <div className="space-y-3 animate-pulse" aria-label={label}>
      <div className="h-24 rounded-2xl bg-slate-100" />
      <div className="h-48 rounded-2xl bg-slate-100" />
    </div>
  );
}

export const btnPrimary =
  "inline-flex items-center justify-center gap-1.5 rounded-xl bg-navy-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-navy-800 disabled:opacity-40 disabled:hover:bg-navy-900 transition-colors";
export const btnSecondary =
  "inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-navy-900 shadow-sm hover:bg-slate-50 hover:border-slate-300 disabled:opacity-40 transition-colors";
export const btnGhost =
  "inline-flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:text-navy-900 hover:bg-slate-100 transition-colors";
export const inputCls =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-navy-900 placeholder-slate-400 shadow-sm outline-none focus:border-navy-400 focus:ring-4 focus:ring-navy-100 transition-all";
