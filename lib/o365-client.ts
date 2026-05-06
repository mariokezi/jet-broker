import "server-only";
import { getValidAccessToken } from "./auth";
import type { RawEmail } from "./types";

interface GraphMessage {
  id: string;
  subject: string;
  from: { emailAddress: { name: string; address: string } };
  receivedDateTime: string;
  body: { contentType: string; content: string };
  hasAttachments: boolean;
}

interface GraphAttachment {
  id: string;
  name: string;
  contentType: string;
  contentBytes?: string;
  isInline: boolean;
}

async function fetchGraphMessages(accessToken: string): Promise<GraphMessage[]> {
  const allMessages: GraphMessage[] = [];
  let nextUrl: string =
    "https://graph.microsoft.com/v1.0/me/messages?" +
    "$top=100&$orderby=receivedDateTime desc" +
    "&$select=id,subject,from,receivedDateTime,body,hasAttachments";

  let hasMore = true;
  while (hasMore) {
    const res: Response = await fetch(nextUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error(`Graph API error ${res.status}: ${errBody}`);
      throw new Error(`Graph API error: ${res.status}`);
    }

    const data = await res.json();
    allMessages.push(...(data.value ?? []));

    const link: string | undefined = data["@odata.nextLink"];
    if (link && allMessages.length < 500) {
      nextUrl = link;
    } else {
      hasMore = false;
    }
  }

  return allMessages;
}

async function fetchAttachments(accessToken: string, messageId: string): Promise<GraphAttachment[]> {
  const res = await fetch(
    `https://graph.microsoft.com/v1.0/me/messages/${messageId}/attachments?$select=id,name,contentType,contentBytes,isInline`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    }
  );

  if (!res.ok) return [];
  const data = await res.json();
  return data.value ?? [];
}

function graphToRawEmail(msg: GraphMessage, attachments: GraphAttachment[]): RawEmail {
  const bodyType = msg.body.contentType === "html" ? "html" : "text";

  return {
    id: msg.id,
    subject: msg.subject ?? "(no subject)",
    from: msg.from?.emailAddress?.address ?? "",
    fromName: msg.from?.emailAddress?.name ?? "",
    receivedAt: msg.receivedDateTime,
    bodyType,
    body: msg.body.content ?? "",
    attachments: attachments
      .filter((a) => !a.isInline && a.contentBytes)
      .map((a) => ({
        filename: a.name,
        contentType: a.contentType,
        url: `data:${a.contentType};base64,${a.contentBytes}`,
      })),
  };
}

export async function fetchQuoteEmails(): Promise<RawEmail[]> {
  let accessToken: string | null = null;
  try {
    accessToken = await getValidAccessToken();
  } catch {
    // Not connected
  }

  if (!accessToken) {
    console.log("[fetchQuoteEmails] No access token — returning empty list");
    return [];
  }

  try {
    const messages = await fetchGraphMessages(accessToken);
    console.log(`[fetchQuoteEmails] Fetched ${messages.length} emails from Graph API`);

    const rawEmails: RawEmail[] = [];
    for (const msg of messages) {
      let attachments: GraphAttachment[] = [];
      if (msg.hasAttachments) {
        attachments = await fetchAttachments(accessToken, msg.id);
      }
      rawEmails.push(graphToRawEmail(msg, attachments));
    }

    return rawEmails;
  } catch (err) {
    console.error("Failed to fetch from Graph:", err);
    return [];
  }
}

export async function isLiveConnected(): Promise<boolean> {
  try {
    const token = await getValidAccessToken();
    return token !== null;
  } catch {
    return false;
  }
}
