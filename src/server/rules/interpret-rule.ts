import { generateText, jsonSchema, type LanguageModel, NoObjectGeneratedError, Output } from "ai";
import { failureMessage } from "src/server/ai/read-receipt";
import { parseProposal } from "src/server/rules/proposal";
import type { RuleMessage, RuleProposal } from "src/shared/api-types";

const CALL_TIMEOUT_MS = 30_000;
const TRIES = 2;

/** `message` is plain Chinese, shown in the dialog. */
export class InterpretFailedError extends Error {
  override name = "InterpretFailedError";
}

// Sets JSON mode; the checking is toProposal's.
const schema = jsonSchema<Record<string, unknown>>({
  type: "object",
  properties: {
    kind: { type: "string", enum: ["word", "template", "instruction", "not_a_rule"] },
    source: { type: "string" },
    target: { type: "string" },
    text: { type: "string" },
    replaces: { type: "string" },
    explanation: { type: "string" }
  },
  required: ["kind", "explanation"]
});

/**
 * One turn of the Add rule dialog: the dialog's own conversation, never any receipt (ADR-006).
 * Returns a checked proposal; saves nothing.
 */
export async function interpretRule(input: {
  model: LanguageModel;
  system: string;
  messages: RuleMessage[];
}): Promise<RuleProposal> {
  for (let attempt = 1; attempt <= TRIES; attempt++) {
    let reply: string;
    try {
      const result = await generateText({
        model: input.model,
        system: input.system,
        messages: input.messages.map(message => ({ role: message.role, content: message.text })),
        output: Output.object({ schema }),
        providerOptions: { deepseek: { thinking: { type: "disabled" } } },
        temperature: 0,
        maxRetries: 1,
        abortSignal: AbortSignal.timeout(CALL_TIMEOUT_MS)
      });
      reply = result.text;
    } catch (error) {
      if (!NoObjectGeneratedError.isInstance(error)) {
        throw new InterpretFailedError(failureMessage(error), { cause: error });
      }
      reply = error.text ?? "";
    }
    const proposal = parseProposal(reply);
    if (proposal) {
      return proposal;
    }
  }
  throw new InterpretFailedError("没听懂，请换个说法再试。");
}
