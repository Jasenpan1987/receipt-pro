import { APICallError } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { UNREADABLE_TEXT } from "src/server/ai/parse-reading";
import { ReadFailedError, readReceipt } from "src/server/ai/read-receipt";

const TEXT = "2026 年 10 月 1 日 Costco 青菜 3.25 共3.25，现金";
const photo = new Uint8Array([0xff, 0xd8, 0xff]);

function reply(text: string) {
  return {
    content: [{ type: "text" as const, text }],
    finishReason: { unified: "stop" as const, raw: undefined },
    usage: {
      inputTokens: { total: 1300, noCache: 1300, cacheRead: undefined, cacheWrite: undefined },
      outputTokens: { total: 90, text: 90, reasoning: undefined }
    },
    warnings: []
  };
}

const model = (...replies: string[]) => new MockLanguageModelV4({ doGenerate: replies.map(reply) });

describe("readReceipt", () => {
  it("sends the photo in JSON mode with thinking off", async () => {
    const mock = model(JSON.stringify({ status: "ok", text: TEXT }));
    await expect(readReceipt({ model: mock, system: "RULES", photo })).resolves.toEqual({
      status: "ok",
      text: TEXT
    });

    const call = mock.doGenerateCalls[0];
    expect(call.responseFormat?.type).toBe("json");
    expect(call.providerOptions).toEqual({ deepseek: { thinking: { type: "disabled" } } });
    // Builder review, 2026-11-15: the same receipt read twice must not come out two ways.
    expect(call.temperature).toBe(0);
    expect(call.prompt[0]).toMatchObject({ role: "system", content: "RULES" });
    expect(JSON.stringify(call.prompt[1])).toContain('"mediaType":"image/jpeg"');
  });

  // Acceptance (T-004): only `text` survives conversational text around the JSON.
  it("keeps only the text when the model adds a sentence after the JSON", async () => {
    const mock = model(
      `${JSON.stringify({ status: "ok", text: TEXT })}\n好，这张弄完了，请发下一张`
    );
    await expect(readReceipt({ model: mock, system: "RULES", photo })).resolves.toEqual({
      status: "ok",
      text: TEXT
    });
    expect(mock.doGenerateCalls).toHaveLength(1);
  });

  // The T-002 shape: two different answers. Retry once.
  it("retries once after an unusable reply", async () => {
    const twoAnswers = `${JSON.stringify({ status: "ok", text: TEXT })}\n校对……\n${JSON.stringify({ status: "unreadable", text: "x" })}`;
    const mock = model(twoAnswers, JSON.stringify({ status: "ok", text: TEXT }));
    await expect(readReceipt({ model: mock, system: "RULES", photo })).resolves.toEqual({
      status: "ok",
      text: TEXT
    });
    expect(mock.doGenerateCalls).toHaveLength(2);
  });

  it("gives up after a second unusable reply", async () => {
    const mock = model("", "   ");
    const error = await readReceipt({ model: mock, system: "RULES", photo }).catch(e => e);
    expect(error).toBeInstanceOf(ReadFailedError);
    expect(error.message).toBe("AI 返回的内容无法使用，请重新生成。");
    expect(mock.doGenerateCalls).toHaveLength(2);
  });

  it("returns the fixed message for an unreadable receipt", async () => {
    const mock = model(JSON.stringify({ status: "unreadable", text: "太模糊" }));
    await expect(readReceipt({ model: mock, system: "RULES", photo })).resolves.toEqual({
      status: "unreadable",
      text: UNREADABLE_TEXT
    });
  });

  // Acceptance (T-004): an invalid DEEPSEEK_API_KEY gives `failed` with a plain message.
  it.each([
    [401, "DeepSeek 密钥无效，请检查设置。"],
    [402, "DeepSeek 余额不足，请充值后重新生成。"],
    [429, "DeepSeek 太忙，请稍后重新生成。"],
    [500, "AI 服务暂时不可用，请稍后重新生成。"]
  ])("turns HTTP %i from DeepSeek into a plain message", async (statusCode, message) => {
    const mock = new MockLanguageModelV4({
      doGenerate: async () => {
        throw new APICallError({
          message: "DeepSeek error",
          url: "https://api.deepseek.com/chat/completions",
          requestBodyValues: {},
          statusCode,
          isRetryable: false
        });
      }
    });
    await expect(readReceipt({ model: mock, system: "RULES", photo })).rejects.toThrow(message);
  });

  it("reports a timeout plainly", async () => {
    const mock = new MockLanguageModelV4({
      doGenerate: async () => {
        throw new DOMException("The operation timed out.", "TimeoutError");
      }
    });
    await expect(readReceipt({ model: mock, system: "RULES", photo })).rejects.toThrow(
      "AI 处理超时，请重新生成。"
    );
  });
});
