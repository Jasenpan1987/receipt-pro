import { cookies } from "next/headers";
import { SESSION_COOKIE } from "src/server/auth/cookie";
import { verifyToken } from "src/server/auth/session-token";
import { getConfig } from "src/server/config";
import { errorResponse } from "src/server/http";

/** The logged-in user from the signed cookie, or `undefined` (T-012). */
export async function currentUserId(): Promise<string | undefined> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? verifyToken(token, Date.now(), getConfig().sessionSecret)?.userId : undefined;
}

/**
 * For every API route: the user, or the 401 to return. Checked here as well as in the proxy,
 * so a route never depends on the proxy's matcher alone.
 */
export async function requireUser(): Promise<{ userId: string } | { response: Response }> {
  const userId = await currentUserId();
  return userId ? { userId } : { response: errorResponse(401, "请先登录。") };
}
