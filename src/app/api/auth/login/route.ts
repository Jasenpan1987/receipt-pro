import { cookies } from "next/headers";
import { isHttps, sessionCookie } from "src/server/auth/cookie";
import { checkLogin } from "src/server/auth/login-check";
import { createToken } from "src/server/auth/session-token";
import { getConfig } from "src/server/config";
import { errorResponse } from "src/server/http";
import { getStore } from "src/server/repo/store";
import { clearLoginFailures, getLoginUser, recordLoginFailure } from "src/server/repo/users";

/** Slows down guessing a little more, on top of the lock after 10 failures. */
const FAILURE_DELAY_MS = 500;

export async function POST(request: Request): Promise<Response> {
  const body = (await request.json().catch(() => undefined)) as
    | { username?: unknown; password?: unknown }
    | undefined;
  const username = typeof body?.username === "string" ? body.username.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!username || !password || username.length > 100 || password.length > 200) {
    return errorResponse(400, "请填写用户名和密码。");
  }
  try {
    const store = getStore();
    const user = await getLoginUser(store, username);
    const now = Date.now();
    const result = await checkLogin(user, password, now);
    if (!result.ok) {
      if (user && result.failures !== undefined) {
        await recordLoginFailure(store, user.userId, result.failures, result.lockUntil);
      }
      await new Promise(resolve => setTimeout(resolve, FAILURE_DELAY_MS));
      return errorResponse(401, result.message);
    }
    if (user && (user.failedLogins > 0 || user.lockedUntil !== undefined)) {
      await clearLoginFailures(store, user.userId);
    }
    (await cookies()).set(
      sessionCookie(createToken(result.userId, now, getConfig().sessionSecret), isHttps(request))
    );
    return Response.json({ loggedIn: true });
  } catch (error) {
    console.error("[receipt-pro] POST /api/auth/login failed:", error);
    return errorResponse(500, "登录出错，请重试。");
  }
}
