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
  // "common" supports both personal Microsoft accounts and org accounts.
  // MS_AUTHORITY_URL only exists so tests can point at a local stand-in.
  return process.env.MS_AUTHORITY_URL ?? "https://login.microsoftonline.com/common";
}

const GRAPH = () => process.env.MS_GRAPH_URL ?? "https://graph.microsoft.com";

// Read only: the app can list and read mail, never send, move or delete it
const SCOPES = "openid profile email offline_access User.Read Mail.Read";

// --- Encryption helpers ---

const ALGORITHM = "aes-256-gcm";

function getKey(): Buffer {
  return Buffer.from(env("COOKIE_SECRET"), "hex");
}

// Encrypted values are base64url (iv + tag + ciphertext), a third larger than the input.
// The older hex format ("iv:tag:data") is still read so existing sessions keep working.
function encrypt(text: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const data = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString("base64url");
}

function decrypt(value: string): string | null {
  try {
    let iv: Buffer, tag: Buffer, data: Buffer;
    if (value.includes(":")) {
      const [ivHex, tagHex, dataHex] = value.split(":");
      [iv, tag, data] = [Buffer.from(ivHex, "hex"), Buffer.from(tagHex, "hex"), Buffer.from(dataHex, "hex")];
    } else {
      const raw = Buffer.from(value, "base64url");
      [iv, tag, data] = [raw.subarray(0, 12), raw.subarray(12, 28), raw.subarray(28)];
    }
    const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

// --- Cookie storage ---
// Microsoft refresh tokens can be long, and browsers silently drop any cookie over about
// 4 KB. The encrypted token is split across numbered cookies (ms_rt_0, ms_rt_1, ...) with
// the count in ms_rt_n, so a long token is never lost.

const TOKEN_COOKIE = "ms_rt";
const CHUNK = 3000;
const MAX_CHUNKS = 6;
const COOKIE_ATTRS = `HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${30 * 24 * 60 * 60}`;

/** Splits a value into numbered cookies. Exported for tests. */
export function splitCookieValue(name: string, value: string): Record<string, string> {
  const parts: Record<string, string> = {};
  const count = Math.ceil(value.length / CHUNK);
  parts[`${name}_n`] = String(count);
  for (let i = 0; i < count; i++) parts[`${name}_${i}`] = value.slice(i * CHUNK, (i + 1) * CHUNK);
  return parts;
}

/** Joins numbered cookies back into one value, or null if any piece is missing. Exported for tests. */
export function joinCookieValue(name: string, get: (n: string) => string | undefined): string | null {
  const count = Number(get(`${name}_n`));
  if (!Number.isInteger(count) || count < 1 || count > MAX_CHUNKS) return null;
  let out = "";
  for (let i = 0; i < count; i++) {
    const part = get(`${name}_${i}`);
    if (!part) return null;
    out += part;
  }
  return out;
}

export async function getStoredRefreshToken(): Promise<string | null> {
  const store = await cookies();
  const joined = joinCookieValue(TOKEN_COOKIE, (n) => store.get(n)?.value);
  if (joined) return decrypt(joined);
  const legacy = store.get(TOKEN_COOKIE)?.value;
  return legacy ? decrypt(legacy) : null;
}

/** Set-Cookie headers that store the refresh token, plus clearing the old single cookie. */
export function buildTokenCookies(refreshToken: string): string[] {
  const parts = splitCookieValue(TOKEN_COOKIE, encrypt(refreshToken));
  if (Object.keys(parts).length - 1 > MAX_CHUNKS) throw new Error("Microsoft returned an unusually long sign-in token");
  const headers = Object.entries(parts).map(([k, v]) => `${k}=${v}; ${COOKIE_ATTRS}`);
  const count = Number(parts[`${TOKEN_COOKIE}_n`]);
  for (let i = count; i < MAX_CHUNKS; i++) headers.push(`${TOKEN_COOKIE}_${i}=; Path=/; Max-Age=0`);
  headers.push(`${TOKEN_COOKIE}=; Path=/; Max-Age=0`);
  return headers;
}

/** Set-Cookie headers that forget the connected inbox in this browser. */
export function clearTokenCookies(): string[] {
  const names = [TOKEN_COOKIE, `${TOKEN_COOKIE}_n`, ...Array.from({ length: MAX_CHUNKS }, (_, i) => `${TOKEN_COOKIE}_${i}`), "ms_acct"];
  return names.map((n) => `${n}=; Path=/; Max-Age=0`);
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
  const res = await fetch(`${GRAPH()}/v1.0/me?$select=displayName,mail,userPrincipalName`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!res.ok) return { name: null, email: null };
  const me = await res.json();
  return { name: me.displayName ?? null, email: me.mail ?? me.userPrincipalName ?? null };
}

export function buildAccountCookie(account: ConnectedAccount): string {
  return `ms_acct=${encrypt(JSON.stringify(account))}; ${COOKIE_ATTRS}`;
}

export async function getStoredAccount(): Promise<ConnectedAccount | null> {
  const raw = (await cookies()).get("ms_acct")?.value;
  if (!raw) return null;
  const json = decrypt(raw.includes("%") ? decodeURIComponent(raw) : raw);
  try {
    return json ? (JSON.parse(json) as ConnectedAccount) : null;
  } catch {
    return null;
  }
}

/** Inbox totals, used to prove the connection can read mail. */
export async function fetchInboxCounts(accessToken: string): Promise<{ total: number; unread: number } | null> {
  const res = await fetch(`${GRAPH()}/v1.0/me/mailFolders/inbox?$select=totalItemCount,unreadItemCount`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const f = await res.json();
  return { total: f.totalItemCount ?? 0, unread: f.unreadItemCount ?? 0 };
}
