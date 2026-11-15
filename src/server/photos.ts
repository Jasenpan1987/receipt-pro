import { GetObjectCommand, PutObjectCommand, type S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const HOUR_MS = 60 * 60 * 1000;

export function photoKey(userId: string, sessionId: string, receiptId: string): string {
  return `photos/${userId}/${sessionId}/${receiptId}.jpg`;
}

/** The stored JPEG, as sent to DeepSeek. */
export async function getPhoto(s3: S3Client, bucket: string, key: string): Promise<Uint8Array> {
  const { Body } = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  if (!Body) {
    throw new Error(`Photo ${key} has no body.`);
  }
  return Body.transformToByteArray();
}

/** The key is fixed by the receipt, so a retried upload overwrites the same object. */
export async function putPhoto(
  s3: S3Client,
  bucket: string,
  key: string,
  body: Uint8Array
): Promise<void> {
  await s3.send(
    new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: "image/jpeg" })
  );
}

/**
 * A presigned GET URL, signed as of the start of the current hour and valid for two hours. The
 * URL for one photo is then identical for a whole hour, so the browser keeps its cached copy
 * while the page polls (T-005), and it is always valid for at least one more hour.
 */
export function photoUrl(
  s3: S3Client,
  bucket: string,
  key: string,
  now = new Date()
): Promise<string> {
  const signingDate = new Date(Math.floor(now.getTime() / HOUR_MS) * HOUR_MS);
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: bucket, Key: key }), {
    signingDate,
    expiresIn: (2 * HOUR_MS) / 1000
  });
}
