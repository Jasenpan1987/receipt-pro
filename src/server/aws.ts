// AWS clients for the personal account only (docs/knowledge/tech-conventions.md#aws-account-safety).
// The default credential chain may lead to other AWS accounts, so every client gets the
// personal profile explicitly, and nothing reaches DynamoDB or S3 until STS has confirmed
// that the profile belongs to RECEIPT_PRO_AWS_ACCOUNT_ID.
//
// Lambda (T-013) has no ~/.aws profile; credentials there come from the function's role,
// and this file changes in that task.

import { DynamoDBClient, type DynamoDBClientConfig } from "@aws-sdk/client-dynamodb";
import { S3Client } from "@aws-sdk/client-s3";
import { GetCallerIdentityCommand, STSClient } from "@aws-sdk/client-sts";
import { fromIni } from "@aws-sdk/credential-providers";
import { type AwsConfig, getAwsConfig } from "src/server/config";

export class WrongAwsAccountError extends Error {
  override name = "WrongAwsAccountError";
}

/** The one STS call the guard needs. `STSClient` satisfies it; tests pass a stub. */
export type CallerIdentitySource = {
  send(command: GetCallerIdentityCommand): Promise<{ Account?: string }>;
};

export type AwsClients = {
  dynamodb: DynamoDBClient;
  s3: S3Client;
  /** Resolves with the account ID, or rejects with `WrongAwsAccountError`. */
  assertPersonalAccount: () => Promise<string>;
};

/** For tests: keeps every request on the machine. */
export type AwsClientOverrides = {
  sts?: CallerIdentitySource;
  clientConfig?: Pick<DynamoDBClientConfig, "credentials" | "requestHandler" | "maxAttempts">;
};

async function verifyAccount(sts: CallerIdentitySource, config: AwsConfig): Promise<string> {
  const { Account } = await sts.send(new GetCallerIdentityCommand({}));
  if (Account !== config.accountId) {
    throw new WrongAwsAccountError(
      `AWS profile "${config.profile}" belongs to account ${Account ?? "(unknown)"}, ` +
        `not RECEIPT_PRO_AWS_ACCOUNT_ID ${config.accountId}. Every AWS call is refused. ` +
        "Check RECEIPT_PRO_AWS_PROFILE and RECEIPT_PRO_AWS_ACCOUNT_ID in .env.local."
    );
  }
  return Account;
}

export function createAwsClients(
  config: AwsConfig,
  overrides: AwsClientOverrides = {}
): AwsClients {
  // `credentials` alone would still let region and other shared settings resolve through the
  // shell's AWS_PROFILE. `profile` and an explicit `region` keep all of it on the personal profile.
  const base = {
    region: config.region,
    profile: config.profile,
    credentials: fromIni({ profile: config.profile }),
    ...overrides.clientConfig
  };
  const sts = overrides.sts ?? new STSClient(base);

  // One STS call per process. A wrong account stays refused until restart; a network or
  // credential error is not cached, so the next AWS call asks again.
  let check: Promise<string> | undefined;
  const assertPersonalAccount = () => {
    check ??= verifyAccount(sts, config).catch((error: unknown) => {
      if (!(error instanceof WrongAwsAccountError)) {
        check = undefined;
      }
      throw error;
    });
    return check;
  };

  // The guard runs before every command, so no caller can forget it.
  const guard = { step: "initialize", name: "receiptProAccountGuard", priority: "high" } as const;
  const dynamodb = new DynamoDBClient(base);
  dynamodb.middlewareStack.add(
    next => async args => {
      await assertPersonalAccount();
      return next(args);
    },
    guard
  );
  const s3 = new S3Client(base);
  s3.middlewareStack.add(
    next => async args => {
      await assertPersonalAccount();
      return next(args);
    },
    guard
  );

  return { dynamodb, s3, assertPersonalAccount };
}

let clients: AwsClients | undefined;

/** The app's clients, built once per server process. */
export function getAws(): AwsClients {
  clients ??= createAwsClients(getAwsConfig());
  return clients;
}

export function assertPersonalAccount(): Promise<string> {
  return getAws().assertPersonalAccount();
}
