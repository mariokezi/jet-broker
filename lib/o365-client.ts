import { seedEmails } from "./seed-data";
import type { RawEmail } from "./types";

/**
 * PHASE 2: Replace this with live Microsoft Graph API calls.
 *
 * Required Azure AD setup:
 *   1. Register an app at portal.azure.com → App registrations.
 *   2. Add API permission: Microsoft Graph → Delegated → Mail.Read
 *      (READ-ONLY — do not request Mail.ReadWrite).
 *   3. Grant admin consent.
 *   4. Set redirect URI to your Vercel URL.
 *   5. Store CLIENT_ID, TENANT_ID, CLIENT_SECRET as Vercel env vars.
 *
 * Live implementation outline:
 *   const token = await getAccessToken(); // MSAL flow
 *   const res = await fetch(
 *     'https://graph.microsoft.com/v1.0/me/messages?$filter=receivedDateTime ge ' +
 *     '<since>&$top=100&$select=subject,body,from,receivedDateTime,attachments',
 *     { headers: { Authorization: `Bearer ${token}` } }
 *   );
 */
export async function fetchQuoteEmails(): Promise<RawEmail[]> {
  // DEMO: returns seeded mock emails
  return seedEmails;
}
