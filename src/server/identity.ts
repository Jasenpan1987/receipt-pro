import { getConfig } from "src/server/config";

/** The signed-in user. Until login (T-012) there is one built-in user: LOCAL_USER_ID. */
export function currentUserId(): string {
  return getConfig().localUserId;
}
