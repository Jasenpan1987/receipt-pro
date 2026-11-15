import { getAws } from "src/server/aws";
import { getAwsConfig } from "src/server/config";
import { errorResponse } from "src/server/http";
import { currentUserId } from "src/server/identity";
import { toReceiptView } from "src/server/receipt-view";
import { listReceipts } from "src/server/repo/receipts";
import { getCurrentSession } from "src/server/repo/sessions";
import { getStore } from "src/server/repo/store";
import type { SessionView } from "src/shared/api-types";

// Reads DynamoDB on every request; never prerendered at build time.
export const dynamic = "force-dynamic";

/** The whole current session, receipts newest first. T-005 adds `?since=<version>`. */
export async function GET(): Promise<Response> {
  try {
    const store = getStore();
    const session = await getCurrentSession(store, currentUserId());
    if (!session) {
      return Response.json({ sessionId: null, version: 0, receipts: [] } satisfies SessionView);
    }
    const { s3 } = getAws();
    const { bucketName } = getAwsConfig();
    const now = new Date();
    const receipts = await listReceipts(store, session.sessionId);
    const body: SessionView = {
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
