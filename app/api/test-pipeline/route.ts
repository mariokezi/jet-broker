import { getStoredRefreshToken, refreshForAccessToken } from "@/lib/auth";
import { parseSubject, buildTripKey } from "@/lib/subject-parser";
import { resolveToICAO } from "@/lib/airport-lookup";

export async function GET() {
  const result: Record<string, unknown> = {};

  const rt = await getStoredRefreshToken();
  if (!rt) {
    result.error = "No refresh token. Click Connect Outlook.";
    return Response.json(result);
  }

  let accessToken: string;
  try {
    const tokens = await refreshForAccessToken(rt);
    accessToken = tokens.accessToken;
    result.auth = "OK";
  } catch (err) {
    result.auth = `FAIL: ${err instanceof Error ? err.message : String(err)}`;
    return Response.json(result);
  }

  // Fetch emails
  const msgRes = await fetch(
    "https://graph.microsoft.com/v1.0/me/messages?$top=10&$orderby=receivedDateTime desc&$select=id,subject,from,receivedDateTime,body,hasAttachments",
    { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" }
  );
  if (!msgRes.ok) {
    result.emails = `FAIL: ${msgRes.status}`;
    return Response.json(result);
  }
  const msgData = await msgRes.json();
  const messages = msgData.value ?? [];
  result.emailCount = messages.length;

  const emailResults = [];
  for (const msg of messages) {
    const entry: Record<string, unknown> = {
      subject: msg.subject,
      from: msg.from?.emailAddress?.address,
      hasAttachments: msg.hasAttachments,
    };

    // Parse subject
    const parsed = parseSubject(msg.subject);
    entry.subjectParsed = {
      origin: parsed.origin,
      destination: parsed.destination,
      date: parsed.date,
      tripKey: buildTripKey(parsed) ?? "NO MATCH",
    };

    // Check attachments
    if (msg.hasAttachments) {
      const attRes = await fetch(
        `https://graph.microsoft.com/v1.0/me/messages/${msg.id}/attachments?$select=id,name,contentType,size,isInline,contentBytes`,
        { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" }
      );
      if (attRes.ok) {
        const attData = await attRes.json();
        const atts = attData.value ?? [];
        entry.attachments = atts.map((a: { name: string; contentType: string; size: number; isInline: boolean; contentBytes?: string }) => ({
          name: a.name,
          type: a.contentType,
          size: a.size,
          inline: a.isInline,
          hasContentBytes: !!a.contentBytes,
          contentBytesLength: a.contentBytes?.length ?? 0,
        }));

        // Try filename route extraction
        for (const a of atts) {
          const upper = a.name.toUpperCase();
          const match = upper.match(/([A-Z]{3,4})\s*[-_>\s]\s*([A-Z]{3,4})/);
          if (match) {
            const o = resolveToICAO(match[1]);
            const d = resolveToICAO(match[2]);
            if (o && d) {
              entry.filenameRoute = `${o} -> ${d}`;
            }
          }

          // Try PDF text extraction
          if (a.contentType === "application/pdf" || a.name?.toLowerCase().endsWith(".pdf")) {
            let base64: string | null = a.contentBytes ?? null;
            if (!base64) {
              // Download via $value
              const dlRes = await fetch(
                `https://graph.microsoft.com/v1.0/me/messages/${msg.id}/attachments/${a.id}/$value`,
                { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" }
              );
              if (dlRes.ok) {
                const buf = await dlRes.arrayBuffer();
                base64 = Buffer.from(buf).toString("base64");
                entry.pdfDownloaded = true;
                entry.pdfBase64Length = base64.length;
              } else {
                entry.pdfDownloadError = dlRes.status;
              }
            } else {
              entry.pdfBase64Length = base64.length;
            }

            if (base64) {
              try {
                const { extractTextFromPdf } = await import("@/lib/pdf-extract");
                const pdfText = await extractTextFromPdf(base64);
                if (pdfText) {
                  entry.pdfText = pdfText.slice(0, 500);
                  entry.pdfTextLength = pdfText.length;

                  const pdfParsed = parseSubject(pdfText);
                  entry.pdfParsed = {
                    origin: pdfParsed.origin,
                    destination: pdfParsed.destination,
                    date: pdfParsed.date,
                    tripKey: buildTripKey(pdfParsed) ?? "NO MATCH",
                  };
                } else {
                  entry.pdfText = "EXTRACTION RETURNED NULL";
                }
              } catch (err) {
                entry.pdfParseError = err instanceof Error ? err.message : String(err);
              }
            }
          }
        }
      }
    }

    emailResults.push(entry);
  }

  result.emails = emailResults;
  return Response.json(result);
}
