import type {
  ApiError,
  ApplyRuleRequest,
  InterpretRuleResponse,
  RuleMessage,
  RuleProposal
} from "src/shared/api-types";

async function post<T>(url: string, body: unknown, fallback: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(70_000)
    });
  } catch {
    throw new Error("连不上服务器，请检查网络后重试。");
  }
  if (!response.ok) {
    const error = (await response.json().catch(() => undefined)) as ApiError | undefined;
    throw new Error(error?.error ?? fallback);
  }
  return (await response.json()) as T;
}

/** One turn of the dialog. Saves nothing. */
export function interpretRule(messages: RuleMessage[]): Promise<InterpretRuleResponse> {
  return post("/api/rules/interpret", { messages }, "出错了，请重试。");
}

/** Saves a confirmed rule, if the settings are still `version`. */
export async function applyRule(proposal: RuleProposal, version: number): Promise<void> {
  await post(
    "/api/rules/apply",
    { proposal, version } satisfies ApplyRuleRequest,
    "保存失败，请重试。"
  );
}
