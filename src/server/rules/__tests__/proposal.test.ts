import { MockLanguageModelV4 } from "ai/test";
import { buildInterpretPrompt } from "src/server/rules/interpret-prompt";
import { interpretRule } from "src/server/rules/interpret-rule";
import { parseProposal, toMessages, toProposal } from "src/server/rules/proposal";

describe("toProposal", () => {
  it("accepts each kind with its fields, trimmed", () => {
    expect(
      toProposal({ kind: "word", source: " Coles ", target: "红超市", explanation: "好的" })
    ).toEqual({
      kind: "word",
      source: "Coles",
      target: "红超市",
      explanation: "好的"
    });
    expect(
      toProposal({ kind: "instruction", text: "不写电话", explanation: "e", replaces: "i1" })
    ).toMatchObject({ replaces: "i1" });
  });

  it("keeps a template on one line", () => {
    expect(
      toProposal({
        kind: "template",
        text: "2026 年 1 月 1 日 店\n菜 1.00 共1.00，现金",
        explanation: "e"
      })
    ).toMatchObject({
      text: "2026 年 1 月 1 日 店 菜 1.00 共1.00，现金"
    });
  });

  it("refuses unknown kinds, missing fields, and oversized names", () => {
    for (const value of [
      { kind: "delete_everything", explanation: "e" },
      { kind: "word", source: "Coles", explanation: "e" },
      { kind: "template", text: "  ", explanation: "e" },
      { kind: "word", source: "x".repeat(61), target: "y", explanation: "e" },
      null,
      "word"
    ]) {
      expect(toProposal(value)).toBeUndefined();
    }
  });

  // S-08 criterion 7: a plain reply saying it is not a rule.
  it("gives a not-a-rule reply a plain explanation even when the AI left it out", () => {
    expect(toProposal({ kind: "not_a_rule" })).toEqual({
      kind: "not_a_rule",
      explanation: "这不是一条规则，没有保存任何东西。"
    });
  });

  it("parses exactly one JSON object from a reply", () => {
    expect(
      parseProposal('好的：{"kind":"not_a_rule","explanation":"今天的天气我不知道。"}')
    ).toMatchObject({ kind: "not_a_rule" });
    expect(
      parseProposal(
        '{"kind":"not_a_rule","explanation":"a"}{"kind":"word","source":"a","target":"b","explanation":"b"}'
      )
    ).toBeUndefined();
  });
});

describe("toMessages", () => {
  it("accepts a short conversation that ends with the user", () => {
    expect(toMessages([{ role: "user", text: "以后 Coles 都叫红超市" }])).toHaveLength(1);
    expect(
      toMessages([
        { role: "user", text: "a" },
        { role: "assistant", text: "b" },
        { role: "user", text: "不对" }
      ])
    ).toHaveLength(3);
  });

  it("refuses empty, overlong, badly shaped, or assistant-last conversations", () => {
    for (const value of [
      [],
      Array.from({ length: 13 }, () => ({ role: "user", text: "x" })),
      [{ role: "system", text: "x" }],
      [{ role: "user", text: "" }],
      [{ role: "user", text: "x".repeat(2001) }],
      [
        { role: "user", text: "a" },
        { role: "assistant", text: "b" }
      ],
      "hello"
    ]) {
      expect(toMessages(value)).toBeUndefined();
    }
  });
});

describe("buildInterpretPrompt", () => {
  it("shows the current settings, with instruction IDs so the AI can name what it replaces", () => {
    const prompt = buildInterpretPrompt({
      template: { text: "MY TEMPLATE", updatedAt: "x" },
      words: [{ id: "w1", source: "Coles", target: "红超市", updatedAt: "x" }],
      instructions: [{ id: "i1", text: "折扣写成 -金额", updatedAt: "x" }]
    });
    expect(prompt).toContain("模板：\nMY TEMPLATE");
    expect(prompt).toContain("- Coles → 红超市");
    expect(prompt).toContain("- [i1] 折扣写成 -金额");
  });
});

describe("interpretRule", () => {
  const reply = (text: string) => ({
    content: [{ type: "text" as const, text }],
    finishReason: { unified: "stop" as const, raw: undefined },
    usage: {
      inputTokens: { total: 500, noCache: 500, cacheRead: undefined, cacheWrite: undefined },
      outputTokens: { total: 40, text: 40, reasoning: undefined }
    },
    warnings: []
  });

  it("sends only the dialog's conversation, in JSON mode at temperature 0", async () => {
    const model = new MockLanguageModelV4({
      doGenerate: [reply('{"kind":"word","source":"Coles","target":"红超市","explanation":"好的"}')]
    });
    const proposal = await interpretRule({
      model,
      system: "RULES",
      messages: [{ role: "user", text: "以后 Coles 都叫红超市" }]
    });
    expect(proposal).toMatchObject({ kind: "word", target: "红超市" });
    const call = model.doGenerateCalls[0];
    expect(call.responseFormat?.type).toBe("json");
    expect(call.temperature).toBe(0);
    expect(call.prompt).toHaveLength(2);
  });

  it("retries once on an unusable reply, then gives a plain message", async () => {
    const model = new MockLanguageModelV4({ doGenerate: [reply("嗯？"), reply("{}")] });
    await expect(
      interpretRule({ model, system: "RULES", messages: [{ role: "user", text: "x" }] })
    ).rejects.toThrow("没听懂，请换个说法再试。");
    expect(model.doGenerateCalls).toHaveLength(2);
  });
});
