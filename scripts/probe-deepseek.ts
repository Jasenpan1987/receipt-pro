// T-002 probe: sends receipt photos to `deepseek-flash` through the AI SDK and reports, per call,
// whether the image and JSON output both reached DeepSeek, the time, the tokens, blank or
// invalid replies, and the text. The prompt is a draft; T-004 owns the real one.
//
//   pnpm exec tsx --env-file=.env.local scripts/probe-deepseek.ts <photo> [<photo> ...]
//
// Photos are re-encoded the way the app does (upright, JPEG, longest side at most 2048) with
// macOS `sips` and Python's Pillow, which must be installed.
// Each photo runs twice: thinking off, then thinking on (DeepSeek's default). PROBE_THINKING=off|on
// runs one mode; PROBE_PROMPT=checks adds layout and self-check rules.

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

import { createDeepSeek } from "@ai-sdk/deepseek";
import { generateText, jsonSchema, NoObjectGeneratedError, Output } from "ai";
import { getConfig } from "src/server/config";

// The SDK warns that the schema goes into the system message: expected, see T-002 findings.
(globalThis as { AI_SDK_LOG_WARNINGS?: boolean }).AI_SDK_LOG_WARNINGS = false;

const MODEL = "deepseek-flash";
const MAX_SIDE = 2048;

// The builder's usual template (docs/knowledge/business.md#output).
const TEMPLATE = "2026 年 10 月 1 日 Costco 青菜 3.25 水 2.0 啤酒 10.0 共1234，现金";

const SYSTEM = `你读取小票照片，按用户的模板写出一行纯文本。只返回 JSON：{"status": "ok" 或 "unreadable", "text": "..."}。

规则：
1. text 只包含小票内容，严格按模板的格式。不要问候、解释、提示或任何其他话。
2. 日期写成模板里的样子。商家名保留小票上的原文。商品名翻译成中文。
3. 每个商品后面写它的价格。折扣也要写出来。
4. "共" 后面写小票上印的总额，不要自己加。最后写付款方式。
5. 整张或大部分看不清：status 为 "unreadable"，text 为 "看不清，请重拍"。不是小票的照片也这样处理。
6. 某个商品完全看不清：在它的位置写 "？？看不清"。商品名看得清、价格看不清：写 "<商品名> 价格？？看不清"。

模板：
${TEMPLATE}`;

// PROBE_PROMPT=checks adds layout and self-check rules (T-002 experiment for T-004).
const CHECKS = `
补充规则：
7. 一个商品可能占两行（中文名一行、英文名一行），价格只印在其中一行。不要把同一个商品拆成两个。小票上有 Item Count 时，商品数要和它一致。
8. 写完后核对：各商品价格之和应等于小计（Subtotal）。对不上就重新看一遍价格。
9. 日期是澳大利亚格式：日/月/年。"共" 后面只写数字，不带货币符号。`;

const system = () => (process.env.PROBE_PROMPT === "checks" ? SYSTEM + CHECKS : SYSTEM);

// PROBE_THINKING=off|on runs one mode only; default runs both.
const thinkingModes = (): boolean[] =>
  process.env.PROBE_THINKING === "off"
    ? [false]
    : process.env.PROBE_THINKING === "on"
      ? [true]
      : [false, true];

type Reading = { status: "ok" | "unreadable"; text: string };

const schema = jsonSchema<Reading>({
  type: "object",
  properties: {
    status: { type: "string", enum: ["ok", "unreadable"] },
    text: { type: "string" }
  },
  required: ["status", "text"],
  additionalProperties: false
});

function dimensions(path: string): { width: number; height: number } {
  const out = execFileSync("sips", ["-g", "pixelWidth", "-g", "pixelHeight", path], {
    encoding: "utf8"
  });
  const read = (key: string) => Number(new RegExp(`${key}: (\\d+)`).exec(out)?.[1] ?? 0);
  return { width: read("pixelWidth"), height: read("pixelHeight") };
}

// Matches the app's canvas output: pixels turned upright from the EXIF orientation (iPhone
// photos are stored sideways with an orientation tag, and DeepSeek gets raw pixels), longest
// side at most 2048, JPEG quality 85, no EXIF. `sips` decodes HEIC; Pillow rotates and scales.
const NORMALISE = [
  "import sys",
  "from PIL import Image, ImageOps",
  "image = ImageOps.exif_transpose(Image.open(sys.argv[1])).convert('RGB')",
  `image.thumbnail((${MAX_SIDE}, ${MAX_SIDE}))`,
  "image.save(sys.argv[2], 'JPEG', quality=85)"
].join("\n");

function toAppJpeg(
  path: string,
  dir: string
): { bytes: Uint8Array; width: number; height: number } {
  const name = basename(path).replace(/\.[^.]+$/, "");
  const decoded = join(dir, `${name}-full.jpg`);
  const out = join(dir, `${name}.jpg`);
  execFileSync(
    "sips",
    ["-s", "format", "jpeg", "-s", "formatOptions", "100", path, "--out", decoded],
    {
      stdio: "ignore"
    }
  );
  execFileSync("python3", ["-c", NORMALISE, decoded, out]);
  return { bytes: readFileSync(out), ...dimensions(out) };
}

function parseBody(body: unknown): { messages?: unknown; response_format?: unknown } {
  if (typeof body === "string") {
    return JSON.parse(body);
  }
  return (body ?? {}) as { messages?: unknown; response_format?: unknown };
}

async function readReceipt(photo: Uint8Array, thinking: boolean) {
  const deepseek = createDeepSeek({ apiKey: getConfig().deepseekApiKey });
  const started = performance.now();
  try {
    const result = await generateText({
      model: deepseek(MODEL),
      system: system(),
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "读这张小票。" },
            { type: "file", data: photo, mediaType: "image/jpeg" }
          ]
        }
      ],
      output: Output.object({ schema }),
      providerOptions: { deepseek: { thinking: { type: thinking ? "enabled" : "disabled" } } },
      maxRetries: 0,
      include: { requestBody: true }
    });
    const body = parseBody(result.request.body);
    return {
      ms: Math.round(performance.now() - started),
      imagesSent: JSON.stringify(body.messages ?? []).split('"type":"image_url"').length - 1,
      responseFormat: body.response_format,
      raw: result.text,
      reading: result.output,
      tokens: {
        input: result.usage.inputTokens,
        output: result.usage.outputTokens,
        reasoning: result.usage.outputTokenDetails?.reasoningTokens
      }
    };
  } catch (error) {
    return {
      ms: Math.round(performance.now() - started),
      error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
      raw: NoObjectGeneratedError.isInstance(error) ? error.text : undefined
    };
  }
}

async function main() {
  const paths = process.argv.slice(2);
  if (paths.length === 0) {
    throw new Error("Give one or more photo paths.");
  }
  const dir = mkdtempSync(join(tmpdir(), "probe-deepseek-"));
  try {
    for (const path of paths) {
      const photo = toAppJpeg(path, dir);
      console.info(
        `\n=== ${basename(path)}: ${photo.width}x${photo.height}, ${photo.bytes.length} bytes`
      );
      for (const thinking of thinkingModes()) {
        const result = await readReceipt(photo.bytes, thinking);
        console.info(`--- thinking ${thinking ? "on" : "off"}`);
        console.info(JSON.stringify(result, null, 2));
      }
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

await main();
