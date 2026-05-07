import { buildTrips } from "@/lib/trip-builder";
import { isLiveConnected } from "@/lib/o365-client";
import { TripOverviewTable } from "@/components/trip-overview-table";
import { EmailConnectionStatus } from "@/components/email-connection-status";
import { AutoRefresh } from "@/components/auto-refresh";
import { Plane, MailWarning, AlertTriangle } from "lucide-react";
import type { Trip, UnmatchedEmail } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function OverviewPage() {
  let connected = false;
  let trips: Trip[] = [];
  let unmatched: UnmatchedEmail[] = [];
  let error: string | null = null;

  try {
    connected = await isLiveConnected();
    const result = await buildTrips();
    trips = result.trips;
    unmatched = result.unmatched;
  } catch (err) {
    console.error("[OverviewPage] Error loading data:", err);
    error = err instanceof Error ? err.message : "Failed to load email data";
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950">
      <header className="border-b border-white/5 bg-slate-950/80 backdrop-blur-xl sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/20">
              <Plane className="h-4.5 w-4.5 text-blue-400" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-white tracking-tight">
                JetBroker
              </h1>
              <p className="text-xs text-white/40">Quote Aggregator</p>
            </div>
          </div>
          <EmailConnectionStatus />
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <AutoRefresh intervalMs={60_000} />

        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-white">
              Active Trip Requests
            </h2>
            <p className="text-sm text-white/40 mt-1">
              {trips.length} trips -- {trips.reduce((sum, t) => sum + t.quotes.length, 0)} total quotes
            </p>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-6 mb-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-red-400 shrink-0" />
              <div>
                <h3 className="text-sm font-medium text-red-300">Error loading data</h3>
                <p className="text-xs text-red-300/60 mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {!connected && !error && trips.length === 0 && unmatched.length === 0 && (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-8 text-center mb-6">
            <MailWarning className="h-10 w-10 text-amber-400/60 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-white mb-1">Outlook not connected</h3>
            <p className="text-sm text-white/40 max-w-md mx-auto">
              Click <strong>Connect Outlook</strong> above to link your email. Once connected, quote emails will appear here automatically.
            </p>
          </div>
        )}

        <TripOverviewTable trips={trips} unmatched={unmatched} />
      </main>
    </div>
  );
}
