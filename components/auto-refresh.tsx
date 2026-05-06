"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

export function AutoRefresh({ intervalMs = 60_000 }: { intervalMs?: number }) {
  const router = useRouter();
  const [lastChecked, setLastChecked] = useState<Date>(new Date());
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const id = setInterval(() => {
      setRefreshing(true);
      router.refresh();
      setLastChecked(new Date());
      setTimeout(() => setRefreshing(false), 1500);
    }, intervalMs);

    return () => clearInterval(id);
  }, [router, intervalMs]);

  function handleManualRefresh() {
    setRefreshing(true);
    router.refresh();
    setLastChecked(new Date());
    setTimeout(() => setRefreshing(false), 1500);
  }

  const timeStr = lastChecked.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="flex items-center gap-2 text-xs text-white/30">
      <span>Last checked {timeStr}</span>
      <button
        onClick={handleManualRefresh}
        className="p-1 rounded hover:bg-white/5 transition-colors"
        title="Refresh now"
      >
        <RefreshCw className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`} />
      </button>
    </div>
  );
}
