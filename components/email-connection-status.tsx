"use client";

import { useEffect, useState } from "react";
import { Mail, MailX, Loader2, LogIn, LogOut } from "lucide-react";

export function EmailConnectionStatus() {
  const [connected, setConnected] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/auth/status")
      .then((r) => r.json())
      .then((data) => setConnected(data.connected))
      .catch(() => setConnected(false));
  }, []);

  if (connected === null) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Checking...
      </div>
    );
  }

  if (connected) {
    return (
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-sm text-emerald-400">
          <Mail className="h-4 w-4" />
          <span>Outlook connected</span>
        </div>
        <a
          href="/api/auth/logout"
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/70 hover:bg-white/10 hover:text-white transition-colors"
        >
          <LogOut className="h-3 w-3" />
          Disconnect
        </a>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2 text-sm text-white/50">
        <MailX className="h-4 w-4" />
        <span>Demo data</span>
      </div>
      <a
        href="/api/auth/login"
        className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500 transition-colors"
      >
        <LogIn className="h-3 w-3" />
        Connect Outlook
      </a>
    </div>
  );
}
