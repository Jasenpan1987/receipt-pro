import { randomUUID } from "node:crypto";

import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { errorName } from "src/server/repo/errors";
import type { Store } from "src/server/repo/store";

export type Session = {
  sessionId: string;
  /** Incremented on every receipt change; devices compare it to know when to reload (ADR-004). */
  version: number;
  createdAt: string;
};

export const userPk = (userId: string) => `USER#${userId}`;
export const CURRENT_SESSION_SK = "CURRENT_SESSION";

export async function getCurrentSession(
  store: Store,
  userId: string
): Promise<Session | undefined> {
  const { Item } = await store.db.send(
    new GetCommand({
      TableName: store.tableName,
      Key: { PK: userPk(userId), SK: CURRENT_SESSION_SK },
      ConsistentRead: true
    })
  );
  if (!Item) {
    return undefined;
  }
  return { sessionId: Item.sessionId, version: Item.version, createdAt: Item.createdAt };
}

/** The user's current session, created on first use. Two devices racing get the same one. */
export async function getOrCreateCurrentSession(
  store: Store,
  userId: string,
  now = new Date()
): Promise<Session> {
  const existing = await getCurrentSession(store, userId);
  if (existing) {
    return existing;
  }
  const session: Session = { sessionId: randomUUID(), version: 0, createdAt: now.toISOString() };
  try {
    await store.db.send(
      new PutCommand({
        TableName: store.tableName,
        Item: { PK: userPk(userId), SK: CURRENT_SESSION_SK, ...session },
        ConditionExpression: "attribute_not_exists(PK)"
      })
    );
    return session;
  } catch (error) {
    if (errorName(error) === "ConditionalCheckFailedException") {
      const winner = await getCurrentSession(store, userId);
      if (winner) {
        return winner;
      }
    }
    throw error;
  }
}
