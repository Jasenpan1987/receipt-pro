import { useCallback, useEffect, useRef, useState } from "react";
import { pollSession } from "src/client/session-api";
import { needsFullFetch, POLL_INTERVAL_MS } from "src/client/sync-policy";
import type { SessionView } from "src/shared/api-types";

export type SyncState = "loading" | "ready" | "failed";

/**
 * The current session, kept in step with every other device by polling (ADR-004): every
 * 3 seconds while the page is visible, at once when it becomes visible again, never while it is
 * hidden. One poll at a time, so an older reply never overwrites a newer one. A dropped poll is
 * simply followed by the next, which is what keeps a tab working for hours.
 */
export function useSessionPoll(): {
  session: SessionView | undefined;
  state: SyncState;
  /** Polls now. `true` asks for the whole session, renewing photo URLs. */
  refresh: (full?: boolean) => void;
} {
  const [session, setSession] = useState<SessionView>();
  const [state, setState] = useState<SyncState>("loading");
  const known = useRef<SessionView | undefined>(undefined);
  const lastFullAt = useRef(0);
  const running = useRef(false);
  const queued = useRef<{ full: boolean } | undefined>(undefined);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const alive = useRef(true);

  const poll = useCallback(async (forced: boolean): Promise<void> => {
    if (running.current) {
      queued.current = { full: forced || (queued.current?.full ?? false) };
      return;
    }
    running.current = true;
    clearTimeout(timer.current);
    try {
      const current = known.current;
      const now = Date.now();
      const full = needsFullFetch({
        known: current !== undefined,
        hasProcessing: current?.receipts.some(receipt => receipt.status === "processing") ?? false,
        lastFullAt: lastFullAt.current,
        now,
        forced
      });
      const reply = await pollSession(
        full || !current ? undefined : { version: current.version, sessionId: current.sessionId }
      );
      if (reply.changed) {
        const { changed: _changed, ...view } = reply;
        known.current = view;
        // Every changed reply is the whole session with fresh photo URLs.
        lastFullAt.current = now;
        if (alive.current) {
          setSession(view);
          setState("ready");
        }
      }
    } catch {
      if (alive.current) {
        setState(previous => (previous === "ready" ? previous : "failed"));
      }
    } finally {
      running.current = false;
      const next = queued.current;
      queued.current = undefined;
      if (next) {
        void poll(next.full);
      } else if (alive.current && document.visibilityState === "visible") {
        timer.current = setTimeout(() => void poll(false), POLL_INTERVAL_MS);
      }
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    void poll(false);
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void poll(false);
      } else {
        clearTimeout(timer.current);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      alive.current = false;
      document.removeEventListener("visibilitychange", onVisibility);
      clearTimeout(timer.current);
    };
  }, [poll]);

  const refresh = useCallback((full = false) => void poll(full), [poll]);
  return { session, state, refresh };
}
