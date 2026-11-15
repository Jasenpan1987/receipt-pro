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
- **Status:** done (2026-11-15)
- **Requirement:** `docs/work/mvp/requirements.md#success-measures`
- **Knowledge:** `docs/work/mvp/gaps.md`
- **Code:** none
- **Description:** OMT QA runs the M1 definition of done with the builder's real receipts: an evening's batch end to end, reading accuracy (G-004), time per receipt (G-007), no conversational text in any output, Chinese intact in Word.
- **Acceptance:** `docs/work/mvp/test-plan.md` has the results. G-004 and G-007 are resolved or updated with measurements.
- **Notes:** Builder, 2026-11-15: manual checks are done in one sitting here, not during tasks. Collected so far: create the real login account with `pnpm exec tsx --env-file=.env.local scripts/create-user.ts` in the builder's own Terminal, then log in on the iPhone and the Mac (T-012); copy on the iPhone and paste into Notes (T-005); a photo from the iPhone appears on the Mac with no refresh (T-005). Edge cases and the Xiaomi phone stay on T-015.
- **Blocks:** T-007 · **Blocked by:** T-005 · **Parallel with:** none

## M2: Rules, Regenerate, Sessions

### T-007: Add a rule in plain language

- **Type:** feature
- **Status:** done (2026-11-15; done before T-006 because the builder batches manual verification at the end)
- **Completion:** "加规则" in the header opens a dialog. `POST /api/rules/interpret` sends the dialog's own short conversation and the current settings to `deepseek-flash` and returns a checked proposal (word, template, instruction, or not a rule) with a plain explanation; it saves nothing. Which saved rule a proposal replaces is decided in code and shown ("替换原来的：…"). "确认保存" calls `POST /api/rules/apply`, which checks the proposal again and writes only if the settings version is unchanged. The fixed receipt rules no longer name a field order, so a template decides it. Verified with 129 unit tests (suite total) and a browser run against real DeepSeek as a `smoke-test-` user: "以后通利都叫红超市" saved a word entry; "通利叫大红超市" said it replaces it, and the next receipt used `大红超市`; two pasted outputs became one template, and "不对，付款方式放在日期后面" revised it, after which receipts put the payment method after the date; "今天天气怎么样" saved nothing; cancel saved nothing; the existing receipt did not change.
- **Code:** `src/server/rules/`, `src/app/api/rules/interpret/route.ts`, `src/app/api/rules/apply/route.ts`, `src/server/repo/settings.ts`, `src/client/rule-dialog.tsx`, `src/client/rules-api.ts`

### T-008: See and delete rules

