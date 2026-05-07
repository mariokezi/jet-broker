"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";

export function AutoRefresh({ intervalMs = 60_000 }: { intervalMs?: number }) {
  const router = useRouter();
  const [lastChecked, setLastChecked] = useState<Date>(new Date());
  const [refreshing, setRefreshing] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const doRefresh = useCallback(() => {
    setRefreshing(true);
    router.refresh();
    setLastChecked(new Date());
    setElapsed(0);
    setTimeout(() => setRefreshing(false), 1500);
  }, [router]);

  // Auto-refresh interval
  useEffect(() => {
    const id = setInterval(doRefresh, intervalMs);
    return () => clearInterval(id);
  }, [doRefresh, intervalMs]);

  // Elapsed time ticker (every 10s)
  useEffect(() => {
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - lastChecked.getTime()) / 1000));
    }, 10_000);
    return () => clearInterval(id);
  }, [lastChecked]);

  function formatElapsed(secs: number): string {
    if (secs < 10) return "just now";
    if (secs < 60) return `${secs}s ago`;
    const mins = Math.floor(secs / 60);
    if (mins === 1) return "1 min ago";
    return `${mins} min ago`;
  }

  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="flex items-center gap-2 text-xs text-white/35">
        {/* Pulse dot */}
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/40" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400/80" />
        </span>
        <span>Updated {formatElapsed(elapsed)}</span>
      </div>

      <button
        onClick={doRefresh}
        disabled={refreshing}
        className="flex items-center gap-1.5 rounded-lg border border-white/8 bg-white/[0.03] px-2.5 py-1 text-xs text-white/40 hover:text-white/70 hover:bg-white/[0.06] transition-all disabled:opacity-40"
        title="Refresh now"
      >
        <svg
          className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`}
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M1.5 8a6.5 6.5 0 0 1 11.25-4.5M14.5 8a6.5 6.5 0 0 1-11.25 4.5" />
          <path d="M13.5 1v3.5H10M2.5 15v-3.5H6" />
        </svg>
        Refresh
      </button>

      {/* Next auto-refresh countdown */}
      <div className="text-[10px] text-white/20 tabular-nums">
        next in {Math.max(0, Math.floor((intervalMs / 1000) - elapsed))}s
      </div>
    </div>
  );
}
