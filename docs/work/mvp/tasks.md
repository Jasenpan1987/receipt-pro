# MVP Tasks

> **Epic:** `docs/work/mvp/README.md` · **Milestones:** `docs/work/mvp/milestones.md`
> Sizing: one task is one focused session.

## Critical Path

T-001 → T-003 → T-004 → T-005 → T-006 → T-007 → T-008 → T-011 → T-012 → T-013 → T-014 → T-015

T-002 runs beside T-003 and must finish before T-004. T-009 and T-010 run beside T-007 and
T-008, but after each other, because both change the receipt list and the receipts repository.

## M1: Local Capture-to-Copy Loop

### T-001: Project scaffold, AWS account guard, dev resources

- **Type:** setup
- **Status:** done (2026-11-15)
- **Completion:** Next.js 16.4 app (App Router, TypeScript 7, pnpm) with the tooling in `docs/knowledge/tech-conventions.md#tooling`. `src/server/config.ts` validates the seven variables; `src/server/aws.ts` pins every client to the personal profile and guards every DynamoDB and S3 command with the account check; `pnpm check:aws` passes against the real table and bucket with another `AWS_PROFILE` set in the shell, and refuses a wrong account ID at the first step. 17 unit tests, `pnpm check:all` green, placeholder page opened on the builder's phone over Wi-Fi.
- **Code:** `src/server/config.ts`, `src/server/aws.ts`, `src/instrumentation.ts`, `scripts/check-aws.ts`, `src/app/`

### T-002: DeepSeek probe with a real receipt

- **Type:** integration
- **Status:** done (2026-11-15)
- **Completion:** `deepseek-flash` takes images through `@ai-sdk/deepseek` (chat endpoint), together with JSON mode; the conflict is resolved and `@ai-sdk/openai-compatible` is not needed. 30 calls on six photos of the builder's real receipts: with thinking off, about 2 s per call, dates and totals 6/6, item prices 31/34; thinking on is 3–38 s and no more accurate. 2 of 30 replies were invalid JSON (JSON, text, JSON), rejected by the SDK's strict parsing. Photos must be sent upright. Findings and reproduce command: `docs/knowledge/tech-conventions.md#real-receipts-t-002-2026-11-15`. G-004 and G-007 updated with the measurements.
- **Code:** `scripts/probe-deepseek.ts`

### T-003: Take a photo and see it in the list

- **Type:** feature
- **Status:** done (2026-11-15)
- **Completion:** Two buttons, 拍照 (camera) and 从相册选 (library, several photos at once: builder's decision, 2026-11-15). The browser re-encodes each photo to JPEG, longest side 2048. `POST /api/receipts` stores the photo and creates the receipt in one transaction with the session version bump; a retry with the same `receiptId` and `createdAt` returns the stored receipt, so a lost response never makes a duplicate (builder's decision). `GET /api/session` (without `since`) lists the session newest first with presigned photo URLs. Verified on the builder's iPhone and Xiaomi phone (camera and library, JPEG 1536×2048), against the real table and bucket as a `smoke-test-` user, in WebKit and Chromium including offline failure and retry, and with 45 unit tests (suite total). The real-phone Wi-Fi-off check is deferred to T-015 by the builder.
- **Code:** `src/client/receipts-screen.tsx`, `src/client/compress-image.ts`, `src/client/upload-receipt.ts`, `src/app/api/receipts/route.ts`, `src/app/api/session/route.ts`, `src/server/repo/`, `src/server/photos.ts`, `src/server/upload-form.ts`, `scripts/delete-test-user.ts`

### T-004: Generate the output text

