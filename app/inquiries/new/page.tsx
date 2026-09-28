import { InquiryIntake } from "@/components/inquiry-intake";
import { PageHeader } from "@/components/ui-bits";

export default function NewInquiryPage() {
  return (
    <>
      <PageHeader
        title="New Inquiry"
        subtitle="Paste any client request. The assistant extracts the trip, qualifies the lead, and prices it instantly."
      />
      <InquiryIntake />
    </>
  );
}
