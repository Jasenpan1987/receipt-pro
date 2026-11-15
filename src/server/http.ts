import type { ApiError } from "src/shared/api-types";

/** An API error the page shows as is. Keep `message` plain Chinese. */
export function errorResponse(status: number, message: string): Response {
  return Response.json({ error: message } satisfies ApiError, { status });
}
