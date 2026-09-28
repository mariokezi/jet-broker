import type { InquiryStatus, LeadTier } from "@/lib/types";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
      <div>
        <h1 className="text-xl font-semibold text-white tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-white/40 mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  );
}

export function Panel({ title, action, children, className }: { title?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-white/[0.06] bg-white/[0.02] ${className ?? ""}`}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-2">
          {title && <h2 className="text-xs font-medium text-white/45 uppercase tracking-wider">{title}</h2>}
          {action}
        </div>
      )}
      <div className="px-4 pb-4 pt-1">{children}</div>
    </section>
  );
}

const TIER_STYLES: Record<LeadTier, string> = {
  Hot: "bg-rose-500/10 border-rose-500/25 text-rose-300",
  Warm: "bg-amber-500/10 border-amber-500/25 text-amber-300",
  Cold: "bg-sky-500/10 border-sky-500/25 text-sky-300",
};

export function TierBadge({ tier, score }: { tier: LeadTier; score?: number }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${TIER_STYLES[tier]}`}>
      <span aria-hidden>{tier === "Hot" ? "▲" : tier === "Warm" ? "◆" : "▼"}</span>
      {tier}
      {score !== undefined && <span className="opacity-70 tabular-nums">{score}</span>}
    </span>
  );
}

const STATUS_STYLES: Record<InquiryStatus, string> = {
  New: "bg-white/5 border-white/15 text-white/70",
  Qualified: "bg-violet-500/10 border-violet-500/25 text-violet-300",
  Sourcing: "bg-blue-500/10 border-blue-500/25 text-blue-300",
  Quoted: "bg-cyan-500/10 border-cyan-500/25 text-cyan-300",
  "Proposal Sent": "bg-indigo-500/10 border-indigo-500/25 text-indigo-300",
  Booked: "bg-emerald-500/10 border-emerald-500/25 text-emerald-300",
  Lost: "bg-white/[0.03] border-white/10 text-white/35",
};

export function InquiryStatusBadge({ status }: { status: InquiryStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${STATUS_STYLES[status]}`}>
      {status === "Sourcing" && <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />}
      {status}
    </span>
  );
}

export function LoadingBlock({ label = "Loading" }: { label?: string }) {
  return (
    <div className="space-y-3 animate-pulse" aria-label={label}>
      <div className="h-24 rounded-xl bg-white/[0.03]" />
      <div className="h-48 rounded-xl bg-white/[0.03]" />
    </div>
  );
}

export const btnPrimary =
  "inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-40 disabled:hover:bg-blue-600 transition-colors";
export const btnSecondary =
  "inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-white/75 hover:bg-white/10 hover:text-white disabled:opacity-40 transition-colors";
export const btnGhost =
  "inline-flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-white/50 hover:text-white hover:bg-white/5 transition-colors";
export const inputCls =
  "w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-white/25 outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/15 transition-all";
