import { buildTrips } from "@/lib/trip-builder";
import { QuoteDetailTable } from "@/components/quote-detail-table";
import { format, parseISO } from "date-fns";
import { ArrowLeft, Plane } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function TripDetailPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  const { trips } = await buildTrips();
  const trip = trips.find((t) => t.tripId === tripId);

  if (!trip) {
    notFound();
  }

  const formattedDate = format(parseISO(trip.date), "MMMM d, yyyy");

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950">
      {/* Header */}
      <header className="border-b border-white/5 bg-slate-950/80 backdrop-blur-xl sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-white/40 hover:text-white/70 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to trips
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Trip header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/20">
              <Plane className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-white tracking-tight">
                {trip.origin} → {trip.destination}
              </h1>
              <p className="text-sm text-white/40">
                {trip.originName} to {trip.destinationName}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 mt-3 ml-[52px]">
            <span className="text-sm text-white/50">{formattedDate}</span>
            <span className="text-white/20">&middot;</span>
            <span className="text-xs font-mono text-white/30 bg-white/5 rounded px-2 py-0.5">{trip.tripId}</span>
            <span className="text-white/20">&middot;</span>
            <span className="text-sm text-white/50">{trip.quotes.length} quotes received</span>
          </div>
        </div>

        <div className="mb-4">
          <h2 className="text-sm font-medium text-white/50 uppercase tracking-wider">
            Accepted and Unanswered
          </h2>
        </div>

        <QuoteDetailTable quotes={trip.quotes} />
      </main>
    </div>
  );
}
