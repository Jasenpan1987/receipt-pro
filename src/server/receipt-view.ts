import type { S3Client } from "@aws-sdk/client-s3";
import { photoUrl } from "src/server/photos";
import type { Receipt } from "src/server/repo/receipts";
import type { ReceiptView } from "src/shared/api-types";

export async function toReceiptView(
  receipt: Receipt,
  s3: S3Client,
  bucket: string,
  now = new Date()
): Promise<ReceiptView> {
  return {
    receiptId: receipt.receiptId,
    status: receipt.status,
    text: receipt.text,
    error: receipt.error,
    photoUrl: await photoUrl(s3, bucket, receipt.photoKey, now),
    createdAt: receipt.createdAt
  };
}
