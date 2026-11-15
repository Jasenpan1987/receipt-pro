import { randomBytes, scrypt, type ScryptOptions, timingSafeEqual } from "node:crypto";

// scrypt with the parameters stored next to the hash, so they can be raised later without
// breaking old hashes. Format: scrypt$N$r$p$salt$hash (salt and hash base64url).
const N = 16384;
const R = 8;
const P = 1;
const KEY_LENGTH = 32;

function derive(password: string, salt: Buffer, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(password.normalize("NFC"), salt, KEY_LENGTH, options, (error, key) =>
      error ? reject(error) : resolve(key)
    )
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, { N, r: R, p: P });
  return ["scrypt", N, R, P, salt.toString("base64url"), key.toString("base64url")].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, n, r, p, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) {
    return false;
  }
  const expected = Buffer.from(hash, "base64url");
  const key = await derive(password, Buffer.from(salt, "base64url"), {
    N: Number(n),
    r: Number(r),
    p: Number(p)
  }).catch(() => undefined);
  return key !== undefined && key.length === expected.length && timingSafeEqual(key, expected);
}
