import { TOKEN_LIFETIME_MS } from "src/server/auth/session-token";

export const SESSION_COOKIE = "rp_session";

/** HTTP-only, so page scripts cannot read it; Lax, so other sites cannot send it with a POST. */
export function sessionCookie(token: string, secure: boolean) {
  return {
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: TOKEN_LIFETIME_MS / 1000,
    // Off on the home network's plain HTTP, where a Secure cookie would never be sent back.
    secure
  };
}

/** Behind Lambda or a proxy the original scheme arrives in `x-forwarded-proto`. */
export function isHttps(request: Request): boolean {
  return (
    new URL(request.url).protocol === "https:" ||
    request.headers.get("x-forwarded-proto") === "https"
  );
}
