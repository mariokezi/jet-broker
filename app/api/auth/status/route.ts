import { getStoredTokens } from "@/lib/auth";

export async function GET() {
  const tokens = await getStoredTokens();
  return Response.json({
    connected: tokens !== null,
    expiresAt: tokens?.expiresAt ?? null,
  });
}
