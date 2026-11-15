import type { ReceiptStatus, ReceiptView } from "src/shared/api-types";

const LABELS: Record<ReceiptStatus, string> = {
  processing: "处理中…",
  done: "已完成",
  unreadable: "看不清，请重拍",
  failed: "处理失败"
};

/** The first run is attempt 1 (0 before it starts), so 2 or more while processing is a rerun. */
export function statusLabel(receipt: Pick<ReceiptView, "status" | "attempts">): string {
  return receipt.status === "processing" && receipt.attempts >= 2
    ? "重新生成中…"
    : LABELS[receipt.status];
}

/** S-07: every receipt can be run again, failed and unreadable ones included, unless it is running. */
export function canRegenerate(receipt: Pick<ReceiptView, "status" | "attempts">): boolean {
  return receipt.status !== "processing";
}
