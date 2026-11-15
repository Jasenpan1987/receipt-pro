import { createDeepSeek } from "@ai-sdk/deepseek";
import {
  APICallError,
  generateText,
  jsonSchema,
  type LanguageModel,
  NoObjectGeneratedError,
  Output,
  RetryError
} from "ai";
import { parseReading, type Reading } from "src/server/ai/parse-reading";

export const MODEL_ID = "deepseek-flash";

/** Per try. Two tries stay under the 2-minute limit after which a receipt shows as failed. */
const CALL_TIMEOUT_MS = 45_000;

/** One retry on a blank or unusable reply (architecture.md#ai-call). */
const TRIES = 2;

/** `message` is plain Chinese, stored on the receipt and shown as is. */
export class ReadFailedError extends Error {
  override name = "ReadFailedError";
}

export function deepseekModel(apiKey: string): LanguageModel {
  return createDeepSeek({ apiKey })(MODEL_ID);
}

// Sets JSON mode (`response_format: json_object`); the SDK writes the schema into the system
// message. No `validate`, so the SDK does not judge the object: parseReading does.
const schema = jsonSchema<{ status: string; text: string }>({
  type: "object",
  properties: {
    status: { type: "string", enum: ["ok", "unreadable"] },
    text: { type: "string" }
  },
  required: ["status", "text"]
});

function failureMessage(error: unknown): string {
  const cause = RetryError.isInstance(error) ? error.lastError : error;
  if (APICallError.isInstance(cause)) {
    switch (cause.statusCode) {
      case 401:
        return "DeepSeek 密钥无效，请检查设置。";
      case 402:
        return "DeepSeek 余额不足，请充值后重新生成。";
      case 429:
        return "DeepSeek 太忙，请稍后重新生成。";
    }
  }
  if (cause instanceof Error && (cause.name === "TimeoutError" || cause.name === "AbortError")) {
    return "AI 处理超时，请重新生成。";
  }
  return "AI 服务暂时不可用，请稍后重新生成。";
}

/**
 * Reads one receipt photo (upright JPEG). Each receipt is its own request with no history
 * (ADR-006). Throws ReadFailedError with a message for the user.
 */
export async function readReceipt(input: {
  model: LanguageModel;
  system: string;
  photo: Uint8Array;
}): Promise<Reading> {
  for (let attempt = 1; attempt <= TRIES; attempt++) {
    let reply: string;
    try {
      const result = await generateText({
        model: input.model,
        system: input.system,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "读这张小票。" },
              { type: "file", data: input.photo, mediaType: "image/jpeg" }
            ]
          }
        ],
        output: Output.object({ schema }),
        // T-002: thinking off is about 2 s instead of 3–38 s, and no less accurate (G-007).
        providerOptions: { deepseek: { thinking: { type: "disabled" } } },
        maxRetries: 1,
        abortSignal: AbortSignal.timeout(CALL_TIMEOUT_MS)
      });
      reply = result.text;
    } catch (error) {
      if (!NoObjectGeneratedError.isInstance(error)) {
        throw new ReadFailedError(failureMessage(error), { cause: error });
      }
      // The reply was not one clean JSON object; parseReading decides whether it is usable.
      reply = error.text ?? "";
    }
    const reading = parseReading(reply);
    if (reading) {
      return reading;
    }
  }
  throw new ReadFailedError("AI 返回的内容无法使用，请重新生成。");
}
