import { GetCommand, QueryCommand, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { createReceipt, listReceipts, SessionChangedError } from "src/server/repo/receipts";
import type { Store } from "src/server/repo/store";

const NOW = new Date("2026-11-15T10:00:05.000Z");
const session = { sessionId: "s-1", version: 3, createdAt: "2026-11-15T08:00:00.000Z" };
const input = {
  userId: "u-1",
  session,
  receiptId: "r-1",
  createdAt: "2026-11-15T10:00:00.000Z",
  photoKey: "photos/u-1/s-1/r-1.jpg"
};

function stubStore(
  handler: (command: unknown) => unknown
): Store & { send: ReturnType<typeof vi.fn> } {
  const send = vi.fn(async (command: unknown) => handler(command));
  return { db: { send } as unknown as Store["db"], tableName: "receipt-pro", send };
}

function cancelled(codes: string[]) {
  return Object.assign(new Error("Transaction cancelled"), {
    name: "TransactionCanceledException",
    CancellationReasons: codes.map(Code => ({ Code }))
  });
}

describe("createReceipt", () => {
  it("writes the receipt and bumps the session version in one transaction", async () => {
    const store = stubStore(() => ({}));
    const result = await createReceipt(store, input, NOW);

    expect(result).toEqual({
      created: true,
      receipt: {
        receiptId: "r-1",
        userId: "u-1",
        sessionId: "s-1",
        photoKey: "photos/u-1/s-1/r-1.jpg",
        status: "processing",
        attempts: 0,
        createdAt: "2026-11-15T10:00:00.000Z",
        updatedAt: "2026-11-15T10:00:05.000Z"
      }
    });
    expect(store.send).toHaveBeenCalledTimes(1);
    const command = store.send.mock.calls[0][0] as TransactWriteCommand;
    expect(command).toBeInstanceOf(TransactWriteCommand);
    const [put, update] = command.input.TransactItems ?? [];
    expect(put.Put).toMatchObject({
      TableName: "receipt-pro",
      Item: {
        PK: "SESSION#s-1",
        SK: "RECEIPT#2026-11-15T10:00:00.000Z#r-1",
        receiptId: "r-1",
        userId: "u-1",
        photoKey: "photos/u-1/s-1/r-1.jpg",
        status: "processing",
        attempts: 0
      },
      ConditionExpression: "attribute_not_exists(PK)"
    });
    expect(update.Update).toMatchObject({
      Key: { PK: "USER#u-1", SK: "CURRENT_SESSION" },
      ExpressionAttributeValues: { ":one": 1, ":sessionId": "s-1" }
    });
  });

  // Acceptance (builder, 2026-11-15): a retry after a lost response must not add a second receipt.
  it("returns the stored receipt when the same receipt was already saved", async () => {
    const stored = {
      PK: "SESSION#s-1",
      SK: "RECEIPT#2026-11-15T10:00:00.000Z#r-1",
      receiptId: "r-1",
      userId: "u-1",
      photoKey: "photos/u-1/s-1/r-1.jpg",
      status: "processing",
      attempts: 0,
      createdAt: "2026-11-15T10:00:00.000Z",
      updatedAt: "2026-11-15T10:00:01.000Z"
    };
    const store = stubStore(command => {
      if (command instanceof TransactWriteCommand) {
        throw cancelled(["ConditionalCheckFailed", "None"]);
      }
      if (command instanceof GetCommand) {
        return { Item: stored };
      }
      throw new Error("unexpected command");
    });

    const result = await createReceipt(store, input, NOW);
    expect(result.created).toBe(false);
    expect(result.receipt.updatedAt).toBe("2026-11-15T10:00:01.000Z");
    expect(result.receipt.sessionId).toBe("s-1");
  });

  it("reports a session that changed while saving", async () => {
    const store = stubStore(() => {
      throw cancelled(["None", "ConditionalCheckFailed"]);
    });
    await expect(createReceipt(store, input, NOW)).rejects.toThrow(SessionChangedError);
  });

  it("passes other errors through", async () => {
    const store = stubStore(() => {
      throw new Error("ProvisionedThroughputExceeded");
    });
    await expect(createReceipt(store, input, NOW)).rejects.toThrow("ProvisionedThroughputExceeded");
  });
});

describe("listReceipts", () => {
  it("reads every page of the session, newest first", async () => {
    const item = (id: string, at: string) => ({
      PK: "SESSION#s-1",
      SK: `RECEIPT#${at}#${id}`,
      receiptId: id,
      userId: "u-1",
      photoKey: `photos/u-1/s-1/${id}.jpg`,
      status: "processing",
      attempts: 0,
      createdAt: at,
      updatedAt: at
    });
    const store = stubStore(command => {
      const query = command as QueryCommand;
      return query.input.ExclusiveStartKey
        ? { Items: [item("r-1", "2026-11-15T09:00:00.000Z")] }
        : {
            Items: [item("r-2", "2026-11-15T09:30:00.000Z")],
            LastEvaluatedKey: { PK: "x", SK: "y" }
          };
    });

    const receipts = await listReceipts(store, "s-1");
    expect(receipts.map(r => r.receiptId)).toEqual(["r-2", "r-1"]);
    expect(receipts[0].sessionId).toBe("s-1");
    const first = store.send.mock.calls[0][0] as QueryCommand;
    expect(first).toBeInstanceOf(QueryCommand);
    expect(first.input).toMatchObject({
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
      ExpressionAttributeValues: { ":pk": "SESSION#s-1", ":prefix": "RECEIPT#" },
      ScanIndexForward: false,
      ConsistentRead: true
    });
  });
});

describe("processing runs", () => {
  const receipt = {
    receiptId: "r-1",
    userId: "u-1",
    sessionId: "s-1",
    photoKey: "photos/u-1/s-1/r-1.jpg",
    status: "processing" as const,
    attempts: 0,
    createdAt: "2026-11-15T10:00:00.000Z",
    updatedAt: "2026-11-15T10:00:00.000Z"
  };

  it("starts attempt 1 only if no other run started, and bumps the version", async () => {
    const { startAttempt } = await import("src/server/repo/receipts");
    const store = stubStore(() => ({}));
    await expect(startAttempt(store, receipt, NOW)).resolves.toBe(1);
    const [update, bump] =
      (store.send.mock.calls[0][0] as TransactWriteCommand).input.TransactItems ?? [];
    expect(update.Update).toMatchObject({
      Key: { PK: "SESSION#s-1", SK: "RECEIPT#2026-11-15T10:00:00.000Z#r-1" },
      ConditionExpression: "#attempts = :previous",
      ExpressionAttributeValues: { ":attempt": 1, ":previous": 0, ":processing": "processing" }
    });
    expect(bump.Update?.UpdateExpression).toBe("SET #version = #version + :one");
  });

  it("does not start a second run of the same attempt", async () => {
    const { startAttempt } = await import("src/server/repo/receipts");
    const store = stubStore(() => {
      throw cancelled(["ConditionalCheckFailed", "None"]);
    });
    await expect(startAttempt(store, receipt, NOW)).resolves.toBeUndefined();
  });

  it("writes the text of a finished run and clears any old error", async () => {
    const { finishAttempt } = await import("src/server/repo/receipts");
    const store = stubStore(() => ({}));
    await expect(
      finishAttempt(store, receipt, 1, { status: "done", text: "T" }, NOW)
    ).resolves.toBe(true);
    const [update] =
      (store.send.mock.calls[0][0] as TransactWriteCommand).input.TransactItems ?? [];
    expect(update.Update).toMatchObject({
      UpdateExpression: "SET #status = :status, #updatedAt = :now, #text = :text REMOVE #error",
      ConditionExpression: "#attempts = :attempt",
      ExpressionAttributeValues: { ":status": "done", ":text": "T", ":attempt": 1 }
    });
  });

  it("stores no text for an unreadable receipt, so there is nothing to copy", async () => {
    const { finishAttempt } = await import("src/server/repo/receipts");
    const store = stubStore(() => ({}));
    await finishAttempt(store, receipt, 1, { status: "unreadable" }, NOW);
    const [update] =
      (store.send.mock.calls[0][0] as TransactWriteCommand).input.TransactItems ?? [];
    expect(update.Update?.UpdateExpression).toBe(
      "SET #status = :status, #updatedAt = :now REMOVE #text, #error"
    );
  });

  // A slow run must not overwrite a newer one (T-009 regenerate).
  it("drops the outcome of a run that a newer run replaced", async () => {
    const { finishAttempt } = await import("src/server/repo/receipts");
    const store = stubStore(() => {
      throw cancelled(["ConditionalCheckFailed", "None"]);
    });
    await expect(
      finishAttempt(store, receipt, 1, { status: "failed", error: "E" }, NOW)
    ).resolves.toBe(false);
  });
});
