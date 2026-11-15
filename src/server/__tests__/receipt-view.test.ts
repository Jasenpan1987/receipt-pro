import { createAwsClients } from "src/server/aws";
import { toReceiptView } from "src/server/receipt-view";
import type { Receipt } from "src/server/repo/receipts";

const config = {
  profile: "receipt-pro",
  accountId: "111111111111",
  region: "ap-southeast-2",
  tableName: "receipt-pro",
  bucketName: "receipt-pro-photos-test"
};
const { s3 } = createAwsClients(config, {
  sts: { send: async () => ({ Account: "111111111111" }) },
  clientConfig: { credentials: { accessKeyId: "test", secretAccessKey: "test" } }
});

const NOW = new Date("2026-11-15T10:00:00.000Z");
const receipt = (
  status: Receipt["status"],
  updatedAt: string,
  extra: Partial<Receipt> = {}
): Receipt => ({
  receiptId: "r-1",
  userId: "u-1",
  sessionId: "s-1",
  photoKey: "photos/u-1/s-1/r-1.jpg",
  status,
  attempts: 1,
  createdAt: "2026-11-15T09:50:00.000Z",
  updatedAt,
  ...extra
});

describe("toReceiptView", () => {
  it("shows a receipt that is still being processed", async () => {
    const view = await toReceiptView(
      receipt("processing", "2026-11-15T09:58:30.000Z"),
      s3,
      config.bucketName,
      NOW
    );
    expect(view.status).toBe("processing");
  });

  // architecture.md#data-model: nothing hangs forever.
  it("shows a receipt stuck in processing for more than 2 minutes as failed", async () => {
    const view = await toReceiptView(
      receipt("processing", "2026-11-15T09:57:59.000Z"),
      s3,
      config.bucketName,
      NOW
    );
    expect(view).toMatchObject({ status: "failed", error: "处理超时，请重新生成。" });
  });

  it("passes done receipts through with their text", async () => {
    const view = await toReceiptView(
      receipt("done", "2026-11-15T09:00:00.000Z", { text: "T" }),
      s3,
      config.bucketName,
      NOW
    );
    expect(view).toMatchObject({ status: "done", text: "T" });
  });
});
