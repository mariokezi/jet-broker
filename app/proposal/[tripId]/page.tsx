import { ClientProposal } from "@/components/client-proposal";

export default async function ProposalPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  return <ClientProposal tripId={tripId} />;
}
