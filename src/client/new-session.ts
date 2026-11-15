import type { ApiError } from "src/shared/api-types";

/** Starts an empty session on the server. Throws with a plain message the page can show. */
export async function startNewSession(): Promise<void> {
  let response: Response;
  try {
    response = await fetch("/api/session/new", {
      method: "POST",
      signal: AbortSignal.timeout(60_000)
    });
  } catch {
    throw new Error("开新 session 失败，请检查网络后重试。");
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => undefined)) as ApiError | undefined;
    throw new Error(body?.error ?? "开新 session 失败，请重试。");
  }
}
