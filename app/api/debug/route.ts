export async function GET() {
  return Response.json({
    hasClientId: !!process.env.CLIENT_ID,
    hasTenantId: !!process.env.TENANT_ID,
    hasClientSecret: !!process.env.CLIENT_SECRET,
    hasCookieSecret: !!process.env.COOKIE_SECRET,
    hasAppUrl: !!process.env.NEXT_PUBLIC_APP_URL,
    appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "not set",
  });
}
