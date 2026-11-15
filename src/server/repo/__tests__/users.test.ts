import { GetCommand, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import type { Store } from "src/server/repo/store";
import { createUser, getLoginUser, normaliseUsername } from "src/server/repo/users";

function stubStore(handler: (command: unknown) => unknown) {
  const send = vi.fn(async (command: unknown) => handler(command));
  return { store: { db: { send } as unknown as Store["db"], tableName: "receipt-pro" }, send };
}

describe("users", () => {
  it("normalises usernames", () => {
    expect(normaliseUsername("  Jasen ")).toBe("jasen");
  });

  // The account keeps the M1 user ID, so data from before login stays visible (T-012).
  it("creates the profile under the given user ID and a username link, refusing duplicates", async () => {
    const { store, send } = stubStore(() => ({}));
    await createUser(store, { userId: "local-1", username: " Jasen ", passwordHash: "scrypt$..." });
    const [profile, link] =
      (send.mock.calls[0][0] as TransactWriteCommand).input.TransactItems ?? [];
    expect(profile.Put).toMatchObject({
      Item: { PK: "USER#local-1", SK: "PROFILE", username: "Jasen", passwordHash: "scrypt$..." },
      ConditionExpression: "attribute_not_exists(PK)"
    });
    expect(link.Put).toMatchObject({
      Item: { PK: "USERNAME#jasen", SK: "USERNAME", userId: "local-1" }
    });
  });

  it("finds a user by name, whatever the case", async () => {
    const { store, send } = stubStore(command => {
      const key = (command as GetCommand).input.Key;
      if (key?.PK === "USERNAME#jasen") {
        return { Item: { userId: "local-1" } };
      }
      return { Item: { passwordHash: "h", failedLogins: 2 } };
    });
    await expect(getLoginUser(store, "JASEN")).resolves.toEqual({
      userId: "local-1",
      passwordHash: "h",
      failedLogins: 2,
      lockedUntil: undefined
    });
    expect((send.mock.calls[1][0] as GetCommand).input.Key).toEqual({
      PK: "USER#local-1",
      SK: "PROFILE"
    });
  });

  it("finds nobody for an unknown name", async () => {
    const { store } = stubStore(() => ({}));
    await expect(getLoginUser(store, "nobody")).resolves.toBeUndefined();
  });
});
