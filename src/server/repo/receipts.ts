import { GetCommand, QueryCommand, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { cancellationCodes } from "src/server/repo/errors";
import { CURRENT_SESSION_SK, type Session, userPk } from "src/server/repo/sessions";
import type { Store } from "src/server/repo/store";
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
    await store.db.send(
      new TransactWriteCommand({
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
      })
    );
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
