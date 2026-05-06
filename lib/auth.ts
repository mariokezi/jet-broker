import "server-only";
import { cookies } from "next/headers";
import crypto from "crypto";

function env(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing env var: ${name}`);
  return val;
}

function getRedirectUri(): string {
  return process.env.NEXT_PUBLIC_APP_URL
    ? `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback`
    : "http://localhost:3000/api/auth/callback";
}

function getAuthority(): string {
  return `https://login.microsoftonline.com/${env("TENANT_ID")}`;
}

const SCOPES = "openid profile Mail.Read offline_access";

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

export function getAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: env("CLIENT_ID"),
    response_type: "code",
    redirect_uri: getRedirectUri(),
    scope: SCOPES,
    response_mode: "query",
    state,
  });
  return `${getAuthority()}/oauth2/v2.0/authorize?${params}`;
}

export async function exchangeCodeForTokens(code: string): Promise<{ accessToken: string; refreshToken: string }> {
  const res = await fetch(`${getAuthority()}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env("CLIENT_ID"),
      client_secret: env("CLIENT_SECRET"),
      code,
      redirect_uri: getRedirectUri(),
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

export function isConfigured(): boolean {
  return !!(process.env.CLIENT_ID && process.env.TENANT_ID && process.env.CLIENT_SECRET && process.env.COOKIE_SECRET);
}
