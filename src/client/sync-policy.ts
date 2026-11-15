/** ADR-004: every 3 seconds while the page is visible. */
export const POLL_INTERVAL_MS = 3_000;

/** While a receipt is processing: the 2-minute rule can turn it `failed` without a version change. */
const FULL_WHILE_PROCESSING_MS = 30_000;

/** Photo URLs stay valid for at least an hour (src/server/photos.ts). */
const FULL_AT_LEAST_EVERY_MS = 30 * 60_000;

/** Whether the next poll should ask for the whole session instead of only changes. */
export function needsFullFetch(input: {
  known: boolean;
  hasProcessing: boolean;
  lastFullAt: number;
  now: number;
  forced: boolean;
}): boolean {
  if (!input.known || input.forced) {
    return true;
  }
  const age = input.now - input.lastFullAt;
  return age >= FULL_AT_LEAST_EVERY_MS || (input.hasProcessing && age >= FULL_WHILE_PROCESSING_MS);
}
