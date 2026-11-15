// Checks a rule proposal, whether it comes from DeepSeek (interpret) or back from the page
// (apply). Anything malformed is refused; nothing unchecked reaches the settings.

import { singleJsonObject } from "src/server/ai/parse-reading";
import type { RuleMessage, RuleProposal } from "src/shared/api-types";

const MAX_NAME = 60;
const MAX_TEXT = 500;
const MAX_EXPLANATION = 400;
const MAX_MESSAGES = 12;
const MAX_MESSAGE = 2000;

function text(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed && trimmed.length <= max ? trimmed : undefined;
}

/** A checked proposal, or `undefined`. A missing or overlong explanation is not fatal. */
export function toProposal(value: unknown): RuleProposal | undefined {
  if (value === null || typeof value !== "object") {
    return undefined;
  }
  const v = value as Record<string, unknown>;
  const explanation = text(v.explanation, MAX_EXPLANATION) ?? "";
  const replaces = typeof v.replaces === "string" && v.replaces ? { replaces: v.replaces } : {};
  switch (v.kind) {
    case "word": {
      const source = text(v.source, MAX_NAME);
      const target = text(v.target, MAX_NAME);
      return source && target
        ? { kind: "word", source, target, explanation, ...replaces }
        : undefined;
    }
    case "template":
    case "instruction": {
      // A template is one line pasted into Word.
      const body = text(v.text, MAX_TEXT)?.replace(
        /\s*[\r\n]+\s*/g,
        v.kind === "template" ? " " : "\n"
      );
      return body ? { kind: v.kind, text: body, explanation, ...replaces } : undefined;
    }
    case "not_a_rule":
      return {
        kind: "not_a_rule",
        explanation: explanation || "这不是一条规则，没有保存任何东西。"
      };
    default:
      return undefined;
  }
}

/** DeepSeek's reply: exactly one JSON object, as for receipts (src/server/ai/parse-reading.ts). */
export function parseProposal(reply: string): RuleProposal | undefined {
  return toProposal(singleJsonObject(reply));
}

/** The dialog's conversation as sent by the page: at most 12 turns, ending with the user's. */
export function toMessages(value: unknown): RuleMessage[] | undefined {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_MESSAGES) {
    return undefined;
  }
  const messages: RuleMessage[] = [];
  for (const item of value) {
    const role = (item as { role?: unknown })?.role;
    const body = text((item as { text?: unknown })?.text, MAX_MESSAGE);
    if ((role !== "user" && role !== "assistant") || !body) {
      return undefined;
    }
    messages.push({ role, text: body });
  }
  return messages.at(-1)?.role === "user" ? messages : undefined;
}
