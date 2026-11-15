import { TransactWriteCommand, type TransactWriteCommandInput } from "@aws-sdk/lib-dynamodb";
import { cancellationCodes } from "src/server/repo/errors";
import type { Store } from "src/server/repo/store";

/** Tries in all, the first one included. */
const TRIES = 5;
/** The wait before try n + 1 is random, up to BASE_DELAY_MS × 2^(n − 1): at most 375 ms in all. */
const BASE_DELAY_MS = 25;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/** Cancelled only because another transaction held one of the items, not by a failed condition. */
function isConflictOnly(error: unknown): boolean {
  const codes = cancellationCodes(error);
  return (
    codes !== undefined &&
    codes.includes("TransactionConflict") &&
    !codes.includes("ConditionalCheckFailed")
  );
}

/**
 * Sends a `TransactWriteItems`, and sends it again when DynamoDB cancelled it only for a
 * conflict (T-018). Every receipt write also bumps the `CURRENT_SESSION` item, so uploads and
 * processing results of one batch meet there, and the SDK does not retry this cancellation.
 * A cancelled transaction wrote nothing, so the same request is safe to repeat. A failed
 * condition is a real answer and reaches the caller at once. A new command each try: the SDK's
 * commands carry per-send middleware.
 */
export async function sendTransaction(
  store: Store,
  input: TransactWriteCommandInput
): Promise<void> {
  for (let tries = 1; ; tries++) {
    try {
      await store.db.send(new TransactWriteCommand(input));
      return;
    } catch (error) {
      if (tries >= TRIES || !isConflictOnly(error)) {
        throw error;
      }
      await sleep(Math.random() * BASE_DELAY_MS * 2 ** (tries - 1));
    }
  }
}
