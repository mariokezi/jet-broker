import { buildTrips } from "@/lib/trip-builder";
import { getDataContext } from "@/lib/data-mode";
import { QuotesBoard } from "@/components/quotes-board";
import type { Trip, UnmatchedEmail } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function QuotesPage() {
  const { mode, outlookLinked } = await getDataContext();
  let trips: Trip[] = [];
  let unmatched: UnmatchedEmail[] = [];
  let error: string | null = null;

  try {
    const result = await buildTrips();
    trips = result.trips;
    unmatched = result.unmatched;
  } catch (err) {
    console.error("[QuotesPage] Error loading data:", err);
    error = err instanceof Error ? err.message : "Failed to load email data";
  }

  return <QuotesBoard trips={trips} unmatched={unmatched} error={error} mode={mode} outlookLinked={outlookLinked} />;
}
