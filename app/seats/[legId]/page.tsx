import { SeatBooking } from "@/components/seat-booking";

export default async function SeatBookingPage({ params }: { params: Promise<{ legId: string }> }) {
  const { legId } = await params;
  return <SeatBooking legId={legId} />;
}
