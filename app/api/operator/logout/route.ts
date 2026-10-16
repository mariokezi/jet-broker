import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  return new Response(null, {
    status: 303,
    headers: {
      Location: new URL("/operator/login", request.url).toString(),
      "Set-Cookie": "op_auth=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0",
    },
  });
}
