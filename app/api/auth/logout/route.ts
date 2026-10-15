import { NextRequest, NextResponse } from "next/server";
import { requestOrigin } from "@/lib/auth";
import { DATA_MODE_COOKIE } from "@/lib/demo-clock";

/** Forgets the connected inbox in this browser. `?switch=1` goes straight to the account picker. */
export async function GET(request: NextRequest) {
  const origin = requestOrigin(request);
  const switching = request.nextUrl.searchParams.get("switch") === "1";
  const response = NextResponse.redirect(new URL(switching ? "/api/auth/login" : "/connect?disconnected=1", origin));
  response.cookies.set("ms_rt", "", { path: "/", maxAge: 0 });
  response.cookies.set("ms_acct", "", { path: "/", maxAge: 0 });
  if (!switching) response.cookies.set(DATA_MODE_COOKIE, "demo", { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  return response;
}
