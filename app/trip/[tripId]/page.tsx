import { buildTrips } from "@/lib/trip-builder";
import { getDataContext } from "@/lib/data-mode";
import { TripWorkspace } from "@/components/trip-workspace";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function TripDetailPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  const { mode } = await getDataContext();
  const { trips } = await buildTrips();
  const trip = trips.find((t) => t.tripId === tripId) ?? null;

  // Trips sourced from inquiries live in client state; the workspace resolves them
  return <TripWorkspace tripId={tripId} serverTrip={trip} mode={mode} />;
}
