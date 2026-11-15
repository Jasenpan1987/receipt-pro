import type { Settings } from "src/server/repo/settings";
import { applyProposal, normaliseSource, withReplaces } from "src/server/rules/apply-rule";

const NOW = new Date("2026-11-15T12:00:00.000Z");
const ids = () => {
  let n = 0;
  return () => `new-${++n}`;
};
const settings = (extra: Partial<Settings> = {}): Settings => ({
  template: { text: "OLD TEMPLATE", updatedAt: "x" },
  words: [{ id: "w1", source: "Coles", target: "红超市", updatedAt: "x" }],
  instructions: [{ id: "i1", text: "折扣写成 -金额", updatedAt: "x" }],
  version: 3,
  ...extra
});

describe("normaliseSource", () => {
  it("trims, folds case, and collapses spaces", () => {
    expect(normaliseSource("  COLES   Express ")).toBe("coles express");
  });
});

describe("withReplaces", () => {
  // S-08 edge case: the confirmation says which saved rule a new one replaces. Decided in code,
  // not by the AI.
  it("marks a word rule for the same source as replacing the saved one", () => {
    const proposal = withReplaces(settings(), {
      kind: "word",
      source: " coles ",
      target: "大红超市",
      explanation: "e"
    });
    expect(proposal).toMatchObject({ replaces: "w1" });
  });

  it("does not mark a word rule for a new source", () => {
    const proposal = withReplaces(settings(), {
      kind: "word",
      source: "Aldi",
      target: "蓝超市",
      explanation: "e"
    });
    expect(proposal).not.toHaveProperty("replaces");
  });

  it("marks a template as replacing the saved template", () => {
    expect(
      withReplaces(settings(), { kind: "template", text: "T", explanation: "e" })
    ).toMatchObject({ replaces: "template" });
    expect(
      withReplaces(settings({ template: undefined }), {
        kind: "template",
        text: "T",
        explanation: "e"
      })
    ).not.toHaveProperty("replaces");
  });

  it("keeps an instruction's replaces only if that instruction exists", () => {
    expect(
      withReplaces(settings(), { kind: "instruction", text: "t", replaces: "i1", explanation: "e" })
    ).toMatchObject({ replaces: "i1" });
    expect(
      withReplaces(settings(), { kind: "instruction", text: "t", replaces: "i9", explanation: "e" })
    ).not.toHaveProperty("replaces");
  });
});

describe("applyProposal", () => {
  // Acceptance (T-007): "Coles 叫大红超市" replaces the saved Coles entry.
  it("replaces the word entry for the same source and keeps the others", () => {
    const before = settings({
      words: [...settings().words, { id: "w2", source: "Aldi", target: "蓝超市", updatedAt: "x" }]
    });
    const after = applyProposal(
      before,
      { kind: "word", source: "COLES", target: "大红超市", explanation: "e" },
      NOW,
      ids()
    );
    expect(after.words).toEqual([
      { id: "w2", source: "Aldi", target: "蓝超市", updatedAt: "x" },
      { id: "new-1", source: "COLES", target: "大红超市", updatedAt: "2026-11-15T12:00:00.000Z" }
    ]);
    expect(after.instructions).toEqual(before.instructions);
    expect(after.template).toEqual(before.template);
  });

  it("adds a word entry for a new source", () => {
    const after = applyProposal(
      settings(),
      { kind: "word", source: "Aldi", target: "蓝超市", explanation: "e" },
      NOW,
      ids()
    );
    expect(after.words.map(w => w.source)).toEqual(["Coles", "Aldi"]);
  });

  it("replaces the template", () => {
    const after = applyProposal(
      settings(),
      { kind: "template", text: "NEW TEMPLATE", explanation: "e" },
      NOW,
      ids()
    );
    expect(after.template).toEqual({ text: "NEW TEMPLATE", updatedAt: "2026-11-15T12:00:00.000Z" });
  });

  it("adds an instruction, or replaces the one it names", () => {
    const added = applyProposal(
      settings(),
      { kind: "instruction", text: "不写电话", explanation: "e" },
      NOW,
      ids()
    );
    expect(added.instructions.map(i => i.text)).toEqual(["折扣写成 -金额", "不写电话"]);
    const replaced = applyProposal(
      settings(),
      { kind: "instruction", text: "折扣写成（-金额）", replaces: "i1", explanation: "e" },
      NOW,
      ids()
    );
    expect(replaced.instructions.map(i => i.text)).toEqual(["折扣写成（-金额）"]);
  });

  // S-08 criterion 7: input that is not a rule saves nothing.
  it("refuses to apply something that is not a rule", () => {
    expect(() =>
      applyProposal(settings(), { kind: "not_a_rule", explanation: "e" }, NOW, ids())
    ).toThrow();
  });
});
