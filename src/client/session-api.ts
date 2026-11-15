import type { SessionPoll } from "src/shared/api-types";

/** A poll that takes longer than this is dropped; the next one follows. */
const POLL_TIMEOUT_MS = 15_000;

/** Without `since`, the whole session; with it, `{ changed: false }` when nothing changed. */
export async function pollSession(since?: {
  version: number;
  sessionId: string | null;
}): Promise<SessionPoll> {
  const query = since
    ? `?since=${since.version}&sessionId=${encodeURIComponent(since.sessionId ?? "")}`
    : "";
  const response = await fetch(`/api/session${query}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(POLL_TIMEOUT_MS)
  });
  if (response.status === 401) {
    // The login ran out (30 days without use) or was cleared: back to the login page.
    window.location.replace("/login");
  }
  if (!response.ok) {
    throw new Error(`GET /api/session returned ${response.status}`);
  }
  return (await response.json()) as SessionPoll;
}
