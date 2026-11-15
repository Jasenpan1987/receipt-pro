import { ConfigError, parseAwsConfig, parseConfig } from "src/server/config";

// Test account IDs only. The real personal account ID stays in .env.local.
const fullEnv = {
  RECEIPT_PRO_AWS_PROFILE: "receipt-pro",
  RECEIPT_PRO_AWS_ACCOUNT_ID: "111111111111",
  AWS_REGION: "ap-southeast-2",
  TABLE_NAME: "receipt-pro",
  BUCKET_NAME: "receipt-pro-photos-test",
  DEEPSEEK_API_KEY: "sk-test",
  SESSION_SECRET: "s".repeat(32),
  LOCAL_USER_ID: "user-1"
};

describe("parseConfig", () => {
  it("reads every variable", () => {
    expect(parseConfig(fullEnv)).toEqual({
      aws: {
        profile: "receipt-pro",
        accountId: "111111111111",
        region: "ap-southeast-2",
        tableName: "receipt-pro",
        bucketName: "receipt-pro-photos-test"
      },
      deepseekApiKey: "sk-test",
      sessionSecret: "s".repeat(32),
      localUserId: "user-1"
    });
  });

  it("names the one missing variable", () => {
    const { DEEPSEEK_API_KEY: _, ...env } = fullEnv;
    expect(() => parseConfig(env)).toThrow(ConfigError);
    expect(() => parseConfig(env)).toThrow(
      "Missing environment variable: DEEPSEEK_API_KEY. Set it in .env.local (see .env.example)."
    );
  });

  it("names every missing variable at once", () => {
    const { TABLE_NAME: _t, SESSION_SECRET: _l, ...env } = fullEnv;
    expect(() => parseConfig(env)).toThrow(
      "Missing environment variables: TABLE_NAME, SESSION_SECRET. Set them in .env.local (see .env.example)."
    );
  });

  it("treats a blank value as missing", () => {
    expect(() => parseConfig({ ...fullEnv, BUCKET_NAME: "   " })).toThrow(
      "Missing environment variable: BUCKET_NAME."
    );
  });

  it("rejects an account ID that is not 12 digits", () => {
    expect(() => parseConfig({ ...fullEnv, RECEIPT_PRO_AWS_ACCOUNT_ID: "12345" })).toThrow(
      'RECEIPT_PRO_AWS_ACCOUNT_ID must be a 12-digit AWS account ID, got "12345".'
    );
  });

  it("refuses a session secret shorter than 32 characters", () => {
    expect(() => parseConfig({ ...fullEnv, SESSION_SECRET: "short" })).toThrow(
      "SESSION_SECRET must be at least 32 characters."
    );
  });

  it("does not need LOCAL_USER_ID", () => {
    const { LOCAL_USER_ID: _, ...env } = fullEnv;
    expect(parseConfig(env).localUserId).toBeUndefined();
  });

  // The shell may set AWS_PROFILE to another profile; it must never decide the app's profile.
  it("ignores AWS_PROFILE", () => {
    const config = parseConfig({ ...fullEnv, AWS_PROFILE: "another-profile" });
    expect(config.aws.profile).toBe("receipt-pro");
  });
});

describe("parseAwsConfig", () => {
  // `pnpm check:aws` must run before the builder has added the DeepSeek key.
  it("does not need the DeepSeek key or the session secret", () => {
    const { DEEPSEEK_API_KEY: _d, SESSION_SECRET: _l, ...env } = fullEnv;
    expect(parseAwsConfig(env).accountId).toBe("111111111111");
  });

  it("names a missing AWS variable", () => {
    const { RECEIPT_PRO_AWS_PROFILE: _, ...env } = fullEnv;
    expect(() => parseAwsConfig(env)).toThrow(
      "Missing environment variable: RECEIPT_PRO_AWS_PROFILE."
    );
  });
});
