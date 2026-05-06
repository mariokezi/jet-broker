import { NextRequest } from "next/server";

const SITE_PASSWORD = process.env.SITE_PASSWORD || "cake777";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { password } = body;

  if (password === SITE_PASSWORD) {
    const response = Response.json({ success: true });
    response.headers.append(
      "Set-Cookie",
      `site_auth=authenticated; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${30 * 24 * 60 * 60}`
    );
    return response;
  }

  return Response.json({ success: false, error: "Wrong password" }, { status: 401 });
}
