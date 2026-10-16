import { NextRequest } from "next/server";
import { OPERATOR_ACCOUNTS } from "@/lib/network";

const OPERATOR_PASSWORD = process.env.OPERATOR_PASSWORD || "fly2026";

export async function POST(request: NextRequest) {
  const { email, password } = (await request.json().catch(() => ({}))) as { email?: string; password?: string };
  const account = OPERATOR_ACCOUNTS.find((a) => a.email.toLowerCase() === String(email ?? "").trim().toLowerCase());
  if (!account || password !== OPERATOR_PASSWORD) {
    return Response.json({ success: false, error: "Email or password is incorrect" }, { status: 401 });
  }
  const response = Response.json({ success: true, operator: account.id });
  response.headers.append("Set-Cookie", `op_auth=${account.id}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${30 * 24 * 60 * 60}`);
  return response;
}
