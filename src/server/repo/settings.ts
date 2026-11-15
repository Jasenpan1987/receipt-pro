import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { errorName } from "src/server/repo/errors";
import { userPk } from "src/server/repo/sessions";
import type { Store } from "src/server/repo/store";

export type WordEntry = { id: string; source: string; target: string; updatedAt: string };
export type Instruction = { id: string; text: string; updatedAt: string };

/** One item per user: every AI call reads all of it (architecture.md#data-model). */
export type Settings = {
  template?: { text: string; updatedAt: string };
  words: WordEntry[];
  instructions: Instruction[];
  /** For conditional writes from the rules pages (M2). */
  version: number;
};

const SETTINGS_SK = "SETTINGS";

export async function getSettings(store: Store, userId: string): Promise<Settings> {
  const { Item } = await store.db.send(
    new GetCommand({
      TableName: store.tableName,
      Key: { PK: userPk(userId), SK: SETTINGS_SK },
      ConsistentRead: true
    })
  );
  return {
    template: Item?.template,
    words: Item?.words ?? [],
    instructions: Item?.instructions ?? [],
    version: Item?.version ?? 0
  };
}

/**
 * S-03 criterion 7: with no template yet, the first output becomes the template. Only saves
 * when there is still none, so two receipts finishing together cannot both set it.
 * Returns whether this call saved it.
 */
export async function saveTemplateIfMissing(
  store: Store,
  userId: string,
  text: string,
  now = new Date()
): Promise<boolean> {
  try {
    await store.db.send(
      new UpdateCommand({
        TableName: store.tableName,
        Key: { PK: userPk(userId), SK: SETTINGS_SK },
        UpdateExpression:
          "SET #template = :template, #version = if_not_exists(#version, :zero) + :one, " +
          "#words = if_not_exists(#words, :empty), #instructions = if_not_exists(#instructions, :empty)",
        ConditionExpression: "attribute_not_exists(#template)",
        ExpressionAttributeNames: {
          "#template": "template",
          "#version": "version",
          "#words": "words",
          "#instructions": "instructions"
        },
        ExpressionAttributeValues: {
          ":template": { text, updatedAt: now.toISOString() },
          ":zero": 0,
          ":one": 1,
          ":empty": []
        }
      })
    );
    return true;
  } catch (error) {
    if (errorName(error) === "ConditionalCheckFailedException") {
      return false;
    }
    throw error;
  }
}
