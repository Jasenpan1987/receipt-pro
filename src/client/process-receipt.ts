/** Longer than the server's two AI tries (45 s each), so the server finishes first. */
const PROCESS_TIMEOUT_MS = 110_000;

/**
 * Asks the server to read the receipt. The result is not taken from the response: the page
 * reloads the session, which every device shares. A failure here leaves the receipt
 * `processing`, and the 2-minute rule shows it as failed.
 */
export async function processReceipt(receiptId: string): Promise<void> {
  try {
    await fetch(`/api/receipts/${encodeURIComponent(receiptId)}/process`, {
      method: "POST",
      signal: AbortSignal.timeout(PROCESS_TIMEOUT_MS)
    });
  } catch {
    // Handled by the session reload and the 2-minute rule.
  }
}
