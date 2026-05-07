import { getStoredRefreshToken, refreshForAccessToken } from "@/lib/auth";
import { parseSubject, buildTripKey } from "@/lib/subject-parser";
import { resolveToICAO } from "@/lib/airport-lookup";

export const maxDuration = 60;

export async function GET() {
  const result: Record<string, unknown> = {};

  const rt = await getStoredRefreshToken();
  if (!rt) {
    return Response.json({ error: "No refresh token. Click Connect Outlook." });
  }

  let accessToken: string;
  try {
    const tokens = await refreshForAccessToken(rt);
    accessToken = tokens.accessToken;
    result.auth = "OK";
  } catch (err) {
    return Response.json({ auth: `FAIL: ${err instanceof Error ? err.message : String(err)}` });
  }

  // Fetch emails
  const msgRes = await fetch(
    "https://graph.microsoft.com/v1.0/me/messages?$top=10&$orderby=receivedDateTime desc&$select=id,subject,from,receivedDateTime,body,hasAttachments",
    { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" }
  );
  if (!msgRes.ok) {
    return Response.json({ auth: "OK", emails: `FAIL: ${msgRes.status}` });
  }
  const msgData = await msgRes.json();
  const messages = msgData.value ?? [];
  result.emailCount = messages.length;

  const emailResults = [];
  for (const msg of messages) {
    // Skip Microsoft system emails
    const fromAddr = msg.from?.emailAddress?.address ?? "";
    if (fromAddr.endsWith("microsoft.com")) continue;

    const entry: Record<string, unknown> = {
      subject: msg.subject,
      from: fromAddr,
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

    // Check attachments — THIS IS THE CRITICAL SECTION
    if (msg.hasAttachments) {
      try {
        const attUrl = `https://graph.microsoft.com/v1.0/me/messages/${msg.id}/attachments`;
        entry.attachmentUrl = attUrl;

        const attRes = await fetch(attUrl, {
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: "no-store",
        });

        entry.attachmentFetchStatus = attRes.status;

        if (attRes.ok) {
          const attData = await attRes.json();
          const atts = attData.value ?? [];
          entry.attachmentCount = atts.length;

          entry.attachments = atts.map((a: Record<string, unknown>) => ({
            id: a.id,
            name: a.name,
            contentType: a.contentType,
            size: a.size,
            isInline: a.isInline,
            hasContentBytes: !!(a.contentBytes),
            contentBytesLength: typeof a.contentBytes === "string" ? a.contentBytes.length : 0,
            odataType: a["@odata.type"],
          }));

          // Try downloading first PDF
          for (const a of atts) {
            const name = String(a.name ?? "");
            const ctype = String(a.contentType ?? "");
            if (ctype === "application/pdf" || name.toLowerCase().endsWith(".pdf")) {
              entry.pdfFound = name;

              // Get base64 content
              let pdfBase64: string | null = null;
              if (a.contentBytes) {
                entry.pdfSource = "contentBytes inline";
                pdfBase64 = String(a.contentBytes);
                entry.pdfBase64Length = pdfBase64.length;
              }
              if (!pdfBase64) {
                // Try $value download
                entry.pdfSource = "downloading via $value";
                try {
                  const dlUrl = `https://graph.microsoft.com/v1.0/me/messages/${msg.id}/attachments/${a.id}/$value`;
                  const dlRes = await fetch(dlUrl, {
                    headers: { Authorization: `Bearer ${accessToken}` },
                    cache: "no-store",
                  });
                  entry.pdfDownloadStatus = dlRes.status;
                  if (dlRes.ok) {
                    const buf = await dlRes.arrayBuffer();
                    const base64 = Buffer.from(buf).toString("base64");
                    entry.pdfBase64Length = base64.length;
                    entry.pdfDownloaded = true;

                    // Try text extraction
                    try {
                      const { extractTextFromPdf } = await import("@/lib/pdf-extract");
                      const pdfText = await extractTextFromPdf(base64);
                      entry.pdfText = pdfText ? pdfText.slice(0, 500) : "EXTRACTION RETURNED NULL";
                      entry.pdfTextLength = pdfText?.length ?? 0;
                    } catch (pdfErr) {
                      entry.pdfExtractError = pdfErr instanceof Error ? pdfErr.message : String(pdfErr);
                    }
                  } else {
                    const errText = await dlRes.text();
                    entry.pdfDownloadError = errText.slice(0, 200);
                  }
                } catch (dlErr) {
                  entry.pdfDownloadError = dlErr instanceof Error ? dlErr.message : String(dlErr);
                }
              }

              // Extract text from whichever source provided pdfBase64
              if (pdfBase64 && !entry.pdfText) {
                try {
                  const { extractTextFromPdf } = await import("@/lib/pdf-extract");
                  const pdfText = await extractTextFromPdf(pdfBase64);
                  entry.pdfText = pdfText ? pdfText.slice(0, 500) : "EXTRACTION RETURNED NULL";
                  entry.pdfTextLength = pdfText?.length ?? 0;

                  if (pdfText) {
                    const pdfParsed = parseSubject(pdfText);
                    entry.pdfParsedRoute = pdfParsed.origin && pdfParsed.destination
                      ? `${pdfParsed.origin} -> ${pdfParsed.destination}` : "NOT FOUND";
                    entry.pdfParsedDate = pdfParsed.date ?? "NOT FOUND";
                  }
                } catch (pdfErr) {
                  entry.pdfExtractError = pdfErr instanceof Error ? pdfErr.message : String(pdfErr);
                }
              }

              // Try filename route extraction
              const upper = name.toUpperCase();
              const match = upper.match(/([A-Z]{3,4})\s*[-_>\s]\s*([A-Z]{3,4})/);
              if (match) {
                const o = resolveToICAO(match[1]);
                const d = resolveToICAO(match[2]);
                if (o && d) entry.filenameRoute = `${o} -> ${d}`;
              }

              break; // Only process first PDF
            }
          }
        } else {
          const errText = await attRes.text();
          entry.attachmentFetchError = errText.slice(0, 200);
        }
      } catch (err) {
        entry.attachmentError = err instanceof Error ? err.message : String(err);
      }
    }

    emailResults.push(entry);
  }

  result.emails = emailResults;
  return Response.json(result);
}