- **Type:** feature
- **Status:** done (2026-11-15)
- **Completion:** After each upload the phone calls `POST /api/receipts/<id>/process`. The server reads the settings and the photo, calls `deepseek-flash` with thinking off in JSON mode, and keeps only `text`: exactly one JSON object is accepted, text around it is dropped, two objects or a blank reply get one retry, then `failed` with a plain message (invalid key, empty balance, busy, timeout each have their own). With no template, the prompt uses the builder's usual template and the first `ok` output is saved as the template. Each run is an attempt; its result is written only if no newer run started. A receipt `processing` for over 2 minutes shows as `failed`. Verified with 79 unit tests (suite total; parser and reader fixtures include the T-002 reply shapes), end to end against real AWS and DeepSeek as a `smoke-test-` user (2–4 s per receipt, template saved, invalid key gives `failed`), and on the builder's iPhone (3.5 s). Fixed on 2026-11-15 after the builder's review of real outputs, which mixed `现金` and `CASH`: one rule per field (`docs/knowledge/business.md#output`), `temperature: 0`, and the builder's usual template saved instead of the first output.
- **Code:** `src/server/ai/`, `src/app/api/receipts/[id]/process/route.ts`, `src/server/repo/receipts.ts`, `src/server/repo/settings.ts`, `src/server/receipt-view.ts`, `src/client/process-receipt.ts`

### T-005: See receipts on the computer and copy the text

- **Type:** feature
- **Status:** done (2026-11-15)
- **Completion:** `GET /api/session?since=<version>&sessionId=<id>` answers `{ changed: false }` (17 bytes, one DynamoDB read) unless both match; `sessionId` is added because a new session can reach the old version number. `src/client/use-session-poll.ts` polls every 3 s while visible, at once on becoming visible, one request at a time, and asks for the whole session every 30 s while a receipt is processing (the 2-minute rule) and at least every 30 min (photo URLs). Copy uses the Clipboard API, or a selected textarea and `execCommand` over plain HTTP; "已复制" confirms; the text stays selectable. Thumbnails open the photo in a new tab (S-05 criterion 3). Verified with 96 unit tests (suite total) and Playwright: a photo uploaded on WebKit/iPhone appeared on Chromium/Mac in 2.9 s and as text in 6.2 s with no reload; Mac copy identical to the page; the plain-HTTP fallback copied identical text. The builder pasted into Word from Chrome and Safari on the Mac: identical, Chinese intact. Pending for T-006: copy on the iPhone, and phone-to-Mac with no refresh on the real devices. The 8-hour tab is T-011.
- **Code:** `src/client/use-session-poll.ts`, `src/client/sync-policy.ts`, `src/client/copy-text.ts`, `src/server/session-sync.ts`, `src/app/api/session/route.ts`, `src/client/receipts-screen.tsx`

### T-006: M1 verification with real receipts

- **Type:** qa
- **Status:** ready
- **Requirement:** `docs/work/mvp/requirements.md#success-measures`
- **Knowledge:** `docs/work/mvp/gaps.md`
- **Code:** none
- **Description:** OMT QA runs the M1 definition of done with the builder's real receipts: an evening's batch end to end, reading accuracy (G-004), time per receipt (G-007), no conversational text in any output, Chinese intact in Word.
- **Acceptance:** `docs/work/mvp/test-plan.md` has the results. G-004 and G-007 are resolved or updated with measurements.
- **Notes:** Builder, 2026-11-15: manual checks are done in one sitting here, not during tasks. Collected so far: copy on the iPhone and paste into Notes (T-005); a photo from the iPhone appears on the Mac with no refresh (T-005). Edge cases and the Xiaomi phone stay on T-015.
- **Blocks:** T-007 · **Blocked by:** T-005 · **Parallel with:** none

## M2: Rules, Regenerate, Sessions

### T-007: Add a rule in plain language

