import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

// Paths that never require a web session. /api/auth is better-auth's own
// endpoints; /api/v1 is the mobile API (each route authorizes via bearer token).
const PUBLIC_PREFIXES = [
  "/login",
  "/api/auth",
  "/api/v1/",
  "/_next",
  "/favicon.ico",
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
];

// Optimistic cookie check only (edge-safe). Real validation happens
// server-side via auth.api.getSession in layouts/actions/routes.
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  if (!getSessionCookie(request)) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico).*)"],
};
