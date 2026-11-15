// `pnpm check:aws`: confirms the personal AWS setup (T-001). Reads .env.local. Safe to run with
// another AWS_PROFILE set in the shell: every call uses RECEIPT_PRO_AWS_PROFILE, and nothing
// after step 1 runs unless the account matches.
//
// 1. The profile belongs to RECEIPT_PRO_AWS_ACCOUNT_ID.
// 2. The table exists and is readable (GetItem on a key that never exists; the
//    receipt-pro-data policy grants item access, which DescribeTable may not be part of).
// 3. The bucket exists and is reachable.
// 4. The key is denied s3:ListAllMyBuckets, so it is not an admin key.

import { GetItemCommand } from "@aws-sdk/client-dynamodb";
import { HeadBucketCommand, ListBucketsCommand } from "@aws-sdk/client-s3";
import { getAws } from "src/server/aws";
import { getAwsConfig } from "src/server/config";

type AwsError = Error & { $metadata?: { httpStatusCode?: number } };

function statusOf(error: AwsError): number | undefined {
  return error.$metadata?.httpStatusCode;
}

async function step(
  label: string,
  run: () => Promise<string>,
  explain: (error: AwsError) => string
) {
  try {
    console.info(`✓ ${await run()}`);
  } catch (error) {
    console.error(`✗ ${label}: ${explain(error as AwsError)}`);
    process.exit(1);
  }
}

async function main() {
  const config = getAwsConfig();
  const { dynamodb, s3, assertPersonalAccount } = getAws();

  await step(
    "Account",
    async () => {
      const account = await assertPersonalAccount();
      return `Profile "${config.profile}" belongs to account ${account}, which matches RECEIPT_PRO_AWS_ACCOUNT_ID.`;
    },
    error => error.message
  );

  await step(
    "Table",
    async () => {
      await dynamodb.send(
        new GetItemCommand({
          TableName: config.tableName,
          Key: { PK: { S: "CHECK#aws" }, SK: { S: "CHECK#aws" } }
        })
      );
      return `Table "${config.tableName}" exists in ${config.region} and is readable.`;
    },
    error =>
      error.name === "ResourceNotFoundException"
        ? `table "${config.tableName}" does not exist in ${config.region}.`
        : `${error.name}: ${error.message}`
  );

  await step(
    "Bucket",
    async () => {
      await s3.send(new HeadBucketCommand({ Bucket: config.bucketName }));
      return `Bucket "${config.bucketName}" exists and is reachable.`;
    },
    error => {
      const status = statusOf(error);
      if (status === 404) {
        return `bucket "${config.bucketName}" does not exist.`;
      }
      if (status === 403) {
        return `bucket "${config.bucketName}" exists, but the profile may not use it.`;
      }
      if (status === 301) {
        return `bucket "${config.bucketName}" is not in ${config.region}.`;
      }
      return `${error.name}: ${error.message}`;
    }
  );

  await step(
    "Key scope",
    async () => {
      try {
        await s3.send(new ListBucketsCommand({}));
      } catch (error) {
        if (statusOf(error as AwsError) === 403) {
          return "The profile is denied s3:ListAllMyBuckets, so it is not an admin key.";
        }
        throw error;
      }
      throw new Error(
        "the profile can list every bucket in the account (s3:ListAllMyBuckets). " +
          "Its key is broader than the receipt-pro-data policy. Use the narrow receipt-pro user's key."
      );
    },
    error => error.message
  );
}

await main();
