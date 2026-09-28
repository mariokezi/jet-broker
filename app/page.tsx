import { buildTrips } from "@/lib/trip-builder";
import { getDataContext } from "@/lib/data-mode";
import { Dashboard } from "@/components/dashboard";
import type { Trip } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function DashboardPage() {
  const { mode } = await getDataContext();
  let trips: Trip[] = [];
  try {
    trips = (await buildTrips()).trips;
  } catch (err) {
    console.error("[Dashboard] Error loading trips:", err);
  }
  return <Dashboard trips={trips} mode={mode} />;
}
