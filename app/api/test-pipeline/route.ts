import { getStoredRefreshToken, refreshForAccessToken } from "@/lib/auth";
import { parseSubject, buildTripKey } from "@/lib/subject-parser";
import { parseQuoteFromText } from "@/lib/quote-parser";
import type { RawEmail } from "@/lib/types";

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = Buffer.from(parts[1], "base64url").toString("utf8");
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

export async function GET() {
  const result: Record<string, unknown> = {};

  // Step 1: Get refresh token
  const rt = await getStoredRefreshToken();
  if (!rt) {
    result.step1_auth = "FAIL — No refresh token. Click Connect Outlook and sign in again.";
    return Response.json(result);
  }
  result.step1_auth = "OK — refresh token found";

  // Step 2: Get access token
  let accessToken: string;
  try {
    const tokens = await refreshForAccessToken(rt);
    accessToken = tokens.accessToken;
    result.step2_token = "OK — got access token";

    // Decode token to check scopes and audience
    const payload = decodeJwtPayload(accessToken);
    if (payload) {
      result.step2_token_details = {
        audience: payload.aud,
        scopes: payload.scp,
        issuer: payload.iss,
        expiresAt: payload.exp,
      };
    }
  } catch (err) {
    result.step2_token = `FAIL — ${err instanceof Error ? err.message : String(err)}`;
    return Response.json(result);
  }

  // Step 3: Fetch emails
  let emails: Array<{ id: string; subject: string; from: { emailAddress: { name: string; address: string } }; receivedDateTime: string; body: { contentType: string; content: string } }>;
  try {
    const res = await fetch(
      "https://graph.microsoft.com/v1.0/me/messages?$top=10&$orderby=receivedDateTime desc&$select=id,subject,from,receivedDateTime,body",
      { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" }
    );
    if (!res.ok) {
      const body = await res.text();
      result.step3_fetch = `FAIL — Graph API ${res.status}: ${body}`;

      // If 401, try with /me/mailfolders to see if basic access works
      const testRes = await fetch(
        "https://graph.microsoft.com/v1.0/me",
        { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" }
      );
      result.step3_me_test = testRes.ok
        ? `GET /me works — status ${testRes.status}`
        : `GET /me also fails — status ${testRes.status}`;

      return Response.json(result);
    }
    const data = await res.json();
    emails = data.value ?? [];
    result.step3_fetch = `OK — ${emails.length} emails in inbox`;
  } catch (err) {
    result.step3_fetch = `FAIL — ${err instanceof Error ? err.message : String(err)}`;
    return Response.json(result);
  }

  // Step 4: Parse each email
  const parsed = emails.map((e) => {
    const subjectParsed = parseSubject(e.subject);
    const tripKey = buildTripKey(subjectParsed);

    const rawEmail: RawEmail = {
      id: e.id,
      subject: e.subject ?? "",
      from: e.from?.emailAddress?.address ?? "",
      fromName: e.from?.emailAddress?.name ?? "",
      receivedAt: e.receivedDateTime,
      bodyType: e.body.contentType === "html" ? "html" : "text",
      body: e.body.content ?? "",
      attachments: [],
    };

    const quote = parseQuoteFromText(rawEmail);

    return {
      subject: e.subject,
      from: e.from?.emailAddress?.address,
      received: e.receivedDateTime,
      parsedRoute: subjectParsed.origin && subjectParsed.destination
        ? `${subjectParsed.origin} → ${subjectParsed.destination}`
        : "NOT PARSED",
      parsedDate: subjectParsed.date ?? "NOT PARSED",
      tripKey: tripKey ?? "NO MATCH — will go to unmatched",
      extractedPrice: quote.priceFormatted ?? "not found",
      extractedAircraft: quote.aircraft ?? "not found",
      extractedTail: quote.tailNumber ?? "not found",
      extractedOperator: quote.operator ?? "not found",
    };
  });

  result.step4_parsed = parsed;
  result.conclusion = "Pipeline complete — check step4_parsed to see how each email was handled";

  return Response.json(result, { status: 200 });
}
