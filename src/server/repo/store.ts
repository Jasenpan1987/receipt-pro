import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { getAws } from "src/server/aws";
import { getAwsConfig } from "src/server/config";

/** What every repository function needs. Tests pass a stub `db`. */
export type Store = {
  db: Pick<DynamoDBDocumentClient, "send">;
  tableName: string;
};

export function getStore(): Store {
  return { db: getAws().db, tableName: getAwsConfig().tableName };
}
