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
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 mb-6">
          <h3 className="text-sm font-medium text-red-700">Error loading data</h3>
          <p className="text-xs text-red-700 mt-1">{error}</p>
        </div>
      )}

      {mode === "live" && !outlookLinked && !error && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-8 text-center mb-6">
          <h3 className="text-lg font-medium text-slate-900 mb-1">Outlook not connected</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            Click <strong>Connect Outlook</strong> above to link your inbox, or switch to <strong>Demo data</strong>.
          </p>
        </div>
      )}

      <TripOverviewTable trips={merged} unmatched={unmatched} />
    </>
  );
}
