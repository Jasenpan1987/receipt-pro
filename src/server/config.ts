// Server configuration from environment variables: `.env.local` on the Mac, the function's
// environment on Lambda (T-013). Variables already set in the shell win over `.env.local`
// (in Next.js and in `node --env-file`), and the shell may set AWS_PROFILE to another profile.
// That is why the profile comes from RECEIPT_PRO_AWS_PROFILE and AWS_PROFILE is never read.

export type AwsConfig = {
  /**
   * The personal profile in ~/.aws. `undefined` only on Lambda, which has no profile: there the
   * credentials are the function's own role (T-013).
   */
  profile?: string;
  accountId: string;
  region: string;
  tableName: string;
  bucketName: string;
};

export type Config = {
  aws: AwsConfig;
  deepseekApiKey: string;
  /** Signs the login cookie (T-012). At least 32 characters. */
  sessionSecret: string;
  /** Only `scripts/create-user.ts` uses it, as the default user ID (T-012). */
  localUserId?: string;
};

type Env = Record<string, string | undefined>;

export class ConfigError extends Error {
  override name = "ConfigError";
}

const AWS_VARIABLES = [
  "RECEIPT_PRO_AWS_ACCOUNT_ID",
  "AWS_REGION",
  "TABLE_NAME",
  "BUCKET_NAME"
] as const;

const PROFILE_VARIABLE = "RECEIPT_PRO_AWS_PROFILE";

/** Lambda sets this in every function's environment; a Mac shell does not. */
export function isOnLambda(env: Env): boolean {
  return Boolean(env.AWS_LAMBDA_FUNCTION_NAME?.trim());
}

/** Off Lambda the profile is required; on Lambda it is not read at all. */
function awsNames(env: Env): string[] {
  return isOnLambda(env) ? [...AWS_VARIABLES] : [PROFILE_VARIABLE, ...AWS_VARIABLES];
}

const APP_VARIABLES = ["DEEPSEEK_API_KEY", "SESSION_SECRET"] as const;

/** Reads every name, then reports all missing ones in one message. Blank counts as missing. */
function readRequired<Name extends string>(env: Env, names: readonly Name[]): Record<Name, string> {
  const values: Partial<Record<Name, string>> = {};
  const missing: Name[] = [];
  for (const name of names) {
    const value = env[name]?.trim();
    if (value) {
      values[name] = value;
    } else {
      missing.push(name);
    }
  }
  if (missing.length === 1) {
    throw new ConfigError(
      `Missing environment variable: ${missing[0]}. Set it in .env.local (see .env.example).`
    );
  }
  if (missing.length > 1) {
    throw new ConfigError(
      `Missing environment variables: ${missing.join(", ")}. Set them in .env.local (see .env.example).`
    );
  }
  return values as Record<Name, string>;
}

function toAwsConfig(values: Record<string, string>): AwsConfig {
  const accountId = values.RECEIPT_PRO_AWS_ACCOUNT_ID;
  if (!/^\d{12}$/.test(accountId)) {
    throw new ConfigError(
      `RECEIPT_PRO_AWS_ACCOUNT_ID must be a 12-digit AWS account ID, got "${accountId}".`
    );
  }
  return {
    profile: values[PROFILE_VARIABLE],
    accountId,
    region: values.AWS_REGION,
    tableName: values.TABLE_NAME,
    bucketName: values.BUCKET_NAME
  };
}

/** Only the AWS variables: `pnpm check:aws` runs before the DeepSeek key exists. */
export function parseAwsConfig(env: Env): AwsConfig {
  return toAwsConfig(readRequired(env, awsNames(env)));
}

export function parseConfig(env: Env): Config {
  const values = readRequired(env, [...awsNames(env), ...APP_VARIABLES]);
  if (values.SESSION_SECRET.length < 32) {
    throw new ConfigError("SESSION_SECRET must be at least 32 characters.");
  }
  return {
    aws: toAwsConfig(values),
    deepseekApiKey: values.DEEPSEEK_API_KEY,
    sessionSecret: values.SESSION_SECRET,
    localUserId: env.LOCAL_USER_ID?.trim() || undefined
  };
}

let config: Config | undefined;
let awsConfig: AwsConfig | undefined;

/** The whole configuration, validated once per server process. */
export function getConfig(): Config {
  config ??= parseConfig(process.env);
  return config;
}

export function getAwsConfig(): AwsConfig {
  awsConfig ??= config?.aws ?? parseAwsConfig(process.env);
  return awsConfig;
}
