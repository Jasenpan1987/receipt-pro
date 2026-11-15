import { getModel } from "src/server/ai/model";
import { errorResponse } from "src/server/http";
import { requireUser } from "src/server/identity";
import { getSettings } from "src/server/repo/settings";
import type { Settings } from "src/server/repo/settings";
import { getStore } from "src/server/repo/store";
import { TEMPLATE_ID, withReplaces } from "src/server/rules/apply-rule";
import { buildInterpretPrompt } from "src/server/rules/interpret-prompt";
import { InterpretFailedError, interpretRule } from "src/server/rules/interpret-rule";
import { toMessages } from "src/server/rules/proposal";
import type { InterpretRuleResponse, RuleProposal } from "src/shared/api-types";

/** The saved rule a proposal replaces, in plain words for the confirmation (S-08 edge case). */
function replacing(settings: Settings, proposal: RuleProposal): string | undefined {
  if (proposal.kind === "not_a_rule" || !proposal.replaces) {
    return undefined;
  }
  if (proposal.replaces === TEMPLATE_ID) {
    return settings.template?.text;
  }
  const word = settings.words.find(entry => entry.id === proposal.replaces);
  if (word) {
    return `${word.source} → ${word.target}`;
  }
  return settings.instructions.find(entry => entry.id === proposal.replaces)?.text;
}

/** S-08: plain language in, a proposed rule and its explanation out. Saves nothing. */
export async function POST(request: Request): Promise<Response> {
  const auth = await requireUser();
  if ("response" in auth) {
    return auth.response;
  }
  const { userId } = auth;
  const body = (await request.json().catch(() => undefined)) as { messages?: unknown } | undefined;
  const messages = toMessages(body?.messages);
  if (!messages) {
    return errorResponse(400, "请先写下规则，再发送。");
  }
  try {
    const settings = await getSettings(getStore(), userId);
    const proposal = withReplaces(
      settings,
      await interpretRule({ model: getModel(), system: buildInterpretPrompt(settings), messages })
    );
    const response: InterpretRuleResponse = {
      proposal,
      version: settings.version,
      replacing: replacing(settings, proposal)
    };
    return Response.json(response);
  } catch (error) {
    if (error instanceof InterpretFailedError) {
      console.error("[receipt-pro] Interpreting a rule failed:", error.cause ?? error.message);
      return errorResponse(502, error.message);
    }
    console.error("[receipt-pro] POST /api/rules/interpret failed:", error);
    return errorResponse(500, "出错了，请重试。");
  }
}
