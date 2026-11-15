import { canRegenerate, statusLabel } from "src/client/receipt-labels";

const receipt = (status: "processing" | "done" | "unreadable" | "failed", attempts: number) => ({
  status,
  attempts
});

describe("statusLabel", () => {
  it("shows the first run as processing", () => {
    expect(statusLabel(receipt("processing", 0))).toBe("处理中…");
    expect(statusLabel(receipt("processing", 1))).toBe("处理中…");
  });

  // S-07 criterion 3: every device shows a rerun as "regenerating".
  it("shows a second or later run as regenerating", () => {
    expect(statusLabel(receipt("processing", 2))).toBe("重新生成中…");
  });

  it("labels finished receipts", () => {
    expect(statusLabel(receipt("done", 1))).toBe("已完成");
    expect(statusLabel(receipt("unreadable", 1))).toBe("看不清，请重拍");
    expect(statusLabel(receipt("failed", 1))).toBe("处理失败");
  });
});

describe("canRegenerate", () => {
  // S-07 criterion 1: every receipt, failed and unreadable included.
  it("offers regenerate for every receipt that is not being processed", () => {
    expect(canRegenerate(receipt("done", 1))).toBe(true);
    expect(canRegenerate(receipt("unreadable", 1))).toBe(true);
    expect(canRegenerate(receipt("failed", 1))).toBe(true);
    expect(canRegenerate(receipt("processing", 1))).toBe(false);
  });
});
