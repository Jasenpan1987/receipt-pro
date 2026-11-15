import { randomUUID } from "node:crypto";

import { DeleteCommand, GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { errorName } from "src/server/repo/errors";
import type { Store } from "src/server/repo/store";

export type Session = {
  sessionId: string;
  /** Incremented on every receipt change; devices compare it to know when to reload (ADR-004). */
  version: number;
  createdAt: string;
  /** The session this one replaced; its data is deleted after the switch, and again next time if that failed. */
  previousSessionId?: string;
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
  return {
    sessionId: Item.sessionId,
    version: Item.version,
    createdAt: Item.createdAt,
    previousSessionId: Item.previousSessionId
  };
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

/**
 * S-06: replaces the current session with an empty one. Written only if the current session is
 * still the one this call read, so two devices pressing at once end with one new session; the
 * loser returns the winner's session and `previous: undefined` (the winner cleans up).
 */
export async function startNewSession(
  store: Store,
  userId: string,
  now = new Date()
): Promise<{ session: Session; previous?: Session }> {
  const previous = await getCurrentSession(store, userId);
  // Version 0 is safe: pages compare the session ID as well as the version (T-005).
  const session: Session = {
    sessionId: randomUUID(),
    version: 0,
    createdAt: now.toISOString(),
    previousSessionId: previous?.sessionId
  };
  try {
    await store.db.send(
      new PutCommand({
        TableName: store.tableName,
        Item: { PK: userPk(userId), SK: CURRENT_SESSION_SK, ...session },
        ...(previous
          ? {
              ConditionExpression: "#sessionId = :old",
              ExpressionAttributeNames: { "#sessionId": "sessionId" },
              ExpressionAttributeValues: { ":old": previous.sessionId }
            }
          : { ConditionExpression: "attribute_not_exists(PK)" })
      })
    );
    return { session, previous };
  } catch (error) {
    if (errorName(error) === "ConditionalCheckFailedException") {
      const winner = await getCurrentSession(store, userId);
      if (winner) {
        return { session: winner };
      }
    }
    throw error;
  }
}

/** Runs `work` over `items`, `limit` at a time. */
async function inParallel<T>(
  items: T[],
  limit: number,
  work: (item: T) => Promise<unknown>
): Promise<void> {
  for (let start = 0; start < items.length; start += limit) {
    await Promise.all(items.slice(start, start + limit).map(work));
  }
}

/**
 * Deletes every item of a session that is no longer current. Safe to repeat: nothing shows a
 * session that is not current, and a second run finds less or nothing. Returns the count.
 */
export async function deleteSessionItems(store: Store, sessionId: string): Promise<number> {
  let deleted = 0;
  let startKey: Record<string, any> | undefined;
  do {
    const page = await store.db.send(
      new QueryCommand({
        TableName: store.tableName,
        KeyConditionExpression: "PK = :pk",
        ExpressionAttributeValues: { ":pk": `SESSION#${sessionId}` },
        ProjectionExpression: "PK, SK",
        ExclusiveStartKey: startKey
      })
    );
    const keys = (page.Items ?? []).map(item => ({ PK: item.PK, SK: item.SK }));
    await inParallel(keys, 10, key =>
      store.db.send(new DeleteCommand({ TableName: store.tableName, Key: key }))
    );
    deleted += keys.length;
    startKey = page.LastEvaluatedKey;
  } while (startKey);
  return deleted;
}
