import { Suspense } from "react";
import { Schedule } from "@/components/schedule";
import { LoadingBlock } from "@/components/ui-bits";

export default function SchedulePage() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <Schedule />
    </Suspense>
  );
}
