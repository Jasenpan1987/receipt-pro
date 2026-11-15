// Creates the one login account (T-012). There is no sign-up page.
//
// Run it in your own Terminal, not through the agent, so the password never reaches a chat:
//   pnpm exec tsx --env-file=.env.local scripts/create-user.ts
// It asks for a username and a password (hidden). The account gets LOCAL_USER_ID from
// .env.local as its user ID, so receipts and rules from before login stay visible.
//
// Test accounts only, without prompts: CREATE_USER_ID (must start with "smoke-test-"),
// CREATE_USER_NAME, CREATE_USER_PASSWORD.

import { createInterface } from "node:readline";

import { hashPassword } from "src/server/auth/password";
import { getConfig } from "src/server/config";
import { getStore } from "src/server/repo/store";
import { createUser } from "src/server/repo/users";

const MIN_PASSWORD = 8;

/** Reads one line; with `hidden`, nothing typed is echoed. */
function ask(question: string, hidden = false): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  if (hidden) {
    const writer = rl as unknown as { _writeToOutput: (text: string) => void };
    writer._writeToOutput = text => {
      if (text.startsWith(question)) {
        process.stdout.write(question);
      }
    };
  }
  return new Promise(resolve =>
    rl.question(question, answer => {
      rl.close();
      if (hidden) {
        process.stdout.write("\n");
      }
      resolve(answer);
    })
  );
}

async function main() {
  const testId = process.env.CREATE_USER_ID;
  let userId: string;
  let username: string;
  let password: string;
  if (testId) {
    if (!testId.startsWith("smoke-test-")) {
      throw new Error('CREATE_USER_ID must start with "smoke-test-".');
    }
    userId = testId;
    username = process.env.CREATE_USER_NAME ?? "";
    password = process.env.CREATE_USER_PASSWORD ?? "";
  } else {
    const localUserId = getConfig().localUserId;
    if (!localUserId) {
      throw new Error("Set LOCAL_USER_ID in .env.local first: the account keeps that user ID.");
    }
    userId = localUserId;
    username = (await ask("用户名：")).trim();
    password = await ask(`密码（至少 ${MIN_PASSWORD} 位，不会显示）：`, true);
    if ((await ask("再输一次密码：", true)) !== password) {
      throw new Error("两次输入的密码不一样，没有创建账户。");
    }
  }
  if (!username || password.length < MIN_PASSWORD) {
    throw new Error(`需要用户名，密码至少 ${MIN_PASSWORD} 位。`);
  }
  await createUser(getStore(), { userId, username, passwordHash: await hashPassword(password) });
  console.info(`账户已创建：${username}。在 app 里用它登录。`);
}

main().catch(error => {
  const name = error instanceof Error ? error.name : "";
  console.error(
    name === "TransactionCanceledException"
      ? "这个用户名或这个用户已经有账户了。"
      : String(error instanceof Error ? error.message : error)
  );
  process.exit(1);
});
