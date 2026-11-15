const RETRY_INTERVAL_MS = 60_000;

/**
 * The photo URL each receipt card shows (T-019). The server signs a new URL whenever a different
 * Lambda instance answers, and a new `src` makes the browser download and decode the photo again.
 * So a card keeps the URL it already shows, and takes the newest one only after it fails to load
 * (expired after an hour or two).
 */
export class StableUrls {
  private readonly shown = new Map<string, string>();
  private readonly lastRetry = new Map<string, number>();

  /** The URL this receipt already shows, or `latest` the first time. */
  get(receiptId: string, latest: string): string {
    const shown = this.shown.get(receiptId);
    if (shown !== undefined) {
      return shown;
    }
    this.shown.set(receiptId, latest);
    return latest;
  }

  /**
   * The shown URL failed to load: the next `get` takes the newest URL. Returns whether to ask the
   * server for new URLs now: at most once a minute per receipt, so a photo that is gone does not
   * make the page refresh in a loop.
   */
  failed(receiptId: string, now = Date.now()): boolean {
    this.shown.delete(receiptId);
    const last = this.lastRetry.get(receiptId);
    if (last !== undefined && now - last < RETRY_INTERVAL_MS) {
      return false;
    }
    this.lastRetry.set(receiptId, now);
    return true;
  }
}
