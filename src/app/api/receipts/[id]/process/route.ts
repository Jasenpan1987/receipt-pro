import { getModel } from "src/server/ai/model";
import { ReadFailedError, readReceipt } from "src/server/ai/read-receipt";
import { buildSystemPrompt, DEFAULT_TEMPLATE } from "src/server/ai/system-prompt";
import { getAws } from "src/server/aws";
import { getAwsConfig } from "src/server/config";
import { errorResponse } from "src/server/http";
import { requireUser } from "src/server/identity";
import { getPhoto } from "src/server/photos";
import {
  findReceipt,
  finishAttempt,
  type Outcome,
  type Receipt,
  startAttempt
} from "src/server/repo/receipts";
import { getCurrentSession } from "src/server/repo/sessions";
import { getSettings, saveTemplateIfMissing } from "src/server/repo/settings";
import { getStore, type Store } from "src/server/repo/store";
import type { ProcessReceiptResponse } from "src/shared/api-types";

/** Reads the photo with the user's current settings. Never throws: a failure is an outcome. */
async function run(
  store: Store,
  receipt: Receipt
): Promise<{ outcome: Outcome; hadTemplate: boolean }> {
  let hadTemplate = true;
  try {
    const { s3 } = getAws();
    const [settings, photo] = await Promise.all([
      getSettings(store, receipt.userId),
      getPhoto(s3, getAwsConfig().bucketName, receipt.photoKey)
    ]);
    hadTemplate = settings.template !== undefined;
    const reading = await readReceipt({
      model: getModel(),
      system: buildSystemPrompt(settings),
      photo
    });
    const outcome: Outcome =
      reading.status === "ok" ? { status: "done", text: reading.text } : { status: "unreadable" };
    return { outcome, hadTemplate };
  } catch (error) {
    if (error instanceof ReadFailedError) {
      console.error(
        `[receipt-pro] Reading receipt ${receipt.receiptId} failed:`,
        error.cause ?? error.message
      );
      return { outcome: { status: "failed", error: error.message }, hadTemplate };
    }
    console.error(`[receipt-pro] Processing receipt ${receipt.receiptId} failed:`, error);
    return { outcome: { status: "failed", error: "处理出错，请重新生成。" }, hadTemplate };
  }
}

/**
 * Runs one receipt through DeepSeek and stores the result. The phone calls this after the
 * upload returns; every device learns the result from the session, not from this response.
 */
export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  const auth = await requireUser();
  if ("response" in auth) {
    return auth.response;
  }
  const { userId } = auth;
  const { id } = await context.params;
  try {
    const store = getStore();
    const session = await getCurrentSession(store, userId);
    const receipt = session ? await findReceipt(store, session.sessionId, id) : undefined;
    if (!receipt) {
      return errorResponse(404, "找不到这张小票。");
    }

    const attempt = await startAttempt(store, receipt);
    if (attempt === undefined) {
      return errorResponse(409, "这张小票已经在处理了。");
    }

    const { outcome, hadTemplate } = await run(store, receipt);
    await finishAttempt(store, { ...receipt, attempts: attempt }, attempt, outcome);
    // S-03 criterion 7 (builder, 2026-11-15): with no template yet, the builder's usual template is
    // saved, not the first output, which would carry that receipt's items and slips into every
    // later one.
    if (!hadTemplate) {
      await saveTemplateIfMissing(store, userId, DEFAULT_TEMPLATE);
    }
    return Response.json({ status: outcome.status } satisfies ProcessReceiptResponse);
  } catch (error) {
    console.error(`[receipt-pro] POST /api/receipts/${id}/process failed:`, error);
    return errorResponse(500, "处理出错，请重新生成。");
  }
}
