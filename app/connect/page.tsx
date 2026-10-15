import { Suspense } from "react";
import { ConnectOutlook } from "@/components/connect-outlook";

export default function ConnectPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-canvas" />}>
      <ConnectOutlook />
    </Suspense>
  );
}
