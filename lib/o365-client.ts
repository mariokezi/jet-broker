import "server-only";
import { getValidAccessToken } from "./auth";
import type { RawEmail, EmailAttachment } from "./types";

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
  size?: number;
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
      console.error(`[Graph] messages error ${res.status}: ${errBody}`);
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

async function fetchAttachmentContent(
  accessToken: string,
  messageId: string,
  attachmentId: string
): Promise<string | null> {
  try {
    const res = await fetch(
      `https://graph.microsoft.com/v1.0/me/messages/${messageId}/attachments/${attachmentId}/$value`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      }
    );
    if (!res.ok) {
      console.error(`[Graph] attachment content download failed: ${res.status}`);
      return null;
    }
    const buffer = await res.arrayBuffer();
    return Buffer.from(buffer).toString("base64");
  } catch (err) {
    console.error(`[Graph] attachment content download error:`, err);
    return null;
  }
}

async function fetchAttachments(
  accessToken: string,
  messageId: string
): Promise<GraphAttachment[]> {
  const res = await fetch(
    `https://graph.microsoft.com/v1.0/me/messages/${messageId}/attachments?$select=id,name,contentType,contentBytes,isInline,size`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    }
  );

  if (!res.ok) {
    console.error(`[Graph] attachments list failed: ${res.status}`);
    return [];
  }
  const data = await res.json();
  return data.value ?? [];
}

async function buildEmailAttachments(
  accessToken: string,
  messageId: string,
  graphAttachments: GraphAttachment[]
): Promise<EmailAttachment[]> {
  const result: EmailAttachment[] = [];

  for (const att of graphAttachments) {
    if (att.isInline) continue;

    let base64Content = att.contentBytes ?? null;

    // If contentBytes is missing, download via $value endpoint
    if (!base64Content) {
      console.log(`[Graph] contentBytes missing for "${att.name}", downloading via $value...`);
      base64Content = await fetchAttachmentContent(accessToken, messageId, att.id);
    }

    if (!base64Content) {
      console.warn(`[Graph] Could not get content for attachment "${att.name}" — skipping`);
      continue;
    }

    console.log(`[Graph] Got attachment "${att.name}" (${att.contentType}, ${base64Content.length} base64 chars)`);

    result.push({
      filename: att.name,
      contentType: att.contentType,
      url: `data:${att.contentType};base64,${base64Content}`,
    });
  }

  return result;
}

function graphToRawEmail(
  msg: GraphMessage,
  attachments: EmailAttachment[]
): RawEmail {
  const bodyType = msg.body.contentType === "html" ? "html" : "text";

  return {
    id: msg.id,
    subject: msg.subject ?? "(no subject)",
    from: msg.from?.emailAddress?.address ?? "",
    fromName: msg.from?.emailAddress?.name ?? "",
    receivedAt: msg.receivedDateTime,
    bodyType,
    body: msg.body.content ?? "",
    attachments,
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
    console.log("[fetchQuoteEmails] No access token — using seed data");
    const { loadSeedEmails } = await import("./seed-data");
    return loadSeedEmails();
  }

  try {
    const messages = await fetchGraphMessages(accessToken);
    console.log(`[fetchQuoteEmails] Fetched ${messages.length} emails`);

    const rawEmails: RawEmail[] = [];
    for (const msg of messages) {
      let emailAttachments: EmailAttachment[] = [];
      if (msg.hasAttachments) {
        const graphAtts = await fetchAttachments(accessToken, msg.id);
        console.log(`[fetchQuoteEmails] "${msg.subject}" has ${graphAtts.length} attachment(s)`);
        emailAttachments = await buildEmailAttachments(accessToken, msg.id, graphAtts);
      }
      rawEmails.push(graphToRawEmail(msg, emailAttachments));
    }

    return rawEmails;
  } catch (err) {
    console.error("[fetchQuoteEmails] Failed:", err);
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
