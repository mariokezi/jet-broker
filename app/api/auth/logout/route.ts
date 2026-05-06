export async function GET() {
  const response = new Response(null, {
    status: 302,
    headers: { Location: "/" },
  });

  response.headers.append(
    "Set-Cookie",
    `ms_rt=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`
  );

  return response;
}
