/** AWS SDK errors are matched by name: the class can come from more than one module copy. */
export function errorName(error: unknown): string | undefined {
  return error instanceof Error ? error.name : undefined;
}

/** Per-item reasons of a cancelled `TransactWriteItems`, in request order. */
export function cancellationCodes(error: unknown): Array<string | undefined> | undefined {
  if (errorName(error) !== "TransactionCanceledException") {
    return undefined;
  }
  const reasons = (error as { CancellationReasons?: Array<{ Code?: string }> }).CancellationReasons;
  return reasons?.map(reason => reason.Code);
}
