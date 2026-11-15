// The cheap path of polling (ADR-004): when the page's copy is current, the server answers
// `{ changed: false }` after reading one item.

/** What the page already has. `sessionId: null` means it saw no session yet. */
export type SessionMark = { sessionId: string | null; version: number };

/** `?since=<version>&sessionId=<id>`; `undefined` when the page knows nothing yet. */
export function parseSince(params: URLSearchParams): SessionMark | undefined {
  const since = params.get("since");
  if (since === null || !/^\d+$/.test(since)) {
    return undefined;
  }
  return { version: Number(since), sessionId: params.get("sessionId") || null };
}

/**
 * Unchanged only when both the session and the version match: a new session (T-010) starts at
 * version 0 and can reach the old number.
 */
export function isUnchanged(current: SessionMark, since: SessionMark | undefined): boolean {
  return (
    since !== undefined &&
    since.sessionId === current.sessionId &&
    since.version === current.version
  );
}
