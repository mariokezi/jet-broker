import { getStoredRefreshToken, refreshForAccessToken } from "@/lib/auth";

export async function GET() {
  const steps: Record<string, unknown> = {};

  // Step 1: Check env vars
  steps.envVars = {
    CLIENT_ID: !!process.env.CLIENT_ID,
    TENANT_ID: !!process.env.TENANT_ID,
    CLIENT_SECRET: !!process.env.CLIENT_SECRET,
    COOKIE_SECRET: !!process.env.COOKIE_SECRET,
    APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? "NOT SET",
  };

  // Step 2: Check refresh token cookie
  let refreshToken: string | null = null;
  try {
    refreshToken = await getStoredRefreshToken();
    steps.refreshToken = refreshToken ? `FOUND (${refreshToken.length} chars)` : "NOT FOUND";
  } catch (err) {
    steps.refreshToken = `ERROR: ${err}`;
  }

  if (!refreshToken) {
    steps.conclusion = "No refresh token cookie — user needs to click Connect Outlook";
    return Response.json(steps);
  }

  // Step 3: Exchange refresh token for access token
  let accessToken: string | null = null;
  try {
    const result = await refreshForAccessToken(refreshToken);
    accessToken = result.accessToken;
    steps.tokenRefresh = `SUCCESS (access token: ${accessToken.length} chars)`;
  } catch (err) {
    steps.tokenRefresh = `ERROR: ${err instanceof Error ? err.message : String(err)}`;
    steps.conclusion = "Token refresh failed — user may need to re-connect Outlook";
    return Response.json(steps);
  }

  // Step 4: Fetch emails from Graph API
  try {
    const res = await fetch(
      "https://graph.microsoft.com/v1.0/me/messages?$top=5&$orderby=receivedDateTime desc&$select=id,subject,from,receivedDateTime",
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      }
    );

    if (!res.ok) {
      const body = await res.text();
      steps.graphApi = `ERROR ${res.status}: ${body}`;
      steps.conclusion = "Graph API call failed";
      return Response.json(steps);
    }

    const data = await res.json();
    const emails = data.value ?? [];
    steps.graphApi = `SUCCESS — ${emails.length} emails found`;
    steps.latestEmails = emails.map((e: { subject: string; from: { emailAddress: { address: string } }; receivedDateTime: string }) => ({
      subject: e.subject,
      from: e.from?.emailAddress?.address,
      received: e.receivedDateTime,
    }));
  } catch (err) {
    steps.graphApi = `FETCH ERROR: ${err instanceof Error ? err.message : String(err)}`;
  }

  steps.conclusion = "Pipeline is working — emails are being fetched";
  return Response.json(steps, { status: 200 });
}
