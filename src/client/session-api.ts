import type { SessionView } from "src/shared/api-types";

export async function fetchSession(): Promise<SessionView> {
  const response = await fetch("/api/session", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`GET /api/session returned ${response.status}`);
  }
  return (await response.json()) as SessionView;
}
