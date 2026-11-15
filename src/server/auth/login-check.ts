import { verifyPassword } from "src/server/auth/password";

/** The login page is public once deployed: 10 wrong passwords in a row lock it for 15 minutes. */
export const LOCK_AFTER_FAILURES = 10;
export const LOCK_MS = 15 * 60 * 1000;

export type LoginUser = {
  userId: string;
  passwordHash: string;
  failedLogins: number;
  lockedUntil?: number;
};

/**
 * On a wrong password, `failures` is the new count to store, and `lockUntil` the lock to store
 * when this failure reached the limit. An unknown user or a locked account stores nothing.
 */
export type LoginResult =
  | { ok: true; userId: string }
  | { ok: false; message: string; failures?: number; lockUntil?: number };

/** The same message for an unknown user and a wrong password: it does not reveal which. */
const WRONG = "用户名或密码不对。";

export async function checkLogin(
  user: LoginUser | undefined,
  password: string,
  now: number
): Promise<LoginResult> {
  if (!user) {
    return { ok: false, message: WRONG };
  }
  if (user.lockedUntil !== undefined && now < user.lockedUntil) {
    return { ok: false, message: "输错太多次，请 15 分钟后再试。" };
  }
  if (await verifyPassword(password, user.passwordHash)) {
    return { ok: true, userId: user.userId };
  }
  // A lock that has run out starts the count again.
  const failures = (user.lockedUntil !== undefined ? 0 : user.failedLogins) + 1;
  return failures >= LOCK_AFTER_FAILURES
    ? { ok: false, message: WRONG, failures, lockUntil: now + LOCK_MS }
    : { ok: false, message: WRONG, failures };
}