- **Type:** feature
- **Status:** done (2026-11-15)
- **Completion:** A "规则" link in the header (one tap) opens `/rules`: the template (or, with none saved, the builder's usual one), each word entry as "小票上的 X 写成 Y", and each custom instruction, each with "删除" behind a confirmation. `GET /api/rules` lists them; `DELETE /api/rules/<id>?version=<v>` removes one with a conditional write on the settings version. With the builder's 2026-11-15 change to S-03 criterion 7, deleting the template returns to the builder's usual template, which is saved again on the next run. Verified with 131 unit tests (suite total) and a browser run against real AWS and DeepSeek as a `smoke-test-` user with three seeded rules: after each deletion, regenerating the same receipt dropped that rule's effect (`红超市` back to `通利`, `柚子` back, the template's field order back to the usual one). The header fits an iPhone-width screen.
- **Code:** `src/app/rules/page.tsx`, `src/client/rules-screen.tsx`, `src/app/api/rules/route.ts`, `src/app/api/rules/[id]/route.ts`, `src/server/rules/apply-rule.ts`

### T-009: Regenerate a receipt

- **Type:** feature
- **Status:** done (2026-11-15)
- **Completion:** Every stored receipt that is not processing, `failed` and `unreadable` included, has a "重新生成" button. It calls the same process route, which raises `attempts`, sets `processing`, bumps the version, and reads the photo with the current settings; the new text replaces the old. `attempts` is now in the receipt view, and a run with `attempts` of 2 or more shows "重新生成中…". Verified with Playwright against real AWS and DeepSeek as a `smoke-test-` user: after adding the word entry `通利 → 红超市` directly to settings, regenerating that receipt gave `红超市`, the other receipt stayed unchanged, and the phone page received the new text. Known limit: a rerun takes about 2 s, less than the 3 s poll, so other devices often go straight to the new text without showing "重新生成中…"; the device that pressed the button shows it at once.
- **Code:** `src/client/receipt-labels.ts`, `src/client/receipts-screen.tsx`, `src/server/receipt-view.ts`

### T-010: New session

- **Type:** feature
- **Status:** done (2026-11-15)
- **Completion:** A "新 session" button asks for confirmation (`confirm()`), then `POST /api/session/new` writes a new `CURRENT_SESSION` (version 0, `previousSessionId` set) only if the current one is still the one it read, so two devices pressing at once get one new session. Then it deletes the old session's photos (by prefix, orphans included) and items; a failed cleanup stays hidden and the next new session retries it. Settings are untouched. From 100 receipts (`src/shared/limits.ts`, provisional until G-003) the page suggests a new session. Thumbnails now load lazily. Verified with 105 unit tests (suite total) and Playwright against real AWS as a `smoke-test-` user: cancel kept both receipts; confirm cleared the Mac page in 0.8 s and the phone page in 2.1 s; the old session's items and photos were gone from DynamoDB and S3; the template stayed; the next upload landed in the new session.
- **Code:** `src/app/api/session/new/route.ts`, `src/server/repo/sessions.ts`, `src/server/photos.ts`, `src/client/new-session.ts`, `src/client/receipts-screen.tsx`, `src/shared/limits.ts`

### T-011: M2 verification and long-use test

- **Type:** qa
- **Status:** backlog
- **Requirement:** `docs/work/mvp/requirements.md#non-functional-requirements`
- **Code:** none
- **Description:** OMT QA verifies S-06 to S-09, and runs a session of 100 receipts and a tab open for 8 hours. Measures G-003.
- **Acceptance:** Results in `docs/work/mvp/test-plan.md`. G-003 resolved with a measured value.
- **Notes:** Thumbnails are the full 2048 px photos (T-010 made them lazy). If 100 receipts or 8 hours make the phone slow, small thumbnails made at upload are the likely fix. `SESSION_SIZE_PROMPT` in `src/shared/limits.ts` takes the G-003 value measured here.
- **Blocks:** T-012 · **Blocked by:** T-008, T-010

## M3: Login and Cloud

### T-012: Username and password login

- **Type:** feature
- **Status:** done (2026-11-15; built before T-006 and T-011 by the builder's choice)
- **Completion:** `scripts/create-user.ts` makes the one account in the builder's own Terminal (hidden password, at least 8 characters), keeping `LOCAL_USER_ID` as the user ID so earlier data stays visible; it writes a `PROFILE` item and a `USERNAME#<name>` lookup item in one transaction. Passwords are `scrypt`-hashed. `/login` sets `rp_session`: a signed token (HMAC-SHA256 with `SESSION_SECRET`), HTTP-only, SameSite=Lax, 30 days, `Secure` on HTTPS, re-issued once a day of use. `src/proxy.ts` sends pages without it to `/login` and answers API calls with 401; every API route checks the user again itself. 10 wrong passwords in a row lock the account for 15 minutes; an unknown user and a wrong password get the same message. "退出登录" is on the rules page. Verified with 148 unit tests (suite total) and against real AWS: all 8 API routes answer 401 without a cookie or with a forged one; in WebKit over plain HTTP, a wrong password was refused, the right one showed a receipt stored before the account existed, a reopened page stayed logged in, an upload worked, and log-out brought 401 back; 10 wrong passwords locked out even the right one. Pending for the builder's sitting: create the real account with the script, and log in on the iPhone and the Mac.
- **Code:** `src/server/auth/`, `src/proxy.ts`, `src/server/identity.ts`, `src/server/repo/users.ts`, `src/app/login/page.tsx`, `src/app/api/auth/`, `scripts/create-user.ts`

### T-013: Deploy to Lambda

- **Type:** setup
- **Status:** backlog
- **Requirement:** `docs/work/mvp/requirements.md#technical-constraints`
- **Knowledge:** `docs/knowledge/architecture.md#lambda-compatibility-rules`, `docs/knowledge/tech-conventions.md#aws-account-safety`
- **Code:** deployment directory chosen in this task
- **Description:** Choose the deployment tool and record it as an ADR. Give the Lambda an IAM role with the same narrow access to table `receipt-pro` and the photo bucket as the `receipt-pro` user (ADR-005: one environment, no new table or bucket). Put configuration in the Lambda's environment variables: table name, bucket name, region, account ID, and the DeepSeek key. The key is read at deploy time from a gitignored local file and must never appear in any committed file. `RECEIPT_PRO_AWS_PROFILE` and `LOCAL_USER_ID` are not set on Lambda. Deploy the app to Lambda in the personal account, reachable at the AWS-provided URL over HTTPS.
- **Acceptance:** The deployed app passes the M1 loop from the phone over mobile data. No resource exists outside the personal account. Idle cost has no always-on component.
- **Blocks:** T-014 · **Blocked by:** T-012
- **Notes:** From T-012: set `SESSION_SECRET` (32+ random characters, kept out of git) in the Lambda environment; `LOCAL_USER_ID` stays unset there. The cookie turns `Secure` automatically behind HTTPS (`x-forwarded-proto`). Agreed with the builder on 2026-11-15: before go-live, the builder and Claude together create a separate deployment IAM user in the personal account, with its own key on its own profile (for example `receipt-pro-deploy`, never `receipt-pro`). Claude then deploys with that profile through the CLI. Until then, the Mac holds only the narrow `receipt-pro` key, which cannot create resources.

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

## Bugs Found in Verification

### T-017: The fixed date rule beat the user's template

- **Type:** bug
- **Status:** done (2026-11-15)
- **Found in:** T-006. The builder's rules dropped 日 and put three spaces after the date; receipts often still had 日 and one space.
- **Reproduce:** with the template `2026 年 10 月 1   Costco 青菜 3.25 水 2.0 啤酒 10.0 共1234，现金`, 6 of 6 readings wrote `1 日` and 6 of 6 missed the three spaces. Cause: fixed rule 2 said `日期写成 "2026 年 10 月 1 日" 这样`, and only rules 3 to 8 yielded to the user's.
- **Fix:** rule 2 now takes the date style from the template, and the user's template, word list, and instructions win over every fixed rule. `src/server/ai/date-style.ts` rewrites the leading date in the template's style (日 or not, the spacing after it), because exact spacing is the model's weak point: with the prompt fix alone, 3 of 6 still had two spaces; with both, 0 of 6.
- **Code:** `src/server/ai/system-prompt.ts`, `src/server/ai/date-style.ts`, `src/app/api/receipts/[id]/process/route.ts`

## Later (not in a milestone)

### T-016: Reset a forgotten password

- **Type:** feature
- **Status:** backlog (deferred by the builder, 2026-11-15)
- **Requirement:** none yet; S-01 has no reset
- **Knowledge:** `docs/knowledge/architecture.md#data-model` (the `PROFILE` item holds only a `scrypt` hash)
- **Code:** `scripts/`, `src/server/repo/users.ts`
- **Description:** Today a forgotten password cannot be recovered: the hash cannot be reversed, and `scripts/create-user.ts` refuses an account that exists. A reset script, run in the builder's own Terminal, would set a new password hash on the existing `PROFILE` and clear `failedLogins` and `lockedUntil`.
- **Notes:** Raised in T-006's sitting. Not needed for the MVP.
