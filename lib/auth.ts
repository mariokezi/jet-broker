import "server-only";
import { cookies } from "next/headers";
import crypto from "crypto";

function env(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing env var: ${name}`);
  return val;
}

/**
 * Microsoft sends the user back to the site they signed in from, so the live site and
 * preview links all work as long as each address is registered as a redirect URI.
 */
export function getRedirectUri(origin?: string): string {
  const base = origin ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/api/auth/callback`;
}

/** The public address of the incoming request, honoring the host Vercel forwards. */
export function requestOrigin(request: Request): string {
  const url = new URL(request.url);
  const host = request.headers.get("x-forwarded-host") ?? url.host;
  const proto = request.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  return `${proto}://${host}`;
}

function getAuthority(): string {
  // Use "common" to support both personal Microsoft accounts and org accounts
  return "https://login.microsoftonline.com/common";
}

// Read only: the app can list and read mail, never send, move or delete it
const SCOPES = "openid profile email offline_access User.Read Mail.Read";

// --- Encryption helpers ---

const ALGORITHM = "aes-256-gcm";

function getKey(): Buffer {
  return Buffer.from(env("COOKIE_SECRET"), "hex");
}

function encrypt(text: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  const tag = cipher.getAuthTag().toString("hex");
  return `${iv.toString("hex")}:${tag}:${encrypted}`;
}

function decrypt(data: string): string | null {
  try {
    const [ivHex, tagHex, encrypted] = data.split(":");
    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      getKey(),
      Buffer.from(ivHex, "hex")
    );
    decipher.setAuthTag(Buffer.from(tagHex, "hex"));
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch {
    return null;
  }
}

// --- Cookie storage (refresh token only — keeps cookie small) ---

export async function getStoredRefreshToken(): Promise<string | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get("ms_rt")?.value;
  if (!raw) return null;
  return decrypt(raw);
}

export function encryptRefreshToken(refreshToken: string): string {
  return encrypt(refreshToken);
}

export function buildTokenCookie(refreshToken: string): string {
  const encrypted = encryptRefreshToken(refreshToken);
  return `ms_rt=${encrypted}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${30 * 24 * 60 * 60}`;
}

// --- OAuth URLs ---

export function getAuthUrl(state: string, redirectUri: string, loginHint?: string | null): string {
  const params = new URLSearchParams({
    client_id: env("CLIENT_ID"),
    response_type: "code",
    redirect_uri: redirectUri,
    scope: SCOPES,
    response_mode: "query",
    state,
    // Always show the account picker so any Outlook account can be connected
    prompt: "select_account",
  });
  if (loginHint) params.set("login_hint", loginHint);
  return `${getAuthority()}/oauth2/v2.0/authorize?${params}`;
}

export async function exchangeCodeForTokens(code: string, redirectUri: string): Promise<{ accessToken: string; refreshToken: string }> {
  const res = await fetch(`${getAuthority()}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env("CLIENT_ID"),
      client_secret: env("CLIENT_SECRET"),
      code,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
      scope: SCOPES,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Token exchange failed: ${res.status} ${body}`);
  }

  const data = await res.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
  };
}

export async function refreshForAccessToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
  const res = await fetch(`${getAuthority()}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env("CLIENT_ID"),
      client_secret: env("CLIENT_SECRET"),
      refresh_token: refreshToken,
      grant_type: "refresh_token",
      scope: SCOPES,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Token refresh failed: ${res.status} ${body}`);
  }

  const data = await res.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? refreshToken,
  };
}

export async function getValidAccessToken(): Promise<string | null> {
  const refreshToken = await getStoredRefreshToken();
  if (!refreshToken) return null;

  try {
    const result = await refreshForAccessToken(refreshToken);
    return result.accessToken;
  } catch {
    return null;
  }
}

/** Settings still needed before anyone can connect Outlook. */
export function missingSettings(): string[] {
  const missing = ["CLIENT_ID", "CLIENT_SECRET", "COOKIE_SECRET"].filter((k) => !process.env[k]);
  const secret = process.env.COOKIE_SECRET;
  if (secret && !/^[0-9a-fA-F]{64}$/.test(secret)) missing.push("COOKIE_SECRET (must be 64 hex characters)");
  return missing;
}

export function isConfigured(): boolean {
  return missingSettings().length === 0;
}

// --- Connected account (name and address only, shown on the connect page) ---

export interface ConnectedAccount {
  name: string | null;
  email: string | null;
}

export async function fetchAccount(accessToken: string): Promise<ConnectedAccount> {
  const res = await fetch("https://graph.microsoft.com/v1.0/me?$select=displayName,mail,userPrincipalName", {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!res.ok) return { name: null, email: null };
  const me = await res.json();
  return { name: me.displayName ?? null, email: me.mail ?? me.userPrincipalName ?? null };
}

export function buildAccountCookie(account: ConnectedAccount): string {
  return `ms_acct=${encodeURIComponent(encrypt(JSON.stringify(account)))}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${30 * 24 * 60 * 60}`;
}

export async function getStoredAccount(): Promise<ConnectedAccount | null> {
  const raw = (await cookies()).get("ms_acct")?.value;
  if (!raw) return null;
  const json = decrypt(decodeURIComponent(raw));
  try {
    return json ? (JSON.parse(json) as ConnectedAccount) : null;
  } catch {
    return null;
  }
}

/** Inbox totals, used to prove the connection can read mail. */
export async function fetchInboxCounts(accessToken: string): Promise<{ total: number; unread: number } | null> {
  const res = await fetch("https://graph.microsoft.com/v1.0/me/mailFolders/inbox?$select=totalItemCount,unreadItemCount", {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const f = await res.json();
  return { total: f.totalItemCount ?? 0, unread: f.unreadItemCount ?? 0 };
}
