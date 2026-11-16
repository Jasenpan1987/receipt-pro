import { type NextRequest, NextResponse } from "next/server";
import { isHttps, SESSION_COOKIE, sessionCookie } from "src/server/auth/cookie";
import { createToken, needsRenewal, verifyToken } from "src/server/auth/session-token";
import { getConfig } from "src/server/config";

/**
 * Reachable without logging in. Browsers fetch the manifest, the home-screen icons, and the
 * service worker without the login cookie, or refuse a redirect for them (T-014).
 */
const PUBLIC_PATHS = new Set([
  "/login",
  "/api/auth/login",
  "/api/auth/logout",
  "/manifest.webmanifest",
  "/sw.js"
]);
const PUBLIC_PREFIXES = ["/icons/"];

function isPublic(path: string): boolean {
  return PUBLIC_PATHS.has(path) || PUBLIC_PREFIXES.some(prefix => path.startsWith(prefix));
}

/**
 * Every page and API call needs the login cookie (T-012): pages go to /login, API calls get 401.
 * A valid cookie a day or more old is re-issued, so a used device stays logged in (30 days from
 * last use). Each API route checks the user again itself (src/server/identity.ts).
 */
export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (isPublic(path)) {
    return NextResponse.next();
  }
  const now = Date.now();
  const secret = getConfig().sessionSecret;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const claims = token ? verifyToken(token, now, secret) : undefined;
  if (!claims) {
    if (path.startsWith("/api/")) {
      return NextResponse.json({ error: "请先登录。" }, { status: 401 });
    }
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.search = "";
    return NextResponse.redirect(login);
  }
  const response = NextResponse.next();
  if (needsRenewal(claims, now)) {
    response.cookies.set(sessionCookie(createToken(claims.userId, now, secret), isHttps(request)));
  }
  return response;
}

export const config = {
  // Static files and images load without a check, so the login page can show.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
