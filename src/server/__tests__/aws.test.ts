import { GetItemCommand } from "@aws-sdk/client-dynamodb";
import { HeadBucketCommand } from "@aws-sdk/client-s3";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { type CallerIdentitySource, createAwsClients, WrongAwsAccountError } from "src/server/aws";
import type { AwsConfig } from "src/server/config";

// Test account IDs only. The real personal account ID stays in .env.local.
const config: AwsConfig = {
  profile: "receipt-pro",
  accountId: "111111111111",
  region: "ap-southeast-2",
  tableName: "receipt-pro",
  bucketName: "receipt-pro-photos-test"
};

function stubSts(
  ...results: Array<string | Error>
): CallerIdentitySource & { send: ReturnType<typeof vi.fn> } {
  const send = vi.fn();
  for (const result of results) {
    if (result instanceof Error) {
      send.mockRejectedValueOnce(result);
    } else {
      send.mockResolvedValueOnce({ Account: result });
    }
  }
  return { send };
}

// Stands in for the network. Static credentials keep the SDK away from ~/.aws.
function offlineClientConfig() {
  const handle = vi.fn(async () => {
    throw new Error("request reached the network stub");
  });
  return {
    handle,
    clientConfig: {
      credentials: { accessKeyId: "test", secretAccessKey: "test" },
      requestHandler: { handle },
      maxAttempts: 1
    }
  };
}

const getItem = () =>
  new GetItemCommand({ TableName: config.tableName, Key: { PK: { S: "x" }, SK: { S: "x" } } });

describe("assertPersonalAccount", () => {
  it("returns the account when the profile belongs to the personal account", async () => {
    const { assertPersonalAccount } = createAwsClients(config, { sts: stubSts("111111111111") });
    await expect(assertPersonalAccount()).resolves.toBe("111111111111");
  });

  it("refuses a different account with a plain message", async () => {
    const { assertPersonalAccount } = createAwsClients(config, { sts: stubSts("999999999999") });
    const error = await assertPersonalAccount().catch(e => e);
    expect(error).toBeInstanceOf(WrongAwsAccountError);
    expect(error.message).toBe(
      'AWS profile "receipt-pro" belongs to account 999999999999, not RECEIPT_PRO_AWS_ACCOUNT_ID 111111111111. ' +
        "Every AWS call is refused. Check RECEIPT_PRO_AWS_PROFILE and RECEIPT_PRO_AWS_ACCOUNT_ID in .env.local."
    );
  });

  it("calls STS once for many checks", async () => {
    const sts = stubSts("111111111111");
    const { assertPersonalAccount } = createAwsClients(config, { sts });
    await Promise.all([assertPersonalAccount(), assertPersonalAccount()]);
    await assertPersonalAccount();
    expect(sts.send).toHaveBeenCalledTimes(1);
  });

  it("keeps refusing a wrong account without asking STS again", async () => {
    const sts = stubSts("999999999999");
    const { assertPersonalAccount } = createAwsClients(config, { sts });
    await expect(assertPersonalAccount()).rejects.toThrow(WrongAwsAccountError);
    await expect(assertPersonalAccount()).rejects.toThrow(WrongAwsAccountError);
    expect(sts.send).toHaveBeenCalledTimes(1);
  });

  it("asks STS again after a network error", async () => {
    const sts = stubSts(
      new Error("getaddrinfo ENOTFOUND sts.ap-southeast-2.amazonaws.com"),
      "111111111111"
    );
    const { assertPersonalAccount } = createAwsClients(config, { sts });
    await expect(assertPersonalAccount()).rejects.toThrow("ENOTFOUND");
    await expect(assertPersonalAccount()).resolves.toBe("111111111111");
    expect(sts.send).toHaveBeenCalledTimes(2);
  });
});

describe("account guard on every client", () => {
  it("stops a DynamoDB call before it is sent when the account is wrong", async () => {
    const { handle, clientConfig } = offlineClientConfig();
    const { dynamodb } = createAwsClients(config, { sts: stubSts("999999999999"), clientConfig });
    await expect(dynamodb.send(getItem())).rejects.toThrow(WrongAwsAccountError);
    expect(handle).not.toHaveBeenCalled();
  });

  it("stops an S3 call before it is sent when the account is wrong", async () => {
    const { handle, clientConfig } = offlineClientConfig();
    const { s3 } = createAwsClients(config, { sts: stubSts("999999999999"), clientConfig });
    await expect(s3.send(new HeadBucketCommand({ Bucket: config.bucketName }))).rejects.toThrow(
      WrongAwsAccountError
    );
    expect(handle).not.toHaveBeenCalled();
  });

  it("stops a document-client call before it is sent when the account is wrong", async () => {
    const { handle, clientConfig } = offlineClientConfig();
    const { db } = createAwsClients(config, { sts: stubSts("999999999999"), clientConfig });
    await expect(
      db.send(new GetCommand({ TableName: config.tableName, Key: { PK: "x", SK: "x" } }))
    ).rejects.toThrow(WrongAwsAccountError);
    expect(handle).not.toHaveBeenCalled();
  });

  it("lets the call through when the account is right", async () => {
    const { handle, clientConfig } = offlineClientConfig();
    const { dynamodb } = createAwsClients(config, { sts: stubSts("111111111111"), clientConfig });
    await expect(dynamodb.send(getItem())).rejects.toThrow("request reached the network stub");
    expect(handle).toHaveBeenCalledTimes(1);
  });
});

describe("client settings", () => {
  // Acceptance: with another AWS_PROFILE set in the shell, the clients use the personal profile.
  it("uses the configured profile and region, not AWS_PROFILE or AWS_REGION", async () => {
    vi.stubEnv("AWS_PROFILE", "another-profile");
    vi.stubEnv("AWS_REGION", "us-east-1");
    try {
      const { clientConfig } = offlineClientConfig();
      const { dynamodb, s3 } = createAwsClients(config, { sts: stubSts(), clientConfig });
      for (const client of [dynamodb, s3]) {
        expect(client.config.profile).toBe("receipt-pro");
        await expect(client.config.region()).resolves.toBe("ap-southeast-2");
      }
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
