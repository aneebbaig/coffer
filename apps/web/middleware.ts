import { NextRequest, NextResponse } from "next/server";
import {
  verifyAccessToken,
  verifyRefreshToken,
  signAccessToken,
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  cookieOptions,
} from "@/lib/tokens";

// Paths that never require auth
const PUBLIC_PREFIXES = ["/login", "/api/auth/login", "/api/auth/logout", "/api/v1/", "/_next", "/favicon.ico", "/manifest.webmanifest", "/icon-192.png", "/icon-512.png", "/apple-touch-icon.png"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const accessToken = request.cookies.get(ACCESS_COOKIE)?.value;
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;

  // Happy path: valid access token
  if (accessToken && (await verifyAccessToken(accessToken))) {
    return NextResponse.next();
  }

  // Access token missing or expired - try to silently refresh
  if (refreshToken) {
    const payload = await verifyRefreshToken(refreshToken);
    if (payload) {
      const userPayload = { id: payload.id, email: payload.email, name: payload.name, role: payload.role };
      const newAccessToken = await signAccessToken(userPayload);
      const isSecure = request.nextUrl.protocol === "https:";

      // Rewrite the cookie header so server components in this same request
      // see the new access token without waiting for a round-trip to the browser.
      const updatedCookies = request.cookies
        .getAll()
        .filter((c) => c.name !== ACCESS_COOKIE)
        .map((c) => `${c.name}=${c.value}`)
        .concat(`${ACCESS_COOKIE}=${newAccessToken}`)
        .join("; ");

      const requestHeaders = new Headers(request.headers);
      requestHeaders.set("cookie", updatedCookies);

      const response = NextResponse.next({ request: { headers: requestHeaders } });
      // Also set on the response so the browser stores the new token
      response.cookies.set(ACCESS_COOKIE, newAccessToken, cookieOptions(isSecure, 15 * 60));
      return response;
    }
  }

  // No valid tokens at all - send to login (API routes get 401)
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico).*)"],
};
