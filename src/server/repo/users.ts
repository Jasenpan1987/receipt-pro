import {
  DeleteCommand,
  GetCommand,
  TransactWriteCommand,
  UpdateCommand
} from "@aws-sdk/lib-dynamodb";
import type { LoginUser } from "src/server/auth/login-check";
import { userPk } from "src/server/repo/sessions";
import type { Store } from "src/server/repo/store";

const PROFILE_SK = "PROFILE";
const USERNAME_SK = "USERNAME";

/** Usernames are matched trimmed and case-folded. */
export function normaliseUsername(username: string): string {
  return username.trim().toLowerCase();
}

const usernamePk = (username: string) => `USERNAME#${normaliseUsername(username)}`;

/**
 * The one account (no sign-up page, T-012): the `PROFILE` item and a `USERNAME#<name>` item that
 * finds it by name, in one transaction, refused if either exists.
 */
export async function createUser(
  store: Store,
  input: { userId: string; username: string; passwordHash: string },
  now = new Date()
): Promise<void> {
  await store.db.send(
    new TransactWriteCommand({
      TransactItems: [
        {
          Put: {
            TableName: store.tableName,
            Item: {
              PK: userPk(input.userId),
              SK: PROFILE_SK,
              username: input.username.trim(),
              passwordHash: input.passwordHash,
              failedLogins: 0,
              createdAt: now.toISOString()
            },
            ConditionExpression: "attribute_not_exists(PK)"
          }
        },
        {
          Put: {
            TableName: store.tableName,
            Item: { PK: usernamePk(input.username), SK: USERNAME_SK, userId: input.userId },
            ConditionExpression: "attribute_not_exists(PK)"
          }
        }
      ]
    })
  );
}

export async function getLoginUser(store: Store, username: string): Promise<LoginUser | undefined> {
  const { Item: link } = await store.db.send(
    new GetCommand({
      TableName: store.tableName,
      Key: { PK: usernamePk(username), SK: USERNAME_SK },
      ConsistentRead: true
    })
  );
  if (!link) {
    return undefined;
  }
  const { Item: profile } = await store.db.send(
    new GetCommand({
      TableName: store.tableName,
      Key: { PK: userPk(link.userId), SK: PROFILE_SK },
      ConsistentRead: true
    })
  );
  if (!profile) {
    return undefined;
  }
  return {
    userId: link.userId,
    passwordHash: profile.passwordHash,
    failedLogins: profile.failedLogins ?? 0,
    lockedUntil: profile.lockedUntil
  };
}

/** Stores a wrong password's count, and the lock when it reached the limit. */
export async function recordLoginFailure(
  store: Store,
  userId: string,
  failures: number,
  lockUntil?: number
): Promise<void> {
  await store.db.send(
    new UpdateCommand({
      TableName: store.tableName,
      Key: { PK: userPk(userId), SK: PROFILE_SK },
      UpdateExpression:
        lockUntil !== undefined
          ? "SET failedLogins = :f, lockedUntil = :l"
          : "SET failedLogins = :f REMOVE lockedUntil",
      ExpressionAttributeValues:
        lockUntil !== undefined ? { ":f": failures, ":l": lockUntil } : { ":f": failures },
      ConditionExpression: "attribute_exists(PK)"
    })
  );
}

export async function clearLoginFailures(store: Store, userId: string): Promise<void> {
  await store.db.send(
    new UpdateCommand({
      TableName: store.tableName,
      Key: { PK: userPk(userId), SK: PROFILE_SK },
      UpdateExpression: "SET failedLogins = :zero REMOVE lockedUntil",
      ExpressionAttributeValues: { ":zero": 0 },
      ConditionExpression: "attribute_exists(PK)"
    })
  );
}

/** For test users only (scripts/delete-test-user.ts). */
export async function deleteUser(store: Store, userId: string): Promise<void> {
  const { Item: profile } = await store.db.send(
    new GetCommand({ TableName: store.tableName, Key: { PK: userPk(userId), SK: PROFILE_SK } })
  );
  if (profile?.username) {
    await store.db.send(
      new DeleteCommand({
        TableName: store.tableName,
        Key: { PK: usernamePk(profile.username), SK: USERNAME_SK }
      })
    );
  }
  await store.db.send(
    new DeleteCommand({ TableName: store.tableName, Key: { PK: userPk(userId), SK: PROFILE_SK } })
  );
}
