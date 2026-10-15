import { NextRequest } from "next/server";
import { fetchInboxCounts, getRedirectUri, getStoredAccount, getStoredRefreshToken, getValidAccessToken, missingSettings, requestOrigin } from "@/lib/auth";

/** Connection state for the connect page. `?check=1` also reads inbox totals to prove access works. */
export async function GET(request: NextRequest) {
  const missing = missingSettings();
  const redirectUri = getRedirectUri(requestOrigin(request));
  if (missing.length) return Response.json({ configured: false, connected: false, missing, redirectUri });

  let connected = false;
  try {
    connected = (await getStoredRefreshToken()) !== null;
  } catch {
    connected = false;
  }
  const account = connected ? await getStoredAccount() : null;
  let inbox: { total: number; unread: number } | null = null;
  let healthy: boolean | null = null;
  if (connected && request.nextUrl.searchParams.get("check") === "1") {
    const token = await getValidAccessToken();
    healthy = token !== null;
    inbox = token ? await fetchInboxCounts(token) : null;
  }
  return Response.json({ configured: true, connected, account, inbox, healthy, missing: [], redirectUri });
}
