// Every rule the AI follows when it reads a receipt: the fixed rules below, then the user's
// template, word list, and custom instructions (architecture.md#ai-call). Nothing else.

import { UNREADABLE_TEXT } from "src/server/ai/parse-reading";
import type { Settings } from "src/server/repo/settings";

/**
 * Used while the user has no saved template: the builder's usual shape (business.md#output).
 * The first `ok` output is then saved as the template (builder's decision, 2026-11-15).
 */
export const DEFAULT_TEMPLATE = "2026 年 10 月 1 日 Costco 青菜 3.25 水 2.0 啤酒 10.0 共1234，现金";

const FIXED_RULES = `你读取一张小票照片，按用户的模板写出一行纯文本。只返回 JSON：{"status": "ok" 或 "unreadable", "text": "..."}。

规则：
1. text 只包含小票内容，严格按模板的格式。不要问候、解释、提示或任何其他话。
2. 日期写成模板里的样子。商家名保留小票上的原文，除非词表另有规定。商品名翻译成中文，除非词表另有规定。
3. 每个商品后面写它的价格。折扣也要写出来。
4. "共" 后面写小票上印的总额，不要自己加。金额不带货币符号。最后写付款方式。
5. 整张或大部分看不清：status 为 "unreadable"，text 为 "${UNREADABLE_TEXT}"。不是小票的照片也这样处理。
6. 某个商品完全看不清：在它的位置写 "？？看不清"。商品名看得清、价格看不清：写 "<商品名> 价格？？看不清"。`;

export function buildSystemPrompt(
  settings: Pick<Settings, "template" | "words" | "instructions">
): string {
  const parts = [FIXED_RULES];

  parts.push(
    settings.template
      ? `模板：\n${settings.template.text}`
      : `模板（用户还没有保存模板，按这个例子的格式写）：\n${DEFAULT_TEMPLATE}`
  );

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
