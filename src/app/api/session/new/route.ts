import { getAws } from "src/server/aws";
import { getAwsConfig } from "src/server/config";
import { errorResponse } from "src/server/http";
import { currentUserId } from "src/server/identity";
import { deleteSessionPhotos } from "src/server/photos";
import { deleteSessionItems, startNewSession } from "src/server/repo/sessions";
import { getStore } from "src/server/repo/store";
import type { NewSessionResponse } from "src/shared/api-types";

/**
 * S-06: switches to an empty session, then deletes the old session's receipts and photos.
 * Settings are untouched. Every page sees the new session ID on its next poll. If the cleanup
 * fails, the data stays hidden (it is not current) and the next new session retries it.
 */
export async function POST(): Promise<Response> {
  try {
    const store = getStore();
    const userId = currentUserId();
    const { session, previous } = await startNewSession(store, userId);

    const stale = [previous?.sessionId, previous?.previousSessionId].filter((id): id is string =>
      Boolean(id)
    );
    let cleaned = true;
    for (const sessionId of stale) {
      try {
        await deleteSessionPhotos(getAws().s3, getAwsConfig().bucketName, userId, sessionId);
        await deleteSessionItems(store, sessionId);
      } catch (error) {
        cleaned = false;
        console.error(
          `[receipt-pro] Cleaning session ${sessionId} failed; the next new session retries it:`,
          error
        );
      }
    }
    return Response.json({ sessionId: session.sessionId, cleaned } satisfies NewSessionResponse);
  } catch (error) {
    console.error("[receipt-pro] POST /api/session/new failed:", error);
    return errorResponse(500, "开新 session 失败，请重试。");
  }
}
