"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useState } from "react";
import { LayoutDashboard, Inbox, Plane, CalendarDays, Repeat, LogOut, Menu, X, ShieldCheck } from "lucide-react";
import { LogoMark } from "../brand";
import { AlertToaster } from "../alert-toaster";
import { useStore } from "../store-provider";
import { operatorAccount, type OperatorAccount } from "@/lib/network";

const OperatorContext = createContext<OperatorAccount | null>(null);

/** The signed in operator account. Only valid inside the operator portal. */
export function useOperator(): OperatorAccount {
  const account = useContext(OperatorContext);
  if (!account) throw new Error("useOperator must be used inside the operator portal");
  return account;
}

const NAV = [
  { href: "/operator", label: "Overview", icon: LayoutDashboard },
  { href: "/operator/requests", label: "Requests", icon: Inbox },
  { href: "/operator/fleet", label: "Fleet", icon: Plane },
  { href: "/operator/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/operator/empty-legs", label: "Empty Legs", icon: Repeat },
];

export function OperatorShell({ operatorId, children }: { operatorId: string | null; children: React.ReactNode }) {
  const pathname = usePathname();
  const store = useStore();
  const [open, setOpen] = useState(false);
  const account = operatorAccount(operatorId);

  if (pathname.startsWith("/operator/login")) return <>{children}</>;
  if (!account) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas p-6 text-center">
        <div>
          <p className="text-sm text-slate-600">This operator account is not on the network.</p>
          <a href="/api/operator/logout" className="mt-3 inline-block text-sm font-medium text-navy-900 underline">Sign in again</a>
        </div>
      </div>
    );
  }

  const openRequests = store
    ? store.state.rfqRequests.filter((r) => r.to.includes(account.id) && !r.responses[account.id] && r.date >= new Date(store.now).toISOString().slice(0, 10)).length
    : 0;
  const pendingClaims = store ? store.state.emptyLegs.filter((l) => l.operatorId === account.id && l.status === "Pending").length : 0;
  const isActive = (href: string) => (href === "/operator" ? pathname === "/operator" : pathname.startsWith(href));
  const badge = (href: string) => {
    const n = href === "/operator/requests" ? openRequests : href === "/operator/empty-legs" ? pendingClaims : 0;
    return n > 0 ? <span className="ml-auto rounded-full bg-gold-400 px-2 py-0.5 text-[11px] font-semibold text-navy-950 tabular-nums">{n}</span> : null;
  };
  const initials = account.contact.split(" ").map((p) => p[0]).join("").slice(0, 2);

  const links = (onClick?: () => void) =>
    NAV.map(({ href, label, icon: Icon }) => (
      <Link
        key={href}
        href={href}
        onClick={onClick}
        className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
          isActive(href) ? "bg-white/10 text-white ring-1 ring-white/10" : "text-navy-200 hover:bg-white/5 hover:text-white"
        }`}
      >
        <Icon className={`h-[18px] w-[18px] ${isActive(href) ? "text-gold-300" : "text-navy-300 group-hover:text-white"}`} />
        {label}
        {badge(href)}
      </Link>
    ));

  return (
    <OperatorContext.Provider value={account}>
      <div className="min-h-screen bg-canvas lg:pl-64">
        <aside className="hidden lg:flex fixed inset-y-0 left-0 w-64 flex-col bg-navy-950 px-4 py-5 text-white">
          <Link href="/operator" className="flex items-center gap-3 px-2 mb-7">
            <LogoMark className="h-9 w-9 rounded-[10px] ring-1 ring-white/20" />
            <div className="leading-tight">
              <div className="text-[15px] font-semibold tracking-tight">JetBroker Network</div>
              <div className="text-[11px] text-gold-300">Operator portal</div>
            </div>
          </Link>
          <div className="mb-6 rounded-xl bg-white/5 p-3 ring-1 ring-white/10">
            <div className="text-sm font-semibold">{account.company}</div>
            <div className="mt-1 flex items-center gap-1.5 text-[11px] text-navy-200">
              <ShieldCheck className="h-3.5 w-3.5 text-gold-300" /> ARGUS {account.argusRating} · Verified operator
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-[11px] text-emerald-300">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              Live on the network
            </div>
          </div>
          <nav className="space-y-1">{links()}</nav>
          <div className="mt-auto flex items-center gap-3 rounded-xl px-2 py-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gold-400 text-xs font-semibold text-navy-950">{initials}</span>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-sm font-medium">{account.contact}</span>
              <span className="block truncate text-[11px] text-navy-300">{account.email}</span>
            </span>
            <a href="/api/operator/logout" title="Sign out" aria-label="Sign out" className="p-1.5 text-navy-300 hover:text-white">
              <LogOut className="h-4 w-4" />
            </a>
          </div>
        </aside>

        <header className="lg:hidden sticky top-0 z-30 bg-navy-950 text-white">
          <div className="flex h-14 items-center justify-between px-4">
            <Link href="/operator" className="flex items-center gap-2.5">
              <LogoMark className="h-8 w-8 rounded-[9px] ring-1 ring-white/20" />
              <span className="text-sm font-semibold">{account.company}</span>
            </Link>
            <button className="p-1.5" onClick={() => setOpen(!open)} aria-label="Menu">
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
          {open && (
            <nav className="space-y-1 border-t border-white/10 px-4 py-3">
              {links(() => setOpen(false))}
              <a href="/api/operator/logout" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-navy-200">
                <LogOut className="h-[18px] w-[18px]" /> Sign out
              </a>
            </nav>
          )}
        </header>

        <main className="mx-auto max-w-[1320px] px-4 sm:px-6 lg:px-10 py-6 lg:py-10">{children}</main>
        <AlertToaster audience={account.id} />
      </div>
    </OperatorContext.Provider>
  );
}
