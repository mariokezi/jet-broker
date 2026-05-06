import { getAuthUrl } from "@/lib/auth";
import crypto from "crypto";

export async function GET() {
  const state = crypto.randomBytes(16).toString("hex");

  const url = getAuthUrl(state);

  const response = new Response(null, {
    status: 302,
    headers: { Location: url },
  });

  response.headers.append(
    "Set-Cookie",
    `oauth_state=${state}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`
  );

  return response;
}
