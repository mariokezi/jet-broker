import { buildTrips } from "@/lib/trip-builder";
import { TripOverviewTable } from "@/components/trip-overview-table";
import { EmailConnectionStatus } from "@/components/email-connection-status";
import { AutoRefresh } from "@/components/auto-refresh";
import { Plane } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const { trips, unmatched } = await buildTrips();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950">
      {/* Header */}
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

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <AutoRefresh intervalMs={60_000} />

        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-white">
              Active Trip Requests
            </h2>
            <p className="text-sm text-white/40 mt-1">
              {trips.length} trips &middot; {trips.reduce((sum, t) => sum + t.quotes.length, 0)} total quotes
            </p>
          </div>
        </div>

        <TripOverviewTable trips={trips} unmatched={unmatched} />
      </main>
    </div>
  );
}
