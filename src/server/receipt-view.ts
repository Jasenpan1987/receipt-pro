import type { S3Client } from "@aws-sdk/client-s3";
import { photoUrl } from "src/server/photos";
import type { Receipt } from "src/server/repo/receipts";
import type { ReceiptView } from "src/shared/api-types";

/** A run that has not finished after this long died somewhere; it shows as failed. */
export const PROCESSING_LIMIT_MS = 2 * 60 * 1000;

export async function toReceiptView(
  receipt: Receipt,
  s3: S3Client,
  bucket: string,
  now = new Date()
): Promise<ReceiptView> {
  const stuck =
    receipt.status === "processing" &&
    now.getTime() - Date.parse(receipt.updatedAt) > PROCESSING_LIMIT_MS;
  return {
    receiptId: receipt.receiptId,
    status: stuck ? "failed" : receipt.status,
    text: stuck ? undefined : receipt.text,
    error: stuck ? "处理超时，请重新生成。" : receipt.error,
    photoUrl: await photoUrl(s3, bucket, receipt.photoKey, now),
    thumbUrl: receipt.thumbKey ? await photoUrl(s3, bucket, receipt.thumbKey, now) : undefined,
    createdAt: receipt.createdAt,
    attempts: receipt.attempts
  };
}
