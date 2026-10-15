"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Loader2, LogIn, Mail } from "lucide-react";

interface Status {
  connected: boolean;
  account?: { name: string | null; email: string | null } | null;
}

/** Sidebar link to the Outlook connect page, showing which inbox is linked. */
export function EmailConnectionStatus() {
  const [status, setStatus] = useState<Status | null>(null);

  useEffect(() => {
    fetch("/api/auth/status", { cache: "no-store" })
      .then((r) => r.json())
      .then((data: Status) => setStatus(data))
      .catch(() => setStatus({ connected: false }));
  }, []);

  if (!status) {
    return (
      <div className="flex items-center gap-2 px-1 text-xs text-slate-500">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking Outlook…
      </div>
    );
  }

  if (status.connected) {
    return (
      <Link href="/connect" className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 hover:bg-emerald-100" title="Manage the connected Outlook inbox">
        <Mail className="h-3.5 w-3.5 shrink-0" />
        <span className="min-w-0 truncate">{status.account?.email ?? "Outlook connected"}</span>
      </Link>
    );
  }

  return (
    <Link href="/connect" className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-navy-900 hover:bg-slate-50">
      <LogIn className="h-3.5 w-3.5" /> Connect Outlook
    </Link>
  );
}
