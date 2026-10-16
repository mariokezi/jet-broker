import type { Metadata } from "next";
import { NetworkSplit } from "@/components/network-split";

export const metadata: Metadata = {
  title: "Live Network View | JetBroker",
};

export default function NetworkPage() {
  return <NetworkSplit />;
}
