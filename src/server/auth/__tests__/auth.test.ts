import { checkLogin, LOCK_AFTER_FAILURES, LOCK_MS } from "src/server/auth/login-check";
import { hashPassword, verifyPassword } from "src/server/auth/password";
import { createToken, needsRenewal, verifyToken } from "src/server/auth/session-token";

const SECRET = "x".repeat(48);
const NOW = Date.parse("2026-11-15T12:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;

describe("session token", () => {
  it("round-trips the user ID", () => {
    expect(verifyToken(createToken("user-1", NOW, SECRET), NOW + 1000, SECRET)).toEqual({
      userId: "user-1",
      issuedAt: NOW
    });
  });

  // business.md#login: a device stays logged in for 30 days, renewed on use.
  it("expires after 30 days", () => {
    const token = createToken("user-1", NOW, SECRET);
    expect(verifyToken(token, NOW + 30 * DAY - 1, SECRET)).toBeDefined();
    expect(verifyToken(token, NOW + 30 * DAY, SECRET)).toBeUndefined();
  });

  it("is renewed once it is a day old", () => {
    expect(needsRenewal({ userId: "u", issuedAt: NOW }, NOW + DAY - 1)).toBe(false);
    expect(needsRenewal({ userId: "u", issuedAt: NOW }, NOW + DAY)).toBe(true);
  });

  it("refuses a tampered token, another secret, or garbage", () => {
    const token = createToken("user-1", NOW, SECRET);
    const [payload, signature] = token.split(".");
    const forged = `${Buffer.from(`user-2.${NOW}`).toString("base64url")}.${signature}`;
    for (const bad of [forged, `${payload}.AAAA`, "", "abc", `${payload}`]) {
      expect(verifyToken(bad, NOW, SECRET)).toBeUndefined();
    }
    expect(verifyToken(token, NOW, "y".repeat(48))).toBeUndefined();
  });

  it("refuses a token issued in the future", () => {
    expect(
      verifyToken(createToken("user-1", NOW + 10 * 60 * 1000, SECRET), NOW, SECRET)
    ).toBeUndefined();
  });
});

describe("password", () => {
  it("verifies the right password and refuses a wrong one", async () => {
    const stored = await hashPassword("correct horse");
    expect(stored).not.toContain("correct horse");
    await expect(verifyPassword("correct horse", stored)).resolves.toBe(true);
    await expect(verifyPassword("Correct horse", stored)).resolves.toBe(false);
  });

  it("salts every hash", async () => {
    expect(await hashPassword("same")).not.toBe(await hashPassword("same"));
  });

  it("refuses a malformed stored hash", async () => {
    await expect(verifyPassword("x", "not-a-hash")).resolves.toBe(false);
  });
});

describe("checkLogin", () => {
  const user = async (extra = {}) => ({
    userId: "user-1",
    passwordHash: await hashPassword("pw"),
    failedLogins: 0,
    ...extra
  });

  it("lets the right password in and resets the failure count", async () => {
    await expect(checkLogin(await user({ failedLogins: 3 }), "pw", NOW)).resolves.toEqual({
      ok: true,
      userId: "user-1"
    });
  });

  it("refuses a wrong password and an unknown user with the same plain message", async () => {
    const wrong = await checkLogin(await user(), "nope", NOW);
    const unknown = await checkLogin(undefined, "pw", NOW);
    expect(wrong).toMatchObject({ ok: false, message: "用户名或密码不对。" });
    expect(unknown).toMatchObject({ ok: false, message: "用户名或密码不对。" });
  });

  it("locks after 10 failures in a row, even for the right password, for 15 minutes", async () => {
    const failing = await checkLogin(
      await user({ failedLogins: LOCK_AFTER_FAILURES - 1 }),
      "nope",
      NOW
    );
    expect(failing).toMatchObject({ ok: false, lockUntil: NOW + LOCK_MS });
    const locked = await user({ failedLogins: LOCK_AFTER_FAILURES, lockedUntil: NOW + LOCK_MS });
    await expect(checkLogin(locked, "pw", NOW + 1000)).resolves.toMatchObject({
      ok: false,
      message: "输错太多次，请 15 分钟后再试。"
    });
    await expect(checkLogin(locked, "pw", NOW + LOCK_MS)).resolves.toMatchObject({ ok: true });
  });
});
