import { NextRequest } from "next/server";
import { exchangeCodeForTokens, encryptTokens } from "@/lib/auth";

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
    return new Response(
      `<html><body style="font-family:system-ui;padding:40px;background:#0f172a;color:white">
        <h2>Missing authorization code</h2>
        <a href="/" style="color:#60a5fa">Back to dashboard</a>
      </body></html>`,
      { status: 400, headers: { "Content-Type": "text/html" } }
    );
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    const encrypted = encryptTokens(tokens);

    // Check cookie size — browsers reject cookies over ~4KB
    const cookieValue = `ms_tokens=${encrypted}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${30 * 24 * 60 * 60}`;
    console.log(`Token cookie size: ${cookieValue.length} bytes`);

    if (cookieValue.length > 4000) {
      console.warn("Token cookie exceeds 4KB, may be rejected by browser");
    }

    const response = new Response(null, {
      status: 302,
      headers: { Location: "/" },
    });

    response.headers.append("Set-Cookie", cookieValue);
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
