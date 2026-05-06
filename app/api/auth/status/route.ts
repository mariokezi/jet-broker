import { getStoredRefreshToken } from "@/lib/auth";

export async function GET() {
  const rt = await getStoredRefreshToken();
  return Response.json({ connected: rt !== null });
}
