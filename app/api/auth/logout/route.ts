import { NextRequest, NextResponse } from "next/server";
import { clearTokenCookies, requestOrigin } from "@/lib/auth";
import { DATA_MODE_COOKIE } from "@/lib/demo-clock";

/** Forgets the connected inbox in this browser. `?switch=1` goes straight to the account picker. */
export async function GET(request: NextRequest) {
  const origin = requestOrigin(request);
  const switching = request.nextUrl.searchParams.get("switch") === "1";
  const response = NextResponse.redirect(new URL(switching ? "/api/auth/login" : "/connect?disconnected=1", origin));
  for (const c of clearTokenCookies()) response.headers.append("Set-Cookie", c);
  if (!switching) response.headers.append("Set-Cookie", `${DATA_MODE_COOKIE}=demo; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax`);
  return response;
}
