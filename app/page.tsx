import { buildTrips } from "@/lib/trip-builder";
import { TripOverviewTable } from "@/components/trip-overview-table";
import { Badge } from "@/components/ui/badge";
import { Plane } from "lucide-react";

export default async function OverviewPage() {
  const { trips, unmatched } = await buildTrips();

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Plane className="h-6 w-6 text-foreground" />
        <h1 className="text-2xl font-semibold tracking-tight">
          Active Trip Requests
        </h1>
        <Badge variant="secondary" className="text-sm font-normal">
          {trips.length}
        </Badge>
      </div>

      <TripOverviewTable trips={trips} unmatched={unmatched} />
    </main>
  );
}
