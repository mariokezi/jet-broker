"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { LayoutDashboard, Inbox, Plane, CalendarDays, Settings, Plus, Menu, X, Repeat } from "lucide-react";
import { DataModeToggle } from "./data-mode-toggle";
import { EmailConnectionStatus } from "./email-connection-status";
import { useStore } from "./store-provider";
import { LogoMark } from "./brand";
import { findMatches } from "@/lib/empty-legs";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/inquiries", label: "Inquiries", icon: Inbox },
  { href: "/quotes", label: "Quotes", icon: Plane },
  { href: "/empty-legs", label: "Empty Legs", icon: Repeat },
  { href: "/schedule", label: "Schedule", icon: CalendarDays },
];

// Routes that render without the broker chrome (client facing or auth)
const BARE = [/^\/login/, /^\/proposal\//, /^\/request/];

export function AppShell({
  children,
  mode,
  outlookLinked,
}: {
  children: React.ReactNode;
  mode: "demo" | "live";
  outlookLinked: boolean;
}) {
  const pathname = usePathname();
  const store = useStore();
  const [open, setOpen] = useState(false);

  if (BARE.some((re) => re.test(pathname))) return <>{children}</>;

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href) || (href === "/quotes" && pathname.startsWith("/trip"));

  const newCount = store?.state.inquiries.filter((i) => i.status === "New" || i.status === "Qualified").length ?? 0;
  const legMatches = store ? findMatches(store.state.emptyLegs, store.state.inquiries).length : 0;
  const settings = store?.state.settings;
  const company = settings?.companyName ?? "JetBroker";
  const broker = settings?.brokerName ?? "";
  const initials = broker.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();

  const badge = (href: string) =>
    href === "/empty-legs" && legMatches > 0 ? (
      <span className="ml-auto rounded-full bg-gold-100 px-2 py-0.5 text-[11px] font-semibold text-gold-700 tabular-nums">{legMatches}</span>
    ) : href === "/inquiries" && newCount > 0 ? (
      <span className="ml-auto rounded-full bg-navy-100 px-2 py-0.5 text-[11px] font-semibold text-navy-800 tabular-nums">{newCount}</span>
    ) : null;

  const navLinks = (onClick?: () => void) => (
    <>
      {NAV.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          onClick={onClick}
          className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
            isActive(href) ? "bg-white text-navy-900 shadow-sm ring-1 ring-slate-200" : "text-slate-500 hover:bg-white/70 hover:text-navy-900"
          }`}
        >
          <Icon className={`h-[18px] w-[18px] ${isActive(href) ? "text-gold-600" : "text-slate-400 group-hover:text-navy-700"}`} />
          {label}
          {badge(href)}
        </Link>
      ))}
    </>
  );

  return (
    <div className="min-h-screen bg-canvas lg:pl-64">
      {/* Sidebar */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-64 flex-col border-r border-slate-200/80 bg-canvas px-4 py-5">
        <Link href="/" className="flex items-center gap-3 px-2 mb-8">
          <LogoMark />
          <div className="leading-tight">
            <div className="text-[15px] font-semibold text-navy-900 tracking-tight">{company}</div>
            <div className="text-[11px] text-slate-500">Charter Operations</div>
          </div>
        </Link>
        <Link
          href="/inquiries/new"
          className="mb-6 flex items-center justify-center gap-2 rounded-xl bg-navy-900 px-3 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-navy-800 transition-colors"
        >
          <Plus className="h-4 w-4" /> New Inquiry
        </Link>
        <div className="px-3 mb-2 text-[11px] font-medium uppercase tracking-wider text-slate-400">Workspace</div>
        <nav className="space-y-1">{navLinks()}</nav>

        <div className="mt-auto space-y-3">
          <DataModeToggle mode={mode} outlookLinked={outlookLinked} />
          <EmailConnectionStatus />
          <Link
            href="/settings"
            className={`flex items-center gap-3 rounded-xl px-2 py-2 transition-colors ${isActive("/settings") ? "bg-white ring-1 ring-slate-200" : "hover:bg-white/70"}`}
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gold-100 text-xs font-semibold text-gold-700">{initials || "JB"}</span>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-sm font-medium text-navy-900">{broker || "Broker"}</span>
              <span className="block text-[11px] text-slate-500">Settings</span>
            </span>
            <Settings className="h-4 w-4 text-slate-400" />
          </Link>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="lg:hidden sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur-xl">
        <div className="flex h-14 items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2.5">
            <LogoMark className="h-8 w-8" />
            <span className="text-sm font-semibold text-navy-900">{company}</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/inquiries/new" className="inline-flex items-center gap-1 rounded-lg bg-navy-900 px-2.5 py-1.5 text-xs font-medium text-white">
              <Plus className="h-3.5 w-3.5" /> New
            </Link>
            <button className="p-1.5 text-slate-600" onClick={() => setOpen(!open)} aria-label="Menu">
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
        {open && (
          <nav className="border-t border-slate-200 bg-canvas px-4 py-3 space-y-1">
            {navLinks(() => setOpen(false))}
            <Link href="/settings" onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-500">
              <Settings className="h-[18px] w-[18px] text-slate-400" /> Settings
            </Link>
            <div className="pt-2">
              <DataModeToggle mode={mode} outlookLinked={outlookLinked} />
            </div>
          </nav>
        )}
      </header>

      <main className="mx-auto max-w-[1320px] px-4 sm:px-6 lg:px-10 py-6 lg:py-10">{children}</main>
    </div>
  );
}
