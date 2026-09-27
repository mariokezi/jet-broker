import { Suspense } from "react";
import { EmptyLegsBoard } from "@/components/empty-legs-board";
import { LoadingBlock } from "@/components/ui-bits";

export default function EmptyLegsPage() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <EmptyLegsBoard />
    </Suspense>
  );
}
