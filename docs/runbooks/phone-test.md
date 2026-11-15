# Runbook: Test on the Phone

> **Purpose:** Try a change on a real phone without leaving test receipts in the real session.
> **Status:** Current
> **Verified against:** T-003 phone test, 2026-11-15

The table and bucket are the real ones (ADR-005), so a test runs as a throwaway user whose ID
starts with `smoke-test-`, and that user's data is deleted afterwards.

1. Make a test user ID:

   ```sh
   node -e 'console.log("smoke-test-" + require("crypto").randomUUID())'
   ```

2. Give the test user a login account (since T-012 every page needs one), then start the dev server:

   ```sh
   CREATE_USER_ID=<test user id> CREATE_USER_NAME=<any name> CREATE_USER_PASSWORD=<8+ characters> \
     pnpm exec tsx --env-file=.env.local scripts/create-user.ts
   pnpm dev
   ```

   Log in on the phone with that name and password.

3. Find the Mac's LAN address with `ipconfig getifaddr en0`, and open `http://<address>:3000` on the phone, on the same Wi-Fi.
4. Check what the server stored: `curl -s http://localhost:3000/api/session`. Each `photoUrl` downloads the stored photo.
5. Stop the dev server, then delete the test user's session, receipts, settings, login account, and photos:

   ```sh
   LOCAL_USER_ID=<test user id> pnpm exec tsx --env-file=.env.local scripts/delete-test-user.ts
   ```

   The script refuses any ID that does not start with `smoke-test-`.

Real-phone checks during a task cover the main path on the iPhone only. Edge cases (Wi-Fi off,
retries) and the Xiaomi checks wait until T-015 (builder, 2026-11-15). Browser engines cover the
edge cases in the meantime: WebKit with an iPhone profile and Chromium with an Android profile,
through Playwright's offline mode.
