"use client";

import { TripOverviewTable } from "./trip-overview-table";
import { AutoRefresh } from "./auto-refresh";
import { PageHeader } from "./ui-bits";
import { useMergedTrips } from "./use-trips";
import type { Trip, UnmatchedEmail } from "@/lib/types";

export function QuotesBoard({
  trips,
  unmatched,
  error,
  mode,
  outlookLinked,
}: {
  trips: Trip[];
  unmatched: UnmatchedEmail[];
  error: string | null;
  mode: "demo" | "live";
  outlookLinked: boolean;
}) {
  const merged = useMergedTrips(trips);
  const quoteCount = merged.reduce((sum, t) => sum + t.quotes.length, 0);

  return (
    <>
      <PageHeader
        title="Quote Board"
        subtitle={`${merged.length} trip${merged.length !== 1 ? "s" : ""} · ${quoteCount} operator quotes parsed automatically from ${mode === "demo" ? "the demo inbox" : "Outlook"}`}
      />

      <AutoRefresh intervalMs={60_000} />

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-6 mb-6">
          <h3 className="text-sm font-medium text-red-300">Error loading data</h3>
          <p className="text-xs text-red-300/60 mt-1">{error}</p>
        </div>
      )}

      {mode === "live" && !outlookLinked && !error && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-8 text-center mb-6">
          <h3 className="text-lg font-medium text-white mb-1">Outlook not connected</h3>
          <p className="text-sm text-white/40 max-w-md mx-auto">
            Click <strong>Connect Outlook</strong> above to link your inbox, or switch to <strong>Demo data</strong>.
          </p>
        </div>
      )}

      <TripOverviewTable trips={merged} unmatched={unmatched} />
    </>
  );
}
