import { buildTrips } from "@/lib/trip-builder";
import { QuoteDetailTable } from "@/components/quote-detail-table";
import { Badge } from "@/components/ui/badge";
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
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to trips
      </Link>

      <div className="mb-6 space-y-1">
        <div className="flex items-center gap-3">
          <Plane className="h-5 w-5" />
          <h1 className="text-2xl font-semibold tracking-tight">
            {trip.origin} → {trip.destination}
          </h1>
        </div>
        <p className="text-muted-foreground">
          {trip.originName} to {trip.destinationName}
        </p>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span>Date: {formattedDate}</span>
          <span>·</span>
          <span>Trip ID: {trip.tripId}</span>
          <span>·</span>
          <Badge variant="secondary" className="font-normal">
            {trip.quotes.length} quotes received
          </Badge>
        </div>
      </div>

      <div className="mb-4">
        <h2 className="text-lg font-medium">Accepted and Unanswered</h2>
      </div>

      <QuoteDetailTable quotes={trip.quotes} />
    </main>
  );
}
