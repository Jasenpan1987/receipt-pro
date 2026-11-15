import { DEFAULT_TEMPLATE } from "src/server/ai/system-prompt";
import { errorResponse } from "src/server/http";
import { currentUserId } from "src/server/identity";
import { getSettings } from "src/server/repo/settings";
import { getStore } from "src/server/repo/store";
import type { RulesView } from "src/shared/api-types";

export const dynamic = "force-dynamic";

/** S-09: every saved rule. */
export async function GET(): Promise<Response> {
  try {
    const settings = await getSettings(getStore(), currentUserId());
    const view: RulesView = {
      version: settings.version,
      template: settings.template?.text,
      defaultTemplate: DEFAULT_TEMPLATE,
      words: settings.words.map(({ id, source, target }) => ({ id, source, target })),
      instructions: settings.instructions.map(({ id, text }) => ({ id, text }))
    };
    return Response.json(view);
  } catch (error) {
    console.error("[receipt-pro] GET /api/rules failed:", error);
    return errorResponse(500, "读取规则失败，请重试。");
  }
}
