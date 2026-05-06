import "server-only";
import { cookies } from "next/headers";
import crypto from "crypto";

const CLIENT_ID = process.env.CLIENT_ID!;
const TENANT_ID = process.env.TENANT_ID!;
const CLIENT_SECRET = process.env.CLIENT_SECRET!;
const COOKIE_SECRET = process.env.COOKIE_SECRET!;

const REDIRECT_URI =
  process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}/api/auth/callback`
    : "http://localhost:3000/api/auth/callback";

const AUTHORITY = `https://login.microsoftonline.com/${TENANT_ID}`;
const SCOPES = "openid profile Mail.Read offline_access";

// --- Encryption helpers for cookie storage ---

const ALGORITHM = "aes-256-gcm";

function getKey(): Buffer {
  return Buffer.from(COOKIE_SECRET, "hex");
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

// --- Token types ---

export interface TokenData {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // unix ms
}

// --- Cookie-based token storage ---

export async function getStoredTokens(): Promise<TokenData | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get("ms_tokens")?.value;
  if (!raw) return null;
  const decrypted = decrypt(raw);
  if (!decrypted) return null;
  try {
    return JSON.parse(decrypted) as TokenData;
  } catch {
    return null;
  }
}

export function encryptTokens(tokens: TokenData): string {
  return encrypt(JSON.stringify(tokens));
}

// --- OAuth URLs ---

export function getAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: "code",
    redirect_uri: REDIRECT_URI,
    scope: SCOPES,
    response_mode: "query",
    state,
  });
  return `${AUTHORITY}/oauth2/v2.0/authorize?${params}`;
}

export async function exchangeCodeForTokens(code: string): Promise<TokenData> {
  const res = await fetch(`${AUTHORITY}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code,
      redirect_uri: REDIRECT_URI,
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
    expiresAt: Date.now() + data.expires_in * 1000,
  };
}

export async function refreshAccessToken(refreshToken: string): Promise<TokenData> {
  const res = await fetch(`${AUTHORITY}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
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
    expiresAt: Date.now() + data.expires_in * 1000,
  };
}

export async function getValidAccessToken(): Promise<string | null> {
  const tokens = await getStoredTokens();
  if (!tokens) return null;

  // If token still valid (with 2 min buffer), return it
  if (tokens.expiresAt > Date.now() + 120_000) {
    return tokens.accessToken;
  }

  // Try refresh
  try {
    const refreshed = await refreshAccessToken(tokens.refreshToken);
    // We can't set cookies from a utility function in server components,
    // so we return the new access token and the caller should update the cookie
    // For simplicity, we'll just return the refreshed token
    return refreshed.accessToken;
  } catch {
    return null;
  }
}

export function isConfigured(): boolean {
  return !!(CLIENT_ID && TENANT_ID && CLIENT_SECRET && COOKIE_SECRET);
}
