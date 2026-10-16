import { Suspense } from "react";
import { OperatorRequests } from "@/components/operator/operator-requests";

export default function OperatorRequestsPage() {
  return (
    <Suspense fallback={null}>
      <OperatorRequests />
    </Suspense>
  );
}
