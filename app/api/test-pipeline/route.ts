import { getStoredRefreshToken, refreshForAccessToken } from "@/lib/auth";
import { parseSubject, buildTripKey } from "@/lib/subject-parser";
import { parseQuoteFromText } from "@/lib/quote-parser";
import type { RawEmail } from "@/lib/types";

export async function GET() {
  const result: Record<string, unknown> = {};

  // Step 1: Get refresh token
  const rt = await getStoredRefreshToken();
  if (!rt) {
    result.step1_auth = "FAIL — No refresh token. Click Connect Outlook and sign in again.";
    return Response.json(result);
  }
  result.step1_auth = "OK";

  // Step 2: Get access token
  let accessToken: string;
  try {
    const tokens = await refreshForAccessToken(rt);
    accessToken = tokens.accessToken;
    result.step2_token = "OK";
  } catch (err) {
    result.step2_token = `FAIL — ${err instanceof Error ? err.message : String(err)}`;
    return Response.json(result);
  }

  // Step 3: Fetch emails with attachments info
  interface GraphEmail {
    id: string;
    subject: string;
    from: { emailAddress: { name: string; address: string } };
    receivedDateTime: string;
    body: { contentType: string; content: string };
    hasAttachments: boolean;
  }

  let emails: GraphEmail[];
  try {
    const res = await fetch(
      "https://graph.microsoft.com/v1.0/me/messages?$top=10&$orderby=receivedDateTime desc&$select=id,subject,from,receivedDateTime,body,hasAttachments",
      { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" }
    );
    if (!res.ok) {
      const body = await res.text();
      result.step3_fetch = `FAIL — Graph API ${res.status}: ${body}`;
      return Response.json(result);
    }
    const data = await res.json();
    emails = data.value ?? [];
    result.step3_fetch = `OK — ${emails.length} emails`;
  } catch (err) {
    result.step3_fetch = `FAIL — ${err instanceof Error ? err.message : String(err)}`;
    return Response.json(result);
  }

  // Step 4: Parse each email and check attachments
  const parsed = [];
  for (const e of emails) {
    const subjectParsed = parseSubject(e.subject);
    const tripKey = buildTripKey(subjectParsed);

    // Check for attachments
    let attachmentInfo: string[] = [];
    if (e.hasAttachments) {
      try {
        const attRes = await fetch(
          `https://graph.microsoft.com/v1.0/me/messages/${e.id}/attachments?$select=id,name,contentType,size,isInline`,
          { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" }
        );
        if (attRes.ok) {
          const attData = await attRes.json();
          attachmentInfo = (attData.value ?? []).map((a: { name: string; contentType: string; size: number; isInline: boolean }) =>
            `${a.name} (${a.contentType}, ${a.size} bytes, inline=${a.isInline})`
          );
        }
      } catch {
        attachmentInfo = ["Failed to fetch attachments"];
      }
    }

    // Strip HTML for preview
    const bodyPreview = e.body.contentType === "html"
      ? e.body.content.replace(/<[^>]+>/g, "").slice(0, 200)
      : e.body.content.slice(0, 200);

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

    parsed.push({
      subject: e.subject,
      from: e.from?.emailAddress?.address,
      received: e.receivedDateTime,
      hasAttachments: e.hasAttachments,
      attachments: attachmentInfo,
      bodyPreview,
      parsedRoute: subjectParsed.origin && subjectParsed.destination
        ? `${subjectParsed.origin} → ${subjectParsed.destination}`
        : "NOT PARSED",
      parsedDate: subjectParsed.date ?? "NOT PARSED",
      tripKey: tripKey ?? "NO MATCH — goes to unmatched",
      extractedPrice: quote.priceFormatted ?? "not found",
      extractedAircraft: quote.aircraft ?? "not found",
      extractedTail: quote.tailNumber ?? "not found",
    });
  }

  result.step4_emails = parsed;
  return Response.json(result, { status: 200 });
}
