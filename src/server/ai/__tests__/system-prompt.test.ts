import { buildSystemPrompt, DEFAULT_TEMPLATE } from "src/server/ai/system-prompt";

const empty = { words: [], instructions: [] };

describe("buildSystemPrompt", () => {
  it("uses the builder's usual template while none is saved", () => {
    expect(buildSystemPrompt(empty)).toContain(`模板：\n${DEFAULT_TEMPLATE}`);
  });

  // Builder, 2026-11-15: one way to write each field, so outputs never mix 现金 and CASH.
  it("fixes how the payment method, merchant, and items are written", () => {
    const prompt = buildSystemPrompt(empty);
    expect(prompt).toContain('付款方式只写 "现金" 或 "刷卡"');
    expect(prompt).toContain("商家写大家平时叫的简称");
    expect(prompt).toContain("所有中文都用简体字");
  });

  // Builder, 2026-11-16: 美心月饼 and 月饼 are different things, so items keep their brand
  // (business.md#output). Store brands add nothing next to the merchant.
  it("writes an item with its brand, the common Chinese brand name if there is one", () => {
    const prompt = buildSystemPrompt(empty);
    expect(prompt).toContain("品牌 + 简短的中文商品名");
    expect(prompt).toContain("超市自己的牌子");
    expect(prompt).not.toContain("不带品牌");
  });

  // A bare list of example brands was copied onto a receipt: 東鵬特飲 came out as 维他奶, one
  // of the examples (2026-11-16, IMG_8486). Examples name what is printed, and nothing is guessed.
  it("ties every brand example to what the receipt prints, and forbids guessing", () => {
    const prompt = buildSystemPrompt(empty);
    expect(prompt).toContain("小票印 MAXIMS MOONCAKE，写成 美心月饼");
    expect(prompt).toContain("没印就只写商品名，不要猜");
    expect(prompt).not.toContain("维他奶");
  });

  it("says where the space goes between brand and item", () => {
    expect(buildSystemPrompt(empty)).toContain("中文品牌和商品名连着写，英文品牌后面空一格");
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

  // T-007: a template that moves the payment method must win over any default order.
  it("takes the order of fields from the template, not from a fixed order", () => {
    const prompt = buildSystemPrompt(empty);
    expect(prompt).toContain("各项的顺序、分隔和格式一律照模板");
    expect(prompt).not.toContain("日期 商家 商品和金额 共总额，付款方式");
  });

  // T-006: a fixed date example with 日 beat the builder's template, which had dropped 日.
  it("takes the date style from the template and lets the user's rules win", () => {
    const prompt = buildSystemPrompt(empty);
    expect(prompt).toContain("日期的写法完全照模板");
    expect(prompt).not.toContain('日期写成 "2026 年 10 月 1 日" 这样');
    expect(prompt).toContain("和上面第 1 到第 8 条冲突时，以用户的为准");
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
