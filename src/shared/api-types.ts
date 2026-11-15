// JSON shapes exchanged between the browser and the API. Types only, so both sides can import it.

export type ReceiptStatus = "processing" | "done" | "unreadable" | "failed";

export type ReceiptView = {
  receiptId: string;
  status: ReceiptStatus;
  text?: string;
  error?: string;
  /** Short-lived presigned URL; the bucket is never public. */
  photoUrl: string;
  createdAt: string;
};

export type SessionView = {
  /** `null` until the first receipt creates the session. */
  sessionId: string | null;
  version: number;
  /** Newest first. */
  receipts: ReceiptView[];
};

export type CreateReceiptResponse = { receipt: ReceiptView };

export type ProcessReceiptResponse = { status: ReceiptStatus };

/** Every API error. `error` is a plain Chinese message the page can show as is. */
export type ApiError = { error: string };
