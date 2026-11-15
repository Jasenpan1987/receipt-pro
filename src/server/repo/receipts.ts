import { GetCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { cancellationCodes } from "src/server/repo/errors";
import { CURRENT_SESSION_SK, type Session, userPk } from "src/server/repo/sessions";
import type { Store } from "src/server/repo/store";
import { sendTransaction } from "src/server/repo/transact";
import type { ReceiptStatus } from "src/shared/api-types";

export type Receipt = {
  receiptId: string;
  userId: string;
  /** From the item's PK; not stored as an attribute. */
  sessionId: string;
  photoKey: string;
  status: ReceiptStatus;
  text?: string;
  error?: string;
  attempts: number;
  createdAt: string;
  updatedAt: string;
};

export type NewReceipt = {
  userId: string;
  session: Session;
  receiptId: string;
  createdAt: string;
  photoKey: string;
};

/** The current session was replaced (T-010) between reading it and saving the receipt. */
export class SessionChangedError extends Error {
  override name = "SessionChangedError";
}

const SESSION_PREFIX = "SESSION#";
const RECEIPT_PREFIX = "RECEIPT#";
const sessionPk = (sessionId: string) => `${SESSION_PREFIX}${sessionId}`;
const receiptSk = (createdAt: string, receiptId: string) =>
  `${RECEIPT_PREFIX}${createdAt}#${receiptId}`;

function toItem(receipt: Receipt) {
  const { sessionId, ...attributes } = receipt;
  return {
    PK: sessionPk(sessionId),
    SK: receiptSk(receipt.createdAt, receipt.receiptId),
    ...attributes
  };
}

function fromItem(item: Record<string, any>): Receipt {
  return {
    receiptId: item.receiptId,
    userId: item.userId,
    sessionId: String(item.PK).slice(SESSION_PREFIX.length),
    photoKey: item.photoKey,
    status: item.status,
    text: item.text,
    error: item.error,
    attempts: item.attempts,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt
  };
}

async function getReceipt(store: Store, sessionId: string, createdAt: string, receiptId: string) {
  const { Item } = await store.db.send(
    new GetCommand({
      TableName: store.tableName,
      Key: { PK: sessionPk(sessionId), SK: receiptSk(createdAt, receiptId) },
      ConsistentRead: true
    })
  );
  return Item ? fromItem(Item) : undefined;
}

/**
 * Saves a new `processing` receipt and bumps the session version in one transaction, so other
 * devices never see one without the other. Safe to repeat: the same `receiptId` and `createdAt`
 * return the stored receipt with `created: false` instead of adding a second one.
 */
export async function createReceipt(
  store: Store,
  input: NewReceipt,
  now = new Date()
): Promise<{ receipt: Receipt; created: boolean }> {
  const receipt: Receipt = {
    receiptId: input.receiptId,
    userId: input.userId,
    sessionId: input.session.sessionId,
    photoKey: input.photoKey,
    status: "processing",
    attempts: 0,
    createdAt: input.createdAt,
    updatedAt: now.toISOString()
  };
  try {
    await sendTransaction(store, {
      TransactItems: [
        {
          Put: {
            TableName: store.tableName,
            Item: toItem(receipt),
            ConditionExpression: "attribute_not_exists(PK)"
          }
        },
        {
          Update: {
            TableName: store.tableName,
            Key: { PK: userPk(input.userId), SK: CURRENT_SESSION_SK },
            UpdateExpression: "SET #version = #version + :one",
            ConditionExpression: "#sessionId = :sessionId",
            ExpressionAttributeNames: { "#version": "version", "#sessionId": "sessionId" },
            ExpressionAttributeValues: { ":one": 1, ":sessionId": input.session.sessionId }
          }
        }
      ]
    });
    return { receipt, created: true };
  } catch (error) {
    const codes = cancellationCodes(error);
    if (codes?.[0] === "ConditionalCheckFailed") {
      const stored = await getReceipt(
        store,
        receipt.sessionId,
        receipt.createdAt,
        receipt.receiptId
      );
      if (stored) {
        return { receipt: stored, created: false };
      }
    }
    if (codes?.[1] === "ConditionalCheckFailed") {
      throw new SessionChangedError(
        "The current session changed while the receipt was being saved."
      );
    }
    throw error;
  }
}

/** Every receipt of the session, newest first. */
export async function listReceipts(store: Store, sessionId: string): Promise<Receipt[]> {
  const receipts: Receipt[] = [];
  let startKey: Record<string, any> | undefined;
  do {
    const page = await store.db.send(
      new QueryCommand({
        TableName: store.tableName,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
        ExpressionAttributeValues: { ":pk": sessionPk(sessionId), ":prefix": RECEIPT_PREFIX },
        ScanIndexForward: false,
        ConsistentRead: true,
        ExclusiveStartKey: startKey
      })
    );
    receipts.push(...(page.Items ?? []).map(fromItem));
    startKey = page.LastEvaluatedKey;
  } while (startKey);
  return receipts;
}

/** A receipt of the session by its ID. The sort key starts with `createdAt`, so this reads the session. */
export async function findReceipt(
  store: Store,
  sessionId: string,
  receiptId: string
): Promise<Receipt | undefined> {
  let startKey: Record<string, any> | undefined;
  do {
    const page = await store.db.send(
      new QueryCommand({
        TableName: store.tableName,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
        FilterExpression: "receiptId = :receiptId",
        ExpressionAttributeValues: {
          ":pk": sessionPk(sessionId),
          ":prefix": RECEIPT_PREFIX,
          ":receiptId": receiptId
        },
        ConsistentRead: true,
        ExclusiveStartKey: startKey
      })
    );
    const item = page.Items?.[0];
    if (item) {
      return fromItem(item);
    }
    startKey = page.LastEvaluatedKey;
  } while (startKey);
  return undefined;
}

/** What one processing run ends with. `unreadable` stores no text, so there is nothing to copy. */
export type Outcome =
  | { status: "done"; text: string }
  | { status: "unreadable" }
  | { status: "failed"; error: string };

function bumpVersion(store: Store, receipt: Receipt) {
  return {
    Update: {
      TableName: store.tableName,
      Key: { PK: userPk(receipt.userId), SK: CURRENT_SESSION_SK },
      UpdateExpression: "SET #version = #version + :one",
      ConditionExpression: "#sessionId = :sessionId",
      ExpressionAttributeNames: { "#version": "version", "#sessionId": "sessionId" },
      ExpressionAttributeValues: { ":one": 1, ":sessionId": receipt.sessionId }
    }
  };
}

/**
 * Starts a processing run: `attempts` + 1, status `processing`, old text and error cleared, and
 * the session version bumped so every device sees it. Returns the run's attempt number, or
 * `undefined` when another run started first.
 */
export async function startAttempt(
  store: Store,
  receipt: Receipt,
  now = new Date()
): Promise<number | undefined> {
  const attempt = receipt.attempts + 1;
  try {
    await sendTransaction(store, {
      TransactItems: [
        {
          Update: {
            TableName: store.tableName,
            Key: {
              PK: sessionPk(receipt.sessionId),
              SK: receiptSk(receipt.createdAt, receipt.receiptId)
            },
            UpdateExpression:
              "SET #status = :processing, #attempts = :attempt, #updatedAt = :now REMOVE #text, #error",
            ConditionExpression: "#attempts = :previous",
            ExpressionAttributeNames: {
              "#status": "status",
              "#attempts": "attempts",
              "#updatedAt": "updatedAt",
              "#text": "text",
              "#error": "error"
            },
            ExpressionAttributeValues: {
              ":processing": "processing",
              ":attempt": attempt,
              ":previous": receipt.attempts,
              ":now": now.toISOString()
            }
          }
        },
        bumpVersion(store, receipt)
      ]
    });
    return attempt;
  } catch (error) {
    const codes = cancellationCodes(error);
    if (codes?.[0] === "ConditionalCheckFailed") {
      return undefined;
    }
    if (codes?.[1] === "ConditionalCheckFailed") {
      throw new SessionChangedError("The current session changed before processing started.");
    }
    throw error;
  }
}

/**
 * Writes a run's outcome and bumps the session version, but only if no newer run has started
 * since (a slow run must not overwrite a newer one). Returns false when the outcome was dropped.
 */
export async function finishAttempt(
  store: Store,
  receipt: Receipt,
  attempt: number,
  outcome: Outcome,
  now = new Date()
): Promise<boolean> {
  const set = ["#status = :status", "#updatedAt = :now"];
  const remove: string[] = [];
  const values: Record<string, unknown> = {
    ":status": outcome.status,
    ":now": now.toISOString(),
    ":attempt": attempt
  };
  if (outcome.status === "done") {
    set.push("#text = :text");
    values[":text"] = outcome.text;
    remove.push("#error");
  } else if (outcome.status === "failed") {
    set.push("#error = :error");
    values[":error"] = outcome.error;
    remove.push("#text");
  } else {
    remove.push("#text", "#error");
  }
  try {
    await sendTransaction(store, {
      TransactItems: [
        {
          Update: {
            TableName: store.tableName,
            Key: {
              PK: sessionPk(receipt.sessionId),
              SK: receiptSk(receipt.createdAt, receipt.receiptId)
            },
            UpdateExpression: `SET ${set.join(", ")} REMOVE ${remove.join(", ")}`,
            ConditionExpression: "#attempts = :attempt",
            ExpressionAttributeNames: {
              "#status": "status",
              "#updatedAt": "updatedAt",
              "#attempts": "attempts",
              "#text": "text",
              "#error": "error"
            },
            ExpressionAttributeValues: values
          }
        },
        bumpVersion(store, receipt)
      ]
    });
    return true;
  } catch (error) {
    // A newer run, or a new session that removed the receipt: this outcome no longer applies.
    if (cancellationCodes(error)?.some(code => code === "ConditionalCheckFailed")) {
      return false;
    }
    throw error;
  }
}
