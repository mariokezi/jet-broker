import { NextRequest } from "next/server";
import { exchangeCodeForTokens, buildTokenCookie } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const error = request.nextUrl.searchParams.get("error");
  const errorDesc = request.nextUrl.searchParams.get("error_description");

  if (error) {
    console.error(`OAuth error: ${error} — ${errorDesc}`);
    return new Response(
      `<html><body style="font-family:system-ui;padding:40px;background:#0f172a;color:white">
        <h2>Authentication failed</h2>
        <p style="color:#f87171">${errorDesc}</p>
        <a href="/" style="color:#60a5fa">Back to dashboard</a>
      </body></html>`,
      { status: 400, headers: { "Content-Type": "text/html" } }
    );
  }

  if (!code) {
    return new Response("Missing authorization code", { status: 400 });
  }

  try {
    const { refreshToken } = await exchangeCodeForTokens(code);
    const cookie = buildTokenCookie(refreshToken);

    console.log(`Refresh token cookie size: ${cookie.length} bytes`);

    const response = new Response(null, {
      status: 302,
      headers: { Location: "/" },
    });

    response.headers.append("Set-Cookie", cookie);
    response.headers.append(
      "Set-Cookie",
      `oauth_state=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`
    );

    return response;
  } catch (err) {
    console.error("Token exchange error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return new Response(
      `<html><body style="font-family:system-ui;padding:40px;background:#0f172a;color:white">
        <h2>Authentication failed</h2>
        <p style="color:#f87171">${message}</p>
        <a href="/" style="color:#60a5fa">Back to dashboard</a>
      </body></html>`,
      { status: 500, headers: { "Content-Type": "text/html" } }
    );
  }
}
