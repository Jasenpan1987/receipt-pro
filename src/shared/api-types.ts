// JSON shapes exchanged between the browser and the API. Types only, so both sides can import it.

export type ReceiptStatus = "processing" | "done" | "unreadable" | "failed";

export type ReceiptView = {
  receiptId: string;
  status: ReceiptStatus;
  text?: string;
  error?: string;
  /** Short-lived presigned URL; the bucket is never public. */
  photoUrl: string;
  createdAt: string;
  /** Processing runs started so far; 2 or more while `processing` means regenerating. */
  attempts: number;
};

export type SessionView = {
  /** `null` until the first receipt creates the session. */
  sessionId: string | null;
  version: number;
  /** Newest first. */
  receipts: ReceiptView[];
};

/** `GET /api/session?since=<version>&sessionId=<id>`: nothing new, or the whole session. */
export type SessionPoll = { changed: false } | ({ changed: true } & SessionView);

export type CreateReceiptResponse = { receipt: ReceiptView };

export type ProcessReceiptResponse = { status: ReceiptStatus };

/** `cleaned: false` means the old data is hidden but not yet deleted; the next new session retries. */
export type NewSessionResponse = { sessionId: string; cleaned: boolean };

/** Every API error. `error` is a plain Chinese message the page can show as is. */
export type ApiError = { error: string };

/** What the Add rule dialog proposes. Nothing is saved until the user confirms (S-08). */
export type RuleProposal =
  | { kind: "word"; source: string; target: string; replaces?: string; explanation: string }
  | { kind: "template"; text: string; replaces?: string; explanation: string }
  | { kind: "instruction"; text: string; replaces?: string; explanation: string }
  | { kind: "not_a_rule"; explanation: string };

/** One turn of the dialog's own short conversation; discarded when the dialog closes. */
export type RuleMessage = { role: "user" | "assistant"; text: string };

export type InterpretRuleRequest = { messages: RuleMessage[] };

/** `version` is the settings version the proposal was made against; apply checks it. */
export type InterpretRuleResponse = {
  proposal: RuleProposal;
  version: number;
  /** The saved rule this one replaces, in plain words, if any. */
  replacing?: string;
};

export type ApplyRuleRequest = { proposal: RuleProposal; version: number };
