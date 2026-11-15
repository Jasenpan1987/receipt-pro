import { getAws } from "src/server/aws";
import { getAwsConfig } from "src/server/config";
import { errorResponse } from "src/server/http";
import { currentUserId } from "src/server/identity";
import { toReceiptView } from "src/server/receipt-view";
import { listReceipts } from "src/server/repo/receipts";
import { getCurrentSession } from "src/server/repo/sessions";
import { getStore } from "src/server/repo/store";
import { isUnchanged, parseSince } from "src/server/session-sync";
import type { SessionPoll } from "src/shared/api-types";

// Reads DynamoDB on every request; never prerendered at build time.
export const dynamic = "force-dynamic";

/**
 * `{ changed: false }` when the page's copy is current (one DynamoDB read), otherwise the whole
 * current session, receipts newest first. Without `since`, always the whole session.
 */
export async function GET(request: Request): Promise<Response> {
  try {
    const store = getStore();
    const since = parseSince(new URL(request.url).searchParams);
    const session = await getCurrentSession(store, currentUserId());
    const current = { sessionId: session?.sessionId ?? null, version: session?.version ?? 0 };
    if (isUnchanged(current, since)) {
      return Response.json({ changed: false } satisfies SessionPoll);
    }
    if (!session) {
      return Response.json({
        changed: true,
        sessionId: null,
        version: 0,
        receipts: []
      } satisfies SessionPoll);
    }
    const { s3 } = getAws();
    const { bucketName } = getAwsConfig();
    const now = new Date();
    const receipts = await listReceipts(store, session.sessionId);
    const body: SessionPoll = {
      changed: true,
      sessionId: session.sessionId,
      version: session.version,
      receipts: await Promise.all(
        receipts.map(receipt => toReceiptView(receipt, s3, bucketName, now))
      )
    };
    return Response.json(body);
  } catch (error) {
    console.error("[receipt-pro] GET /api/session failed:", error);
    return errorResponse(500, "读取失败，请重试。");
  }
}
