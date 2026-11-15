// Turns DeepSeek's reply into the one thing the app keeps: `text`. The guard against
// conversational text that ADR-002 left to the prompt lives here, in code.

/** business.md#unreadable-receipts: the whole receipt, or most of it, cannot be read. */
export const UNREADABLE_TEXT = "看不清，请重拍";

export type Reading = { status: "ok" | "unreadable"; text: string };

/**
 * Every top-level `{...}` in the reply that parses as JSON. Braces inside JSON strings are
 * skipped, so a `{` in an item name does not split an object.
 */
function jsonObjects(reply: string): unknown[] {
  const found: unknown[] = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  let escaped = false;
  for (let i = 0; i < reply.length; i++) {
    const char = reply[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }
    if (char === '"' && depth > 0) {
      inString = true;
    } else if (char === "{") {
      if (depth === 0) {
        start = i;
      }
      depth++;
    } else if (char === "}" && depth > 0) {
      depth--;
      if (depth === 0) {
        try {
          found.push(JSON.parse(reply.slice(start, i + 1)));
        } catch {
          // Not JSON after all; ignore it.
        }
      }
    }
  }
  return found;
}

/** The reply's only JSON object, or `undefined` when there is none or more than one. */
export function singleJsonObject(reply: string): Record<string, unknown> | undefined {
  const objects = jsonObjects(reply);
  const value = objects.length === 1 ? objects[0] : undefined;
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

/**
 * The reading, or `undefined` when the reply cannot be trusted. Exactly one JSON object is
 * accepted, and any text around it is dropped. Two or more objects (seen in T-002: an answer,
 * a self-check in prose, then a different answer) are refused, so the caller retries. Extra
 * fields are ignored; only `status` and `text` are read.
 */
export function parseReading(reply: string): Reading | undefined {
  const value = singleJsonObject(reply);
  if (!value) {
    return undefined;
  }
  if (value.status === "unreadable") {
    return { status: "unreadable", text: UNREADABLE_TEXT };
  }
  if (value.status !== "ok" || typeof value.text !== "string") {
    return undefined;
  }
  // One line for Word: line breaks become single spaces.
  const text = value.text.replace(/\s*[\r\n]+\s*/g, " ").trim();
  return text ? { status: "ok", text } : undefined;
}
