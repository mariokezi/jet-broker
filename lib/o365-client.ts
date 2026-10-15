import "server-only";
import { getValidAccessToken } from "./auth";
import { classifyEmail, htmlToText, mightBeQuote } from "./email-pipeline";
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

// MS_GRAPH_URL only exists so tests can point at a local stand-in
const GRAPH = () => process.env.MS_GRAPH_URL ?? "https://graph.microsoft.com";

/** How far back the inbox is read, and the most messages read per refresh. */
export const LOOKBACK_DAYS = 30;
const MAX_MESSAGES = 300;

async function fetchGraphMessages(accessToken: string): Promise<GraphMessage[]> {
  const allMessages: GraphMessage[] = [];
  const since = new Date(Date.now() - LOOKBACK_DAYS * 86_400_000).toISOString();
  const params = new URLSearchParams({
    $filter: `receivedDateTime ge ${since} and isDraft eq false`,
    $orderby: "receivedDateTime desc",
    $top: "50",
    $select: "id,subject,from,receivedDateTime,body,hasAttachments",
  });
  let nextUrl: string = `${GRAPH()}/v1.0/me/messages?${params}`;

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
    if (link && allMessages.length < MAX_MESSAGES) {
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
      `${GRAPH()}/v1.0/me/messages/${messageId}/attachments/${attachmentId}/$value`,
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
    `${GRAPH()}/v1.0/me/messages/${messageId}/attachments?$select=id,name,contentType,isInline,size`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    }
  );

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    console.error(`[Graph] attachments list failed: ${res.status} — ${errBody.slice(0, 300)}`);
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

export interface InboxScan {
  emails: RawEmail[]; // likely quotes, with attachments downloaded
  scanned: number; // messages read from the inbox
}

/** Runs `fn` over items with at most `limit` running at once. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    })
  );
  return out;
}

/**
 * Reads the last 30 days of mail and keeps only messages that could be operator quotes.
 * Attachments are downloaded for those messages only, a few at a time.
 */
export async function fetchQuoteEmails(selfAddress?: string | null): Promise<InboxScan> {
  let accessToken: string | null = null;
  try {
    accessToken = await getValidAccessToken();
  } catch {
    // Not connected
  }

  if (!accessToken) {
    console.log("[fetchQuoteEmails] No access token — no emails to process");
    return { emails: [], scanned: 0 };
  }
  const token = accessToken;

  try {
    const messages = await fetchGraphMessages(token);
    const candidates = messages.filter((msg) => {
      const email = graphToRawEmail(msg, []);
      const text = email.bodyType === "html" ? htmlToText(email.body) : email.body;
      if (mightBeQuote(email, text, selfAddress)) return true;
      // "Please see the attached quote" emails may only name the trip in a PDF
      return msg.hasAttachments && classifyEmail(email, text, selfAddress) === "candidate" && /\b(attach|pdf|quote|proposal)/i.test(`${email.subject} ${text}`);
    });
    console.log(`[fetchQuoteEmails] Read ${messages.length} emails, ${candidates.length} look like quotes`);

    const emails = await mapLimit(candidates, 4, async (msg) => {
      const attachments = msg.hasAttachments ? await buildEmailAttachments(token, msg.id, await fetchAttachments(token, msg.id)) : [];
      return graphToRawEmail(msg, attachments);
    });
    return { emails, scanned: messages.length };
  } catch (err) {
    console.error("[fetchQuoteEmails] Failed:", err);
    return { emails: [], scanned: 0 };
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
