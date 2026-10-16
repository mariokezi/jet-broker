import { NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip auth for the login page, API auth routes, and static assets
  if (
    pathname === "/login" ||
    pathname === "/operator/login" ||
    pathname.startsWith("/api/operator/") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/login") ||
    pathname.startsWith("/api/debug") ||
    pathname.startsWith("/api/diagnose") ||
    pathname.startsWith("/api/test-pipeline") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.endsWith(".svg") ||
    pathname.endsWith(".png") ||
    pathname.endsWith(".ico")
  ) {
    return NextResponse.next();
  }

  // Operator portal: operators sign in with their own account, separate from the broker workspace
  if (pathname === "/operator" || pathname.startsWith("/operator/")) {
    const operator = request.cookies.get("op_auth")?.value;
    if (operator && /^[a-z0-9-]{2,40}$/.test(operator)) return NextResponse.next();
    const url = new URL("/operator/login", request.url);
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  const authCookie = request.cookies.get("site_auth")?.value;
  if (authCookie === "authenticated") {
    return NextResponse.next();
  }

  // Redirect to login
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("from", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
