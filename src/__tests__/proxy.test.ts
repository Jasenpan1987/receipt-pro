import { NextRequest } from "next/server";
import { proxy } from "src/proxy";
import { SESSION_COOKIE } from "src/server/auth/cookie";
import { createToken } from "src/server/auth/session-token";

const SECRET = vi.hoisted(() => "x".repeat(48));
vi.mock("src/server/config", () => ({ getConfig: () => ({ sessionSecret: SECRET }) }));

const ORIGIN = "https://receipts.example.com";

function passes(response: Response): boolean {
  return response.headers.get("x-middleware-next") === "1";
}

describe("proxy", () => {
  // T-014: browsers fetch these without the login cookie, and a service worker script may not
  // be a redirect.
  it("lets the manifest, the icons, and the service worker through without a login", () => {
    for (const path of [
      "/manifest.webmanifest",
      "/sw.js",
      "/icons/icon-192.png",
      "/icons/apple-touch-icon.png",
      "/login"
    ]) {
      expect(passes(proxy(new NextRequest(`${ORIGIN}${path}`))), path).toBe(true);
    }
  });

  it("sends a page without a login to /login and refuses an API call", () => {
    const page = proxy(new NextRequest(`${ORIGIN}/rules?x=1`));
    expect(page.status).toBe(307);
    expect(new URL(page.headers.get("location") ?? "").pathname).toBe("/login");

    const api = proxy(new NextRequest(`${ORIGIN}/api/receipts`));
    expect(api.status).toBe(401);
  });

  it("does not open other paths through the icons prefix", () => {
    // The URL parser resolves the dots before the proxy sees the path.
    const response = proxy(new NextRequest(`${ORIGIN}/icons/../rules`));
    expect(response.status).toBe(307);
    const encoded = proxy(new NextRequest(`${ORIGIN}/icons/%2e%2e/api/receipts`));
    expect(encoded.status).toBe(401);
  });

  it("lets a logged-in page through", () => {
    const request = new NextRequest(`${ORIGIN}/`);
    request.cookies.set(SESSION_COOKIE, createToken("user-1", Date.now(), SECRET));
    expect(passes(proxy(request))).toBe(true);
  });
});
