import { cookies } from "next/headers";
import { SESSION_COOKIE } from "src/server/auth/cookie";

/** Logs this device out. Other devices stay logged in until their cookie runs out. */
export async function POST(): Promise<Response> {
  (await cookies()).delete(SESSION_COOKIE);
  return Response.json({ loggedOut: true });
}
