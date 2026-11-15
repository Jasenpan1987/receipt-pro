import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { saveSettings, SettingsChangedError } from "src/server/repo/settings";
import type { Store } from "src/server/repo/store";

function stubStore(handler: () => unknown) {
  const send = vi.fn(async (_command: unknown) => handler());
  return { store: { db: { send } as unknown as Store["db"], tableName: "receipt-pro" }, send };
}
const next = { template: { text: "T", updatedAt: "x" }, words: [], instructions: [] };

describe("saveSettings", () => {
  it("writes only if the version is still the one read, and raises it", async () => {
    const { store, send } = stubStore(() => ({}));
    await saveSettings(store, "u-1", next, 3);
    const input = (send.mock.calls[0][0] as UpdateCommand).input;
    expect(input.ConditionExpression).toBe("#version = :expected");
    expect(input.ExpressionAttributeValues).toMatchObject({ ":expected": 3, ":next": 4 });
    expect(input.UpdateExpression).toBe(
      "SET #words = :words, #instructions = :instructions, #version = :next, #template = :template"
    );
  });

  it("creates the settings item when there is none yet", async () => {
    const { store, send } = stubStore(() => ({}));
    await saveSettings(store, "u-1", { ...next, template: undefined }, 0);
    const input = (send.mock.calls[0][0] as UpdateCommand).input;
    expect(input.ConditionExpression).toBe("attribute_not_exists(PK)");
    expect(input.UpdateExpression).toContain("REMOVE #template");
  });

  // Two devices saving rules at once: the second must re-confirm, not overwrite.
  it("reports settings changed by someone else", async () => {
    const { store } = stubStore(() => {
      throw Object.assign(new Error("x"), { name: "ConditionalCheckFailedException" });
    });
    await expect(saveSettings(store, "u-1", next, 3)).rejects.toThrow(SettingsChangedError);
  });
});
