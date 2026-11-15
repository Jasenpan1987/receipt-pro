// The login cookie's value: who is logged in and since when, signed so it cannot be forged.
// Stateless: no session table to read on every 3-second poll.

import { createHmac, timingSafeEqual } from "node:crypto";

export type TokenClaims = { userId: string; issuedAt: number };

const DAY_MS = 24 * 60 * 60 * 1000;
/** business.md#login: a device stays logged in for 30 days, renewed on use. */
export const TOKEN_LIFETIME_MS = 30 * DAY_MS;
/** Re-issued once a day at most, so polling does not set a new cookie every request. */
const RENEW_AFTER_MS = DAY_MS;
/** Clocks drift; a token from slightly in the future is still accepted. */
const CLOCK_SKEW_MS = 5 * 60 * 1000;

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

/** `base64url(userId.issuedAt).base64url(HMAC-SHA256)`. */
export function createToken(userId: string, now: number, secret: string): string {
  const payload = Buffer.from(`${userId}.${now}`).toString("base64url");
  return `${payload}.${sign(payload, secret)}`;
}

/** The claims, or `undefined` for a forged, expired, or malformed token. */
export function verifyToken(token: string, now: number, secret: string): TokenClaims | undefined {
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra !== undefined) {
    return undefined;
  }
  const expected = Buffer.from(sign(payload, secret));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
    return undefined;
  }
  const decoded = Buffer.from(payload, "base64url").toString("utf8");
  const dot = decoded.lastIndexOf(".");
  const userId = decoded.slice(0, dot);
  const issuedAt = Number(decoded.slice(dot + 1));
  if (dot <= 0 || !Number.isSafeInteger(issuedAt)) {
    return undefined;
  }
  if (issuedAt > now + CLOCK_SKEW_MS || now - issuedAt >= TOKEN_LIFETIME_MS) {
    return undefined;
  }
  return { userId, issuedAt };
}

export function needsRenewal(claims: TokenClaims, now: number): boolean {
  return now - claims.issuedAt >= RENEW_AFTER_MS;
}
