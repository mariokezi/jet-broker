import { Suspense } from "react";
import { OperatorLegs } from "@/components/operator/operator-legs";

export default function OperatorLegsPage() {
  return (
    <Suspense fallback={null}>
      <OperatorLegs />
    </Suspense>
  );
}
