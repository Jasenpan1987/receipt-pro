import { randomUUID } from "node:crypto";

import { errorResponse } from "src/server/http";
import { currentUserId } from "src/server/identity";
import { getSettings, saveSettings, SettingsChangedError } from "src/server/repo/settings";
import { getStore } from "src/server/repo/store";
import { applyProposal, withReplaces } from "src/server/rules/apply-rule";
import { toProposal } from "src/server/rules/proposal";

/**
 * S-08: saves a rule the user confirmed. The proposal is checked again here, because it comes
 * back from the page, and saved only if the settings are still the version it was made against.
 * Existing receipts do not change; the rule applies from the next run.
 */
export async function POST(request: Request): Promise<Response> {
  const body = (await request.json().catch(() => undefined)) as
    | { proposal?: unknown; version?: unknown }
    | undefined;
  const proposal = toProposal(body?.proposal);
  const version = body?.version;
  if (
    !proposal ||
    proposal.kind === "not_a_rule" ||
    typeof version !== "number" ||
    !Number.isInteger(version) ||
    version < 0
  ) {
    return errorResponse(400, "这条规则无法保存，请重新说一遍。");
  }
  try {
    const store = getStore();
    const userId = currentUserId();
    const settings = await getSettings(store, userId);
    if (settings.version !== version) {
      return errorResponse(409, "规则刚被改过，请重新发送一次再确认。");
    }
    const next = applyProposal(settings, withReplaces(settings, proposal), new Date(), randomUUID);
    await saveSettings(store, userId, next, version);
    return Response.json({ saved: true });
  } catch (error) {
    if (error instanceof SettingsChangedError) {
      return errorResponse(409, "规则刚被改过，请重新发送一次再确认。");
    }
    console.error("[receipt-pro] POST /api/rules/apply failed:", error);
    return errorResponse(500, "保存失败，请重试。");
  }
}
