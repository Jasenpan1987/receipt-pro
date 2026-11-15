// Deletes a test user's current session, receipts, settings, and photos. Refuses any user whose ID does
// not start with "smoke-test-", so the real user's data cannot be deleted by mistake.
//
//   LOCAL_USER_ID=smoke-test-<uuid> pnpm exec tsx --env-file=.env.local scripts/delete-test-user.ts
//
// Shell variables win over .env.local, so LOCAL_USER_ID on the command line selects the user.

import { DeleteObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { DeleteCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { getAws } from "src/server/aws";
import { getAwsConfig } from "src/server/config";
import { CURRENT_SESSION_SK, getCurrentSession, userPk } from "src/server/repo/sessions";
import { getStore } from "src/server/repo/store";

const TEST_PREFIX = "smoke-test-";

async function main() {
  const userId = process.env.LOCAL_USER_ID ?? "";
  if (!userId.startsWith(TEST_PREFIX)) {
    throw new Error(`Refusing: LOCAL_USER_ID does not start with "${TEST_PREFIX}".`);
  }
  const { db, s3 } = getAws();
  const { tableName, bucketName } = getAwsConfig();

  let items = 0;
  const session = await getCurrentSession(getStore(), userId);
  if (session) {
    let startKey: Record<string, any> | undefined;
    do {
      const page = await db.send(
        new QueryCommand({
          TableName: tableName,
          KeyConditionExpression: "PK = :pk",
          ExpressionAttributeValues: { ":pk": `SESSION#${session.sessionId}` },
          ExclusiveStartKey: startKey
        })
      );
      for (const item of page.Items ?? []) {
        await db.send(
          new DeleteCommand({ TableName: tableName, Key: { PK: item.PK, SK: item.SK } })
        );
        items++;
      }
      startKey = page.LastEvaluatedKey;
    } while (startKey);
    await db.send(
      new DeleteCommand({
        TableName: tableName,
        Key: { PK: userPk(userId), SK: CURRENT_SESSION_SK }
      })
    );
    items++;
  }

  // The settings item exists once a first output was saved as the template (T-004).
  await db.send(
    new DeleteCommand({ TableName: tableName, Key: { PK: userPk(userId), SK: "SETTINGS" } })
  );
  items++;

  let photos = 0;
  let token: string | undefined;
  do {
    const page = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucketName,
        Prefix: `photos/${userId}/`,
        ContinuationToken: token
      })
    );
    for (const object of page.Contents ?? []) {
      await s3.send(new DeleteObjectCommand({ Bucket: bucketName, Key: object.Key }));
      photos++;
    }
    token = page.NextContinuationToken;
  } while (token);

  console.info(`Deleted ${items} items and ${photos} photos for ${userId}.`);
}

await main();