- **Type:** feature
- **Status:** backlog
- **Requirement:** `docs/work/mvp/requirements.md#s-08-add-a-rule`
- **Knowledge:** `docs/knowledge/business.md#settings-and-rules`, `docs/knowledge/architecture.md#rules-m2`
- **Code:** `src/app/api/rules/interpret/route.ts`, `src/app/api/rules/apply/route.ts`, `src/server/rules/`
- **Description:** An "加规则" button on the main page opens a text box. `POST /api/rules/interpret` sends the text and the current settings to DeepSeek and returns a proposal: `kind` (`template` | `word` | `instruction` | `not_a_rule`), the change, `replaces` (id of the saved item it overrides, if any), and a Chinese explanation. Nothing is saved. The page shows the explanation with Confirm and Cancel. `POST /api/rules/apply` validates the proposal's shape and saves it with a conditional write on `SETTINGS.version`. Same-source word entries and a new template override the old ones. The dialog keeps its own short conversation while open, so the AI can revise a proposal; only the confirmed proposal is saved (ADR-006).
- **Acceptance:** "以后 Coles 都叫红超市" saves a word entry; the next receipt uses `红超市`. Then "Coles 叫大红超市" says it replaces the old entry and, once confirmed, the next receipt uses `大红超市`. Pasting two or three past outputs gives one summarised template, shown for confirmation; saying "不对，付款方式放在日期后面" in the same dialog revises it before saving. "今天天气怎么样" saves nothing and says it is not a rule. Cancel saves nothing. Existing receipts do not change.
- **Blocks:** T-008 · **Blocked by:** T-006 · **Parallel with:** T-009

### T-008: See and delete rules

- **Type:** feature
- **Status:** backlog
- **Requirement:** `docs/work/mvp/requirements.md#s-09-see-and-delete-rules`
- **Knowledge:** `docs/knowledge/business.md#settings-and-rules`
- **Code:** `src/app/rules/page.tsx`, `src/app/api/rules/route.ts`, `src/app/api/rules/[id]/route.ts`
- **Description:** A rules page, one tap from the main page, lists the template, each word entry, and each custom instruction in plain Chinese. Each has a delete button with confirmation (`DELETE /api/rules/<id>`, conditional on `SETTINGS.version`).
- **Acceptance:** Every saved rule appears; deleting one removes it, and the next receipt no longer follows it. Deleting the template makes the next first output the template again.
- **Blocks:** T-011 · **Blocked by:** T-007 · **Parallel with:** T-010

### T-009: Regenerate a receipt

- **Type:** feature
- **Status:** done (2026-11-15)
- **Completion:** Every stored receipt that is not processing, `failed` and `unreadable` included, has a "重新生成" button. It calls the same process route, which raises `attempts`, sets `processing`, bumps the version, and reads the photo with the current settings; the new text replaces the old. `attempts` is now in the receipt view, and a run with `attempts` of 2 or more shows "重新生成中…". Verified with Playwright against real AWS and DeepSeek as a `smoke-test-` user: after adding the word entry `通利 → 红超市` directly to settings, regenerating that receipt gave `红超市`, the other receipt stayed unchanged, and the phone page received the new text. Known limit: a rerun takes about 2 s, less than the 3 s poll, so other devices often go straight to the new text without showing "重新生成中…"; the device that pressed the button shows it at once.
- **Code:** `src/client/receipt-labels.ts`, `src/client/receipts-screen.tsx`, `src/server/receipt-view.ts`

### T-010: New session

- **Type:** feature
- **Status:** ready
- **Requirement:** `docs/work/mvp/requirements.md#s-06-sessions`
- **Knowledge:** `docs/knowledge/business.md#sessions`, `docs/knowledge/architecture.md#data-model`
- **Code:** `src/app/api/session/new/route.ts`, `src/server/repo/`
- **Description:** A "新 session" button asks for confirmation, then `POST /api/session/new` writes a new `CURRENT_SESSION` and deletes the old session's receipts and photos. Deletion is safe to retry: the old session is no longer current, so leftovers never show. A configurable size threshold shows a plain prompt to start a new session (value from G-003).
- **Acceptance:** Confirming clears the list on every device within 5 seconds, and the old photos are gone from the bucket. Settings are unchanged. Cancel does nothing.
- **Blocks:** T-011 · **Blocked by:** T-005, T-009 · **Parallel with:** T-008

### T-011: M2 verification and long-use test

- **Type:** qa
- **Status:** backlog
- **Requirement:** `docs/work/mvp/requirements.md#non-functional-requirements`
- **Code:** none
- **Description:** OMT QA verifies S-06 to S-09, and runs a session of 100 receipts and a tab open for 8 hours. Measures G-003.
- **Acceptance:** Results in `docs/work/mvp/test-plan.md`. G-003 resolved with a measured value.
- **Blocks:** T-012 · **Blocked by:** T-008, T-010

