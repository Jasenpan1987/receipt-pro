// Every rule the AI follows when it reads a receipt: the fixed rules below, then the user's
// template, word list, and custom instructions (architecture.md#ai-call). Nothing else.

import { UNREADABLE_TEXT } from "src/server/ai/parse-reading";
import type { Settings } from "src/server/repo/settings";

/**
 * The template until the user saves one: the builder's usual shape (business.md#output). It is
 * also what gets saved as the template on first use (builder's decision, 2026-11-15).
 */
export const DEFAULT_TEMPLATE = "2026 年 10 月 1 日 Costco 青菜 3.25 水 2.0 啤酒 10.0 共1234，现金";

// Every field has one fixed way to be written, so 20 receipts give 20 outputs of the same shape
// (S-03). The merchant, item, and payment rules are the builder's choices of 2026-11-15.
const FIXED_RULES = `你读取一张小票照片，按用户的模板写出一行纯文本。只返回 JSON：{"status": "ok" 或 "unreadable", "text": "..."}。

text 的写法，每张小票都一样：
1. 只写小票内容，按模板的顺序和格式：日期 商家 商品和金额 共总额，付款方式。不要问候、解释、提示或任何其他话。所有中文都用简体字，小票上印的是繁体也一样。
2. 日期写成 "2026 年 10 月 1 日" 这样。小票上的日期是澳大利亚格式：日/月/年。
3. 商家写大家平时叫的简称，去掉 Pty Ltd、Limited、分店名、地址这类。小票上有中文店名就只写中文名，没有就写英文简称，例如 Coles、Bunnings、Chemist Warehouse。
4. 每个商品只写一个简短的中文名。不带品牌、规格、重量、数量、单价，不写斜杠或括号里的别名。商品后面写这一行的金额；买了几个就写这一行的合计。
5. 折扣写成 "折扣 -金额"，放在对应商品后面。
6. 金额照小票上印的写，不带货币符号。"共" 后面写小票上印的总额（TOTAL），不要自己加。
7. 付款方式只写 "现金" 或 "刷卡"：付现金写现金，其他（银行卡、信用卡、EFTPOS、Apple Pay 等）一律写刷卡。只看付款那一行（如 Cash、EFTPOS、MASTERCARD 后面跟着金额）；会员卡、积分卡（如 Flybuys、Scanned Card）不是付款方式。
8. 不写积分、已省金额、GST、找零、条码、电话。
9. 用户的词表和自定义指令优先于第 3 到第 8 条。

看不清时：
10. 整张或大部分看不清：status 为 "unreadable"，text 为 "${UNREADABLE_TEXT}"。不是小票的照片也这样处理。
11. 某个商品完全看不清：在它的位置写 "？？看不清"。商品名看得清、价格看不清：写 "<商品名> 价格？？看不清"。`;

export function buildSystemPrompt(
  settings: Pick<Settings, "template" | "words" | "instructions">
): string {
  const parts = [FIXED_RULES];

  parts.push(`模板：\n${settings.template?.text ?? DEFAULT_TEMPLATE}`);

  if (settings.words.length > 0) {
    const lines = settings.words.map(word => `- ${word.source} → ${word.target}`);
    parts.push(`词表（小票上的左边写成右边）：\n${lines.join("\n")}`);
  }

  if (settings.instructions.length > 0) {
    const lines = settings.instructions.map(instruction => `- ${instruction.text}`);
    parts.push(`自定义指令：\n${lines.join("\n")}`);
  }

  return parts.join("\n\n");
}
