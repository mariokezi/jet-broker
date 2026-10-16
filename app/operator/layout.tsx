import type { Metadata } from "next";
import { cookies } from "next/headers";
import { OperatorShell } from "@/components/operator/operator-shell";

export const metadata: Metadata = {
  title: "Operator Portal | JetBroker Network",
};

export default async function OperatorLayout({ children }: { children: React.ReactNode }) {
  const operatorId = (await cookies()).get("op_auth")?.value ?? null;
  return <OperatorShell operatorId={operatorId}>{children}</OperatorShell>;
}