## M3: Login and Cloud

### T-012: Username and password login

- **Type:** feature
- **Status:** backlog
- **Requirement:** `docs/work/mvp/requirements.md#s-01-log-in`
- **Knowledge:** `docs/knowledge/business.md#login`, `docs/knowledge/architecture.md#data-model`
- **Code:** `src/server/identity.ts`, `src/app/login/page.tsx`, `src/middleware.ts`, `scripts/create-user.ts`
- **Description:** `scripts/create-user.ts` creates the one account (`PROFILE` item with a password hash); there is no sign-up page. The login page sets a signed, HTTP-only cookie that lasts 30 days and renews on use. Middleware rejects every page and API call without it, except the login page. `currentUserId()` reads the cookie instead of `LOCAL_USER_ID`. A log-out action clears it.
- **Acceptance:** A wrong password gets a plain message. After login, reopening the app does not ask again. Every API route returns 401 without the cookie. Log-out works. The local user's existing data is visible after logging in as that user.
- **Blocks:** T-013 · **Blocked by:** T-011

### T-013: Deploy to Lambda

- **Type:** setup
- **Status:** backlog
- **Requirement:** `docs/work/mvp/requirements.md#technical-constraints`
- **Knowledge:** `docs/knowledge/architecture.md#lambda-compatibility-rules`, `docs/knowledge/tech-conventions.md#aws-account-safety`
- **Code:** deployment directory chosen in this task
- **Description:** Choose the deployment tool and record it as an ADR. Give the Lambda an IAM role with the same narrow access to table `receipt-pro` and the photo bucket as the `receipt-pro` user (ADR-005: one environment, no new table or bucket). Put configuration in the Lambda's environment variables: table name, bucket name, region, account ID, and the DeepSeek key. The key is read at deploy time from a gitignored local file and must never appear in any committed file. `RECEIPT_PRO_AWS_PROFILE` and `LOCAL_USER_ID` are not set on Lambda. Deploy the app to Lambda in the personal account, reachable at the AWS-provided URL over HTTPS.
- **Acceptance:** The deployed app passes the M1 loop from the phone over mobile data. No resource exists outside the personal account. Idle cost has no always-on component.
- **Blocks:** T-014 · **Blocked by:** T-012
- **Notes:** Agreed with the builder on 2026-11-15: before go-live, the builder and Claude together create a separate deployment IAM user in the personal account, with its own key on its own profile (for example `receipt-pro-deploy`, never `receipt-pro`). Claude then deploys with that profile through the CLI. Until then, the Mac holds only the narrow `receipt-pro` key, which cannot create resources.

### T-014: Domain, HTTPS, and home-screen install

- **Type:** setup
- **Status:** backlog
- **Requirement:** `docs/work/mvp/requirements.md#non-functional-requirements`
- **Code:** `src/app/manifest.ts`, app icons, service worker, deployment config
- **Description:** Point the builder's domain at the deployment with a TLS certificate. Add the web app manifest, icons, and a minimal service worker so the app installs to the home screen and opens full screen.
- **Acceptance:** On an iPhone and a Xiaomi phone, "add to home screen" installs it; opening it goes straight to the receipt list, full screen.
- **Blocks:** T-015 · **Blocked by:** T-013, G-005

### T-015: M3 verification in the cloud

- **Type:** qa
- **Status:** backlog
- **Requirement:** `docs/work/mvp/requirements.md#success-measures`
- **Code:** none
- **Description:** OMT QA reruns the success measures on the deployed app, from the installed home-screen app and the Mac.
- **Acceptance:** Results in `docs/work/mvp/test-plan.md`; the epic is ready to archive.
- **Blocked by:** T-014
- **Notes:** Builder, 2026-11-15: manual edge-case tests on the real phones wait until here, at the end of the MVP. Collected so far: Wi-Fi off mid-upload, then retry (T-003; already covered by browser offline tests in WebKit and Chromium). From T-004 on, tasks are checked on the iPhone only; the Xiaomi checks of those tasks also wait until here (T-003 passed on both phones).
