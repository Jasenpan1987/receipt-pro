// How a confirmed rule changes the user's settings. Pure: the route reads the settings, calls
// this, and writes the result with a conditional write on the settings version.

import type { Settings } from "src/server/repo/settings";
import type { RuleProposal } from "src/shared/api-types";

/** architecture.md#data-model: a word entry is keyed by its source, trimmed and case-folded. */
export function normaliseSource(source: string): string {
  return source.trim().replace(/\s+/g, " ").toLowerCase();
}

/** `replaces` for the saved template. */
export const TEMPLATE_ID = "template";

/**
 * Decides in code which saved rule a proposal replaces, so the confirmation can say so
 * (S-08 edge case). A word replaces the entry with the same source; a template replaces the
 * template; an instruction replaces the one the AI named, only if it exists.
 */
export function withReplaces(settings: Settings, proposal: RuleProposal): RuleProposal {
  const { replaces: _ignored, ...rest } = proposal as RuleProposal & { replaces?: string };
  switch (proposal.kind) {
    case "word": {
      const saved = settings.words.find(
        word => normaliseSource(word.source) === normaliseSource(proposal.source)
      );
      return saved ? { ...proposal, replaces: saved.id } : (rest as RuleProposal);
    }
    case "template":
      return settings.template ? { ...proposal, replaces: TEMPLATE_ID } : (rest as RuleProposal);
    case "instruction": {
      const exists = settings.instructions.some(
        instruction => instruction.id === proposal.replaces
      );
      return exists ? proposal : (rest as RuleProposal);
    }
    case "not_a_rule":
      return proposal;
  }
}

/** The settings after the rule. Only template, words, and instructions change; the version is the caller's. */
export function applyProposal(
  settings: Settings,
  proposal: RuleProposal,
  now: Date,
  newId: () => string
): Settings {
  const updatedAt = now.toISOString();
  switch (proposal.kind) {
    case "word": {
      const source = normaliseSource(proposal.source);
      return {
        ...settings,
        words: [
          ...settings.words.filter(word => normaliseSource(word.source) !== source),
          { id: newId(), source: proposal.source.trim(), target: proposal.target.trim(), updatedAt }
        ]
      };
    }
    case "template":
      return { ...settings, template: { text: proposal.text.trim(), updatedAt } };
    case "instruction":
      return {
        ...settings,
        instructions: [
          ...settings.instructions.filter(instruction => instruction.id !== proposal.replaces),
          { id: newId(), text: proposal.text.trim(), updatedAt }
        ]
      };
    case "not_a_rule":
      throw new Error("Not a rule: nothing to save.");
  }
}

/**
 * S-09: the settings without the rule `id` (a word entry, an instruction, or "template"), or
 * `undefined` when there is no such rule. Without a template, receipts go back to the builder's
 * usual template (src/server/ai/system-prompt.ts).
 */
export function removeRule(settings: Settings, id: string): Settings | undefined {
  if (id === TEMPLATE_ID) {
    return settings.template ? { ...settings, template: undefined } : undefined;
  }
  if (settings.words.some(word => word.id === id)) {
    return { ...settings, words: settings.words.filter(word => word.id !== id) };
  }
  if (settings.instructions.some(instruction => instruction.id === id)) {
    return {
      ...settings,
      instructions: settings.instructions.filter(instruction => instruction.id !== id)
    };
  }
  return undefined;
}
