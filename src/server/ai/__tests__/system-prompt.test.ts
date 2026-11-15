import { buildSystemPrompt, DEFAULT_TEMPLATE } from "src/server/ai/system-prompt";

const empty = { words: [], instructions: [] };

describe("buildSystemPrompt", () => {
  it("uses the builder's usual template as the example while none is saved", () => {
    const prompt = buildSystemPrompt(empty);
    expect(prompt).toContain(`用户还没有保存模板，按这个例子的格式写）：\n${DEFAULT_TEMPLATE}`);
  });

  it("uses the saved template once there is one", () => {
    const prompt = buildSystemPrompt({
      ...empty,
      template: { text: "MY TEMPLATE", updatedAt: "x" }
    });
    expect(prompt).toContain("模板：\nMY TEMPLATE");
    expect(prompt).not.toContain(DEFAULT_TEMPLATE);
  });

  // architecture.md#ai-call: fixed rules, then template, word list, custom instructions.
  it("puts the fixed rules first, then template, word list, and instructions", () => {
    const prompt = buildSystemPrompt({
      template: { text: "MY TEMPLATE", updatedAt: "x" },
      words: [{ id: "w1", source: "Coles", target: "红超市", updatedAt: "x" }],
      instructions: [{ id: "i1", text: "折扣写成 -金额", updatedAt: "x" }]
    });
    const order = [
      "只返回 JSON",
      "\n\n模板：",
      "\n\n词表（",
      "- Coles → 红超市",
      "\n\n自定义指令：",
      "- 折扣写成 -金额"
    ].map(part => prompt.indexOf(part));
    expect(order.every(index => index >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it("leaves out empty word lists and instructions", () => {
    const prompt = buildSystemPrompt(empty);
    expect(prompt).not.toContain("词表（");
    expect(prompt).not.toContain("自定义指令：");
  });

  it("states the three unreadable rules", () => {
    const prompt = buildSystemPrompt(empty);
    expect(prompt).toContain("看不清，请重拍");
    expect(prompt).toContain("？？看不清");
    expect(prompt).toContain("价格？？看不清");
  });
});
