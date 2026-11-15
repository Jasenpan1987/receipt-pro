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

/** The settings changed since they were read (another device saved a rule). */
export class SettingsChangedError extends Error {
  override name = "SettingsChangedError";
}

/**
 * Writes template, words, and instructions, and raises the version, only if the version is still
 * `expectedVersion` (0: no settings item yet). Throws SettingsChangedError otherwise.
 */
export async function saveSettings(
  store: Store,
  userId: string,
  settings: Pick<Settings, "template" | "words" | "instructions">,
  expectedVersion: number
): Promise<void> {
  const names: Record<string, string> = {
    "#words": "words",
    "#instructions": "instructions",
    "#version": "version",
    "#template": "template"
  };
  const values: Record<string, unknown> = {
    ":words": settings.words,
    ":instructions": settings.instructions,
    ":next": expectedVersion + 1
  };
  const set = ["#words = :words", "#instructions = :instructions", "#version = :next"];
  if (settings.template) {
    set.push("#template = :template");
    values[":template"] = settings.template;
  }
  let condition = "attribute_not_exists(PK)";
  if (expectedVersion > 0) {
    condition = "#version = :expected";
    values[":expected"] = expectedVersion;
  }
  try {
    await store.db.send(
      new UpdateCommand({
        TableName: store.tableName,
        Key: { PK: userPk(userId), SK: SETTINGS_SK },
        UpdateExpression: `SET ${set.join(", ")}${settings.template ? "" : " REMOVE #template"}`,
        ConditionExpression: condition,
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values
      })
    );
  } catch (error) {
    if (errorName(error) === "ConditionalCheckFailedException") {
      throw new SettingsChangedError("The settings changed since they were read.");
    }
    throw error;
  }
}
