import { parseReading, UNREADABLE_TEXT } from "src/server/ai/parse-reading";

const TEXT = "2026 年 10 月 1 日 Costco 青菜 3.25 水 2.0 啤酒 10.0 共1234，现金";
const ok = JSON.stringify({ status: "ok", text: TEXT });

describe("parseReading", () => {
  it("accepts a bare reply", () => {
    expect(parseReading(ok)).toEqual({ status: "ok", text: TEXT });
  });

  // Acceptance (T-004): conversational text never survives, outside the JSON or inside it.
  it("drops conversational text after the JSON", () => {
    expect(parseReading(`${ok}\n好，这张弄完了，请发下一张`)).toEqual({ status: "ok", text: TEXT });
  });

  it("drops conversational text before the JSON", () => {
    expect(parseReading(`好的，结果如下：\n${ok}`)).toEqual({ status: "ok", text: TEXT });
  });

  it("drops an extra field that holds conversational text", () => {
    const reply = JSON.stringify({ status: "ok", text: TEXT, note: "好，这张弄完了，请发下一张" });
    expect(parseReading(reply)).toEqual({ status: "ok", text: TEXT });
  });

  // Seen in T-002: a JSON object, a self-check in free text, then a second, different object.
  it("refuses a reply with two JSON objects, because it is unclear which one is meant", () => {
    const reply = `${ok}\n\n校对：价格之和与总额不符。\n\n${JSON.stringify({ status: "unreadable", text: UNREADABLE_TEXT })}`;
    expect(parseReading(reply)).toBeUndefined();
  });

  // Seen in T-002: a leaked end-of-thinking token before the only object.
  it("accepts one object after a leaked thinking token", () => {
    expect(parseReading(`Final.<｜end▁of▁thinking｜>${ok}`)).toEqual({ status: "ok", text: TEXT });
  });

  it("refuses blank, non-JSON, and truncated replies", () => {
    for (const reply of ["", "   ", "看不清", '{"status":"ok","text":"2026 年 10 月']) {
      expect(parseReading(reply)).toBeUndefined();
    }
  });

  it("refuses a reply without a known status or with an empty text", () => {
    for (const value of [
      { text: TEXT },
      { status: "done", text: TEXT },
      { status: "ok", text: "  " },
      { status: "ok" }
    ]) {
      expect(parseReading(JSON.stringify(value))).toBeUndefined();
    }
  });

  it("keeps braces inside the text", () => {
    const text = "2026 年 10 月 1 日 {店} 水 2.0 共2.0，现金";
    expect(parseReading(`说明 ${JSON.stringify({ status: "ok", text })}`)).toEqual({
      status: "ok",
      text
    });
  });

  // business.md#unreadable-receipts: the whole receipt unreadable shows only the fixed message.
  it("always uses the fixed message for an unreadable receipt", () => {
    expect(
      parseReading(JSON.stringify({ status: "unreadable", text: "这张太模糊了，抱歉" }))
    ).toEqual({
      status: "unreadable",
      text: UNREADABLE_TEXT
    });
  });

  // The output is one line pasted into Word.
  it("joins line breaks into single spaces and trims", () => {
    expect(
      parseReading(
        JSON.stringify({
          status: "ok",
          text: `  2026 年 10 月 1 日 Costco\n青菜 3.25 \r\n 共3.25，现金 `
        })
      )
    ).toEqual({
      status: "ok",
      text: "2026 年 10 月 1 日 Costco 青菜 3.25 共3.25，现金"
    });
  });
});
