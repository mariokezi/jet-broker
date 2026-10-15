import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getAuthUrl, getRedirectUri, isConfigured, requestOrigin } from "@/lib/auth";

/** Starts Microsoft sign-in. `?hint=email` pre-fills the account; any Outlook account can be picked. */
export async function GET(request: NextRequest) {
  const origin = requestOrigin(request);
  if (!isConfigured()) return NextResponse.redirect(new URL("/connect?error=not_configured", origin));

  const state = crypto.randomBytes(16).toString("hex");
  const hint = request.nextUrl.searchParams.get("hint")?.trim() || null;
  const response = NextResponse.redirect(getAuthUrl(state, getRedirectUri(origin), hint));
  response.cookies.set("oauth_state", state, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 600 });
  return response;
}
