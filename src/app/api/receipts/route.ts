import { getAws } from "src/server/aws";
import { getAwsConfig } from "src/server/config";
import { errorResponse } from "src/server/http";
import { requireUser } from "src/server/identity";
import { photoKey, putPhoto, thumbKey } from "src/server/photos";
import { toReceiptView } from "src/server/receipt-view";
import { createReceipt } from "src/server/repo/receipts";
import { getOrCreateCurrentSession } from "src/server/repo/sessions";
import { getStore } from "src/server/repo/store";
import { parseUploadForm } from "src/server/upload-form";
import type { CreateReceiptResponse } from "src/shared/api-types";

/**
 * Stores one receipt photo and creates the receipt as `processing`. Repeating the request with
 * the same `receiptId` and `createdAt` returns the same receipt (200) instead of a new one (201).
 */
export async function POST(request: Request): Promise<Response> {
  const auth = await requireUser();
  if ("response" in auth) {
    return auth.response;
  }
  const { userId } = auth;
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return errorResponse(400, "上传的内容无法读取，请重试。");
  }
  const parsed = await parseUploadForm(form);
  if (!parsed.ok) {
    return errorResponse(parsed.status, parsed.error);
  }

  try {
    const { receiptId, createdAt, photo, thumb } = parsed.value;
    const store = getStore();
    const { s3 } = getAws();
    const { bucketName } = getAwsConfig();

    const session = await getOrCreateCurrentSession(store, userId);
    const key = photoKey(userId, session.sessionId, receiptId);
    const smallKey = thumb ? thumbKey(userId, session.sessionId, receiptId) : undefined;
    await Promise.all([
      putPhoto(s3, bucketName, key, photo),
      thumb && smallKey ? putPhoto(s3, bucketName, smallKey, thumb) : undefined
    ]);
    const { receipt, created } = await createReceipt(store, {
      userId,
      session,
      receiptId,
      createdAt,
      photoKey: key,
      thumbKey: smallKey
    });

    const body: CreateReceiptResponse = { receipt: await toReceiptView(receipt, s3, bucketName) };
    return Response.json(body, { status: created ? 201 : 200 });
  } catch (error) {
    console.error("[receipt-pro] POST /api/receipts failed:", error);
    return errorResponse(500, "保存失败，请重试。");
  }
}
