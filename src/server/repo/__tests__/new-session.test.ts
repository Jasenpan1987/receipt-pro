import { DeleteCommand, GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { deleteSessionItems, startNewSession } from "src/server/repo/sessions";
import type { Store } from "src/server/repo/store";

const NOW = new Date("2026-11-15T12:00:00.000Z");
const current = {
  PK: "USER#u-1",
  SK: "CURRENT_SESSION",
  sessionId: "s-old",
  version: 9,
  createdAt: "x",
  previousSessionId: "s-older"
};

function stubStore(handler: (command: unknown) => unknown) {
  const send = vi.fn(async (command: unknown) => handler(command));
  return { store: { db: { send } as unknown as Store["db"], tableName: "receipt-pro" }, send };
}

describe("startNewSession", () => {
  it("replaces the current session only if it is still the one read, and remembers it", async () => {
    const { store, send } = stubStore(command =>
      command instanceof GetCommand ? { Item: current } : {}
    );
    const result = await startNewSession(store, "u-1", NOW);
    expect(result.previous).toMatchObject({ sessionId: "s-old", previousSessionId: "s-older" });
    expect(result.session).toMatchObject({ version: 0, createdAt: "2026-11-15T12:00:00.000Z" });
    expect(result.session.sessionId).not.toBe("s-old");
    const put = send.mock.calls[1][0] as PutCommand;
    expect(put.input).toMatchObject({
      Item: { PK: "USER#u-1", SK: "CURRENT_SESSION", version: 0, previousSessionId: "s-old" },
      ConditionExpression: "#sessionId = :old",
      ExpressionAttributeValues: { ":old": "s-old" }
    });
  });

  it("creates the first session when there is none", async () => {
    const { store, send } = stubStore(command => (command instanceof GetCommand ? {} : {}));
    const result = await startNewSession(store, "u-1", NOW);
    expect(result.previous).toBeUndefined();
    expect((send.mock.calls[1][0] as PutCommand).input.ConditionExpression).toBe(
      "attribute_not_exists(PK)"
    );
  });

  // Two devices pressing "新 session" at once must end with one new session.
  it("uses the other device's new session when it won the race", async () => {
    let reads = 0;
    const winner = { ...current, sessionId: "s-winner", version: 0 };
    const { store } = stubStore(command => {
      if (command instanceof PutCommand) {
        throw Object.assign(new Error("changed"), { name: "ConditionalCheckFailedException" });
      }
      return { Item: reads++ === 0 ? current : winner };
    });
    const result = await startNewSession(store, "u-1", NOW);
    expect(result.session.sessionId).toBe("s-winner");
    expect(result.previous).toBeUndefined();
  });
});

describe("deleteSessionItems", () => {
  it("deletes every item of the session, across pages", async () => {
    const { store, send } = stubStore(command => {
      if (command instanceof QueryCommand) {
        return command.input.ExclusiveStartKey
          ? { Items: [{ PK: "SESSION#s-old", SK: "RECEIPT#b" }] }
          : {
              Items: [{ PK: "SESSION#s-old", SK: "RECEIPT#a" }],
              LastEvaluatedKey: { PK: "x", SK: "y" }
            };
      }
      return {};
    });
    await expect(deleteSessionItems(store, "s-old")).resolves.toBe(2);
    const deletes = send.mock.calls
      .map(call => call[0])
      .filter(command => command instanceof DeleteCommand) as DeleteCommand[];
    expect(deletes.map(d => d.input.Key)).toEqual([
      { PK: "SESSION#s-old", SK: "RECEIPT#a" },
      { PK: "SESSION#s-old", SK: "RECEIPT#b" }
    ]);
  });
});
