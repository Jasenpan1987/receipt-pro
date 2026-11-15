import type { ApiError, CreateReceiptResponse, ReceiptView } from "src/shared/api-types";

/** After this, the card shows the failure and a retry button instead of waiting on. */
export const UPLOAD_TIMEOUT_MS = 60_000;

/** `message` is plain Chinese, ready to show. */
export class UploadError extends Error {
  override name = "UploadError";
}

export type UploadInput = { photo: Blob; thumb?: Blob; receiptId: string; createdAt: string };

/** Safe to call again with the same input: the server returns the receipt it already has. */
export async function uploadReceipt(
  input: UploadInput,
  timeoutMs = UPLOAD_TIMEOUT_MS
): Promise<ReceiptView> {
  const form = new FormData();
  form.append("photo", input.photo, `${input.receiptId}.jpg`);
  if (input.thumb) {
    form.append("thumb", input.thumb, `${input.receiptId}.thumb.jpg`);
  }
  form.append("receiptId", input.receiptId);
  form.append("createdAt", input.createdAt);

  let response: Response;
  try {
    response = await fetch("/api/receipts", {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(timeoutMs)
    });
  } catch {
    throw new UploadError("上传失败，请检查网络后重试。");
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => undefined)) as ApiError | undefined;
    throw new UploadError(body?.error ?? "上传失败，请重试。");
  }
  const body = (await response.json()) as CreateReceiptResponse;
  return body.receipt;
}
