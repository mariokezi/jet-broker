import { Suspense } from "react";
import { MessagesHub } from "@/components/messages-hub";
import { LoadingBlock } from "@/components/ui-bits";

export default function MessagesPage() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <MessagesHub />
    </Suspense>
  );
}
