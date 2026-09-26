import { buildTrips } from "@/lib/trip-builder";
import { InquiryDetail } from "@/components/inquiry-detail";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function InquiryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let emailQuoteCounts: Record<string, number> = {};
  try {
    const { trips } = await buildTrips();
    emailQuoteCounts = Object.fromEntries(trips.map((t) => [t.tripId, t.quotes.length]));
  } catch {
    // quote counts are informational only
  }
  return <InquiryDetail id={id} emailQuoteCounts={emailQuoteCounts} />;
}
