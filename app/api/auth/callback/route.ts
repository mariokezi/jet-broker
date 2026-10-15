import { NextRequest, NextResponse } from "next/server";
import { buildAccountCookie, buildTokenCookie, exchangeCodeForTokens, fetchAccount, getRedirectUri, requestOrigin } from "@/lib/auth";
import { DATA_MODE_COOKIE } from "@/lib/demo-clock";

/** Microsoft sends the user back here after sign-in. Errors return to the connect page with a reason. */
export async function GET(request: NextRequest) {
  const origin = requestOrigin(request);
  const params = request.nextUrl.searchParams;
  const back = (error: string, detail?: string) => {
    const url = new URL("/connect", origin);
    url.searchParams.set("error", error);
    if (detail) url.searchParams.set("detail", detail.slice(0, 300));
    return NextResponse.redirect(url);
  };

  const error = params.get("error");
  if (error) return back(error, params.get("error_description") ?? undefined);

  const code = params.get("code");
  const state = params.get("state");
  if (!code) return back("missing_code");
  if (!state || state !== request.cookies.get("oauth_state")?.value) return back("state_mismatch");

  try {
    const { accessToken, refreshToken } = await exchangeCodeForTokens(code, getRedirectUri(origin));
    const account = await fetchAccount(accessToken);
    const response = NextResponse.redirect(new URL("/connect?connected=1", origin));
    response.headers.append("Set-Cookie", buildTokenCookie(refreshToken));
    response.headers.append("Set-Cookie", buildAccountCookie(account));
    response.cookies.set("oauth_state", "", { path: "/", maxAge: 0 });
    // A fresh connection should show the real inbox
    response.cookies.set(DATA_MODE_COOKIE, "live", { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
    return response;
  } catch (err) {
    console.error("Token exchange error:", err);
    const message = err instanceof Error ? err.message : String(err);
    // Microsoft returns JSON; keep just its human readable description
    const described = message.match(/"error_description":"(AADSTS\d+: [^."]*)/)?.[1];
    return back("token_exchange", described ?? message);
  }
}
