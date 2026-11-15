// The prompt for turning plain language into one rule (S-08). It sees the current settings with
// their IDs so it can say which instruction a new one replaces; words and templates are matched
// in code (src/server/rules/apply-rule.ts).

import { DEFAULT_TEMPLATE } from "src/server/ai/system-prompt";
import type { Settings } from "src/server/repo/settings";

const RULES = `你帮用户把一句大白话变成一条规则。这是一个记账 app：它把小票照片写成一行文字，用户用规则决定这行文字怎么写。只返回 JSON。

规则有三种：
- "word"：把小票上的某个名字（商家、商品）换一种写法。source 是小票上的写法，target 是以后要写成的样子。例：用户说「以后 Coles 都叫红超市」，返回 {"kind": "word", "source": "Coles", "target": "红超市", "explanation": "..."}。
- "template"：整行文字的格式。用户可能描述格式，也可能贴一条或几条以前的输出。把它们归纳成一条示例行放在 text 里：和当前模板一样，是一行完整的例子，不是说明文字。
- "instruction"：其他处理规则，例如折扣怎么写、某类东西不写。写成一句简短的中文规则放在 text 里。如果它取代下面某条已有的自定义指令，把那条的 id 放在 replaces。
不是规则（问天气、闲聊、提问）：{"kind": "not_a_rule", "explanation": "..."}。

explanation 用一两句大白话告诉用户以后会怎样，不提 JSON、字段这类词。例：「好的，以后小票上的 Coles 我都写成红超市。」
用户可能接着纠正你上一次的理解（例如「不对，付款方式放在日期后面」）。这时根据整段对话，返回修改后的完整规则。`;

export function buildInterpretPrompt(
  settings: Pick<Settings, "template" | "words" | "instructions">
): string {
  const words = settings.words.length
    ? settings.words.map(word => `- ${word.source} → ${word.target}`).join("\n")
    : "（没有）";
  const instructions = settings.instructions.length
    ? settings.instructions
        .map(instruction => `- [${instruction.id}] ${instruction.text}`)
        .join("\n")
    : "（没有）";
  return `${RULES}

当前设置：
模板：
${settings.template?.text ?? DEFAULT_TEMPLATE}
词表：
${words}
自定义指令：
${instructions}`;
}
