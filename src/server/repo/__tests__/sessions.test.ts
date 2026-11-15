import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { getOrCreateCurrentSession } from "src/server/repo/sessions";
import type { Store } from "src/server/repo/store";

const NOW = new Date("2026-11-15T10:00:00.000Z");
const existing = {
  PK: "USER#u-1",
  SK: "CURRENT_SESSION",
  sessionId: "s-1",
  version: 4,
  createdAt: "x"
};

function stubStore(handler: (command: unknown, call: number) => unknown) {
  let call = 0;
  const send = vi.fn(async (command: unknown) => handler(command, call++));
  return { store: { db: { send } as unknown as Store["db"], tableName: "receipt-pro" }, send };
}

describe("getOrCreateCurrentSession", () => {
  it("returns the current session when there is one", async () => {
    const { store, send } = stubStore(() => ({ Item: existing }));
    await expect(getOrCreateCurrentSession(store, "u-1", NOW)).resolves.toEqual({
      sessionId: "s-1",
      version: 4,
      createdAt: "x"
    });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("creates the first session only if none exists", async () => {
    const { store, send } = stubStore(command => (command instanceof GetCommand ? {} : {}));
    const session = await getOrCreateCurrentSession(store, "u-1", NOW);
    expect(session).toMatchObject({ version: 0, createdAt: "2026-11-15T10:00:00.000Z" });
    const put = send.mock.calls[1][0] as PutCommand;
    expect(put).toBeInstanceOf(PutCommand);
    expect(put.input).toMatchObject({
      Item: { PK: "USER#u-1", SK: "CURRENT_SESSION", sessionId: session.sessionId, version: 0 },
      ConditionExpression: "attribute_not_exists(PK)"
    });
  });

  // Two uploads at once from two devices must land in the same session.
  it("uses the other request's session when it was created first", async () => {
    const { store } = stubStore((command, call) => {
      if (command instanceof PutCommand) {
        throw Object.assign(new Error("exists"), { name: "ConditionalCheckFailedException" });
      }
      return call === 0 ? {} : { Item: existing };
    });
    await expect(getOrCreateCurrentSession(store, "u-1", NOW)).resolves.toMatchObject({
      sessionId: "s-1"
    });
  });
});
