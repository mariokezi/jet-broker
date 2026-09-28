"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { LayoutDashboard, Inbox, Plane, CalendarDays, Settings, Plus, Menu, X, Repeat } from "lucide-react";
import { DataModeToggle } from "./data-mode-toggle";
import { EmailConnectionStatus } from "./email-connection-status";
import { useStore } from "./store-provider";
import { findMatches } from "@/lib/empty-legs";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/inquiries", label: "Inquiries", icon: Inbox },
  { href: "/quotes", label: "Quotes", icon: Plane },
  { href: "/empty-legs", label: "Empty Legs", icon: Repeat },
  { href: "/schedule", label: "Schedule", icon: CalendarDays },
  { href: "/settings", label: "Settings", icon: Settings },
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
  const company = store?.state.settings.companyName ?? "JetBroker";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950">
      <header className="border-b border-white/5 bg-slate-950/80 backdrop-blur-xl sticky top-0 z-30">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-6 min-w-0">
            <Link href="/" className="flex items-center gap-2.5 shrink-0">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/20">
                <Plane className="h-4 w-4 text-blue-400" />
              </div>
              <div className="leading-tight">
                <div className="text-sm font-semibold text-white tracking-tight">{company}</div>
                <div className="text-[10px] text-white/35">Charter Operations</div>
              </div>
            </Link>
            <nav className="hidden md:flex items-center gap-0.5">
              {NAV.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className={`relative flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors ${
                    isActive(href) ? "bg-white/[0.07] text-white" : "text-white/45 hover:text-white/80"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                  {href === "/empty-legs" && legMatches > 0 && (
                    <span className="ml-0.5 rounded-full bg-emerald-600 px-1.5 text-[10px] font-semibold text-white tabular-nums">{legMatches}</span>
                  )}
                  {href === "/inquiries" && newCount > 0 && (
                    <span className="ml-0.5 rounded-full bg-blue-600 px-1.5 text-[10px] font-semibold text-white tabular-nums">{newCount}</span>
                  )}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden lg:block">
              <DataModeToggle mode={mode} outlookLinked={outlookLinked} />
            </div>
            <div className="hidden xl:block">
              <EmailConnectionStatus />
            </div>
            <Link
              href="/inquiries/new"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              New Inquiry
            </Link>
            <button className="md:hidden text-white/60 p-1" onClick={() => setOpen(!open)} aria-label="Menu">
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
        {open && (
          <nav className="md:hidden border-t border-white/5 px-4 py-2 space-y-1">
            {NAV.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${isActive(href) ? "bg-white/[0.07] text-white" : "text-white/55"}`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            ))}
            <Link href="/inquiries/new" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-blue-300">
              <Plus className="h-4 w-4" /> New Inquiry
            </Link>
            <div className="pt-2">
              <DataModeToggle mode={mode} outlookLinked={outlookLinked} />
            </div>
          </nav>
        )}
      </header>
      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">{children}</main>
    </div>
  );
}
