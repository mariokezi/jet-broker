import { NextRequest } from "next/server";
import { exchangeCodeForTokens, encryptTokens } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const error = request.nextUrl.searchParams.get("error");
  const errorDesc = request.nextUrl.searchParams.get("error_description");

  if (error) {
    console.error(`OAuth error: ${error} — ${errorDesc}`);
    return new Response(
      `<html><body><h2>Authentication failed</h2><p>${errorDesc}</p><a href="/">Back to dashboard</a></body></html>`,
      { status: 400, headers: { "Content-Type": "text/html" } }
    );
  }

  if (!code) {
    return new Response("Missing authorization code", { status: 400 });
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    const encrypted = encryptTokens(tokens);

    const response = new Response(null, {
      status: 302,
      headers: { Location: "/" },
    });

    // Set encrypted token cookie (30 days)
    response.headers.append(
      "Set-Cookie",
      `ms_tokens=${encrypted}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${30 * 24 * 60 * 60}`
    );

    // Clear the state cookie
    response.headers.append(
      "Set-Cookie",
      `oauth_state=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`
    );

    return response;
  } catch (err) {
    console.error("Token exchange error:", err);
    return new Response(
      `<html><body><h2>Authentication failed</h2><p>Could not exchange code for token. Check server logs.</p><a href="/">Back to dashboard</a></body></html>`,
      { status: 500, headers: { "Content-Type": "text/html" } }
    );
  }
}
