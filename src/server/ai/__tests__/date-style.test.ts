import { applyTemplateDateStyle } from "src/server/ai/date-style";

const usual = "2026 年 10 月 1 日 Costco 青菜 3.25 水 2.0 啤酒 10.0 共1234，现金";
// The builder's template after their own rules, 2026-11-15: no 日, three spaces after the date.
const builders = "2026 年 10 月 1   Costco 青菜 3.25 水 2.0 啤酒 10.0 共1234，现金";

describe("applyTemplateDateStyle", () => {
  it("drops 日 and puts three spaces after the date when the template does", () => {
    expect(
      applyTemplateDateStyle("2026 年 9 月 1 日 通利 烤鳗鱼 16.99 共16.99，现金", builders)
    ).toBe("2026 年 9 月 1   通利 烤鳗鱼 16.99 共16.99，现金");
  });

  it("adds 日 and one space when the template has them", () => {
    expect(applyTemplateDateStyle("2026 年 9 月 1   通利 烤鳗鱼 16.99 共16.99，现金", usual)).toBe(
      "2026 年 9 月 1 日 通利 烤鳗鱼 16.99 共16.99，现金"
    );
  });

  it("normalises spacing inside the date the way the template writes it", () => {
    expect(applyTemplateDateStyle("2026年9月1日 通利 共1.00，现金", usual)).toBe(
      "2026 年 9 月 1 日 通利 共1.00，现金"
    );
  });

  it("leaves text alone when it does not start with a date", () => {
    expect(applyTemplateDateStyle("通利 2026 年 9 月 1 日 共1.00，现金", builders)).toBe(
      "通利 2026 年 9 月 1 日 共1.00，现金"
    );
  });

  it("leaves text alone when the template does not start with a date in this style", () => {
    const other = "Costco 2026-10-01 青菜 3.25 共3.25，现金";
    expect(applyTemplateDateStyle("2026 年 9 月 1 日 通利 共1.00，现金", other)).toBe(
      "2026 年 9 月 1 日 通利 共1.00，现金"
    );
  });
});
