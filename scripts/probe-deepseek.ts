// T-002 probe: sends receipt photos to `deepseek-flash` through the AI SDK and reports, per call,
// whether the image and JSON output both reached DeepSeek, the time, the tokens, blank or
// invalid replies, and the text. It uses the app's prompt (src/server/ai/system-prompt.ts).
//
//   pnpm exec tsx --env-file=.env.local scripts/probe-deepseek.ts <photo> [<photo> ...]
//
// Photos are re-encoded the way the app does (upright, JPEG, longest side at most 2048) with
// macOS `sips` and Python's Pillow, which must be installed.
// Each photo runs twice: thinking off, then thinking on (DeepSeek's default). PROBE_THINKING=off|on
// runs one mode.

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

import { createDeepSeek } from "@ai-sdk/deepseek";
import { generateText, jsonSchema, NoObjectGeneratedError, Output } from "ai";
import { buildSystemPrompt } from "src/server/ai/system-prompt";
import { getConfig } from "src/server/config";

// The SDK warns that the schema goes into the system message: expected, see T-002 findings.
(globalThis as { AI_SDK_LOG_WARNINGS?: boolean }).AI_SDK_LOG_WARNINGS = false;

const MODEL = "deepseek-flash";
const MAX_SIDE = 2048;

// The app's own prompt with no saved settings, so the probe measures what users get.
const system = () => buildSystemPrompt({ words: [], instructions: [] });

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
      // Reading a receipt has one right answer: no sampling randomness, so the same photo gives
      // the same text (DeepSeek defaults to 1.0).
      temperature: 0,
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
