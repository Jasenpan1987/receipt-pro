# MVP Tasks

> **Epic:** `docs/work/mvp/README.md` · **Milestones:** `docs/work/mvp/milestones.md`
> Sizing: one task is one focused session.

## Critical Path

T-001 → T-003 → T-004 → T-005 → T-006 → T-007 → T-008 → T-011 → T-012 → T-013 → T-014 → T-015

T-002 runs beside T-003 and must finish before T-004. T-009 and T-010 run beside T-007 and
T-008, but after each other, because both change the receipt list and the receipts repository.

## M1: Local Capture-to-Copy Loop

Accepted 2026-11-15. Detail and review: `docs/records/completed-work/mvp-m1.md`.

| Task  | Title                                              | Status            |
| ----- | -------------------------------------------------- | ----------------- |
| T-001 | Project scaffold, AWS account guard, dev resources | done (2026-11-15) |
| T-002 | DeepSeek probe with a real receipt                 | done (2026-11-15) |
| T-003 | Take a photo and see it in the list                | done (2026-11-15) |
| T-004 | Generate the output text                           | done (2026-11-15) |
| T-005 | See receipts on the computer and copy the text     | done (2026-11-15) |
| T-006 | M1 verification with real receipts                 | done (2026-11-15) |

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
- **Status:** backlog (2026-11-15: the builder chose to deploy first, T-013; the 8-hour length was never confirmed by the builder)
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
- **Status:** done (deployed 2026-11-15; redeployed with T-018 to T-022 on 2026-11-16). The mobile-data check of the acceptance was deferred by the builder on 2026-11-17 to T-015
- **Requirement:** `docs/work/mvp/requirements.md#technical-constraints`
- **Knowledge:** `docs/knowledge/architecture.md#lambda-compatibility-rules`, `docs/knowledge/tech-conventions.md#aws-account-safety`
- **Code:** deployment directory chosen in this task
- **Description:** Choose the deployment tool and record it as an ADR. Give the Lambda an IAM role with the same narrow access to table `receipt-pro` and the photo bucket as the `receipt-pro` user (ADR-005: one environment, no new table or bucket). Put configuration in the Lambda's environment variables: table name, bucket name, region, account ID, and the DeepSeek key. The key is read at deploy time from a gitignored local file and must never appear in any committed file. `RECEIPT_PRO_AWS_PROFILE` and `LOCAL_USER_ID` are not set on Lambda. Deploy the app to Lambda in the personal account, reachable at the AWS-provided URL over HTTPS.
- **Acceptance:** The deployed app passes the M1 loop from the phone over mobile data. No resource exists outside the personal account. Idle cost has no always-on component.
- **Blocks:** T-014 · **Blocked by:** T-012
- **Decided with the builder, 2026-11-15 (replaces the deployment IAM user and Mac key agreed earlier):** one Lambda (Node 22, arm64) from `output: "standalone"`, run by the AWS Lambda Web Adapter, behind a Function URL, with its IAM role and a log group, all in one CloudFormation template in the repo. Deployed by GitHub Actions on the public repo: `pnpm check:all`, build, deploy. AWS access through GitHub OIDC and a deploy role that only this repo's `main` can assume, so no AWS key is stored on the Mac or in GitHub. The DeepSeek key and `SESSION_SECRET` are GitHub encrypted secrets, typed by the builder. Workflow logs are public: nothing may print account details. Record as an ADR in this task.
- **Done by the builder, 2026-11-15:** GitHub environment `production`, deployable from `main` only, no required reviewers, with secrets `DEEPSEEK_API_KEY` and `SESSION_SECRET` (a new value, not the local one). The deploy role's ARN is added after the AWS bootstrap.
- **Builder, 2026-11-15:** every push to `main` deploys once `pnpm check:all` passes; no pull requests, code goes straight to `main`. After each deploy, Claude tells the builder the result.
- **Deployed, 2026-11-15:** run `43718373723` (check and build 26 s, deploy 1 min 38 s); `/login` answered 200 from the Function URL, so the zip with pnpm's symlinks starts on Lambda. The public log holds no account ID, ARN, or app address. The first run failed at the AWS login: repositories created after 2026-07-15 get GitHub's immutable OIDC subject (`repo:owner@id/name@id:...`), and the deploy role trusted the plain form; fixed in `deploy/bootstrap.yaml` and in the live stack. Pending for the acceptance: the builder runs the M1 loop on the phone over mobile data, and photo thumbnails load (they are signed with the role's temporary credentials).
- **Built, 2026-11-15:** `deploy/bootstrap.yaml`, `deploy/app.yaml`, `deploy/run.sh`, `scripts/package-lambda.ts`, `.github/workflows/deploy.yml`, role credentials on Lambda in `src/server/config.ts` and `src/server/aws.ts`, ADR-007, `docs/runbooks/deploy.md`. The builder created stack `receipt-pro-bootstrap` and added `AWS_DEPLOY_ROLE_ARN`.
- **Notes:** From T-012: set `SESSION_SECRET` (32+ random characters, kept out of git) in the Lambda environment; `LOCAL_USER_ID` stays unset there. The cookie turns `Secure` automatically behind HTTPS (`x-forwarded-proto`). Agreed with the builder on 2026-11-15: before go-live, the builder and Claude together create a separate deployment IAM user in the personal account, with its own key on its own profile (for example `receipt-pro-deploy`, never `receipt-pro`). Claude then deploys with that profile through the CLI. Until then, the Mac holds only the narrow `receipt-pro` key, which cannot create resources. From the M1 review: Lambda has no `~/.aws` profile, but `src/server/config.ts` requires `RECEIPT_PRO_AWS_PROFILE` and `src/server/aws.ts` uses `fromIni`; both change for role credentials, and the account check stays.

### T-014: Domain, HTTPS, and home-screen install

- **Type:** setup
- **Status:** ready (the builder chose it next on 2026-11-17)
- **Requirement:** `docs/work/mvp/requirements.md#non-functional-requirements`
- **Code:** `src/app/manifest.ts`, app icons, service worker, deployment config
- **Description:** Point the builder's domain at the deployment with a TLS certificate. Add the web app manifest, icons, and a minimal service worker so the app installs to the home screen and opens full screen.
- **Acceptance:** On an iPhone and a Xiaomi phone, "add to home screen" installs it; opening it goes straight to the receipt list, full screen.
- **Blocks:** T-015 · **Blocked by:** T-013, G-005
- **Notes (2026-11-17, before any building):** Waiting for the builder: the domain or subdomain (G-005; a subdomain such as `receipts.<domain>` recommended, since an apex cannot take a CNAME at most DNS providers), where its DNS is managed, and whether the home-screen install goes in now. Planned shape: a CloudFront distribution in front of the Function URL (no fixed cost; free tier), an ACM certificate in `us-east-1` (CloudFront needs that region) validated by a DNS record, and a CNAME from the subdomain to CloudFront; no Route 53 hosted zone unless the domain is already there (0.50 USD a month). Caching off for pages and API, on for `/_next/static/*`; forward cookies and query strings, not the Host header. Found in the code: `src/proxy.ts` redirects with `request.nextUrl.clone()`, an absolute URL built from the Host header, which behind CloudFront is the Function URL's host; make the redirect relative (`Location: /login`) or pass the viewer host. Rejected: Origin Access Control on the Function URL (it needs the browser to send `x-amz-content-sha256` with every POST body, which breaks photo uploads), and API Gateway (30 s limit; a receipt read can take longer). The deploy role cannot manage CloudFront or ACM yet: the builder updates stack `receipt-pro-bootstrap` once (`docs/runbooks/deploy.md`). Each device logs in once more on the new address (host-only cookie).

### T-015: M3 verification in the cloud

- **Type:** qa
- **Status:** backlog
- **Requirement:** `docs/work/mvp/requirements.md#success-measures`
- **Code:** none
- **Description:** OMT QA reruns the success measures on the deployed app, from the installed home-screen app and the Mac.
- **Acceptance:** Results in `docs/work/mvp/test-plan.md`; the epic is ready to archive.
- **Blocked by:** T-014
- **Notes:** From T-013 (builder, 2026-11-17): the M1 loop on the phone over mobile data, not Wi-Fi.
- **Notes:** Builder, 2026-11-15: manual edge-case tests on the real phones wait until here, at the end of the MVP. Collected so far: Wi-Fi off mid-upload, then retry (T-003; already covered by browser offline tests in WebKit and Chromium). From T-004 on, tasks are checked on the iPhone only; the Xiaomi checks of those tasks also wait until here (T-003 passed on both phones).

## Bugs Found in Verification

| Task  | Title                                        | Found in | Status            | Detail                                  |
| ----- | -------------------------------------------- | -------- | ----------------- | --------------------------------------- |
| T-017 | The fixed date rule beat the user's template | T-006    | done (2026-11-15) | `docs/records/completed-work/mvp-m1.md` |

### T-018: An upload fails when it meets another receipt's session update

- **Type:** bug
- **Status:** done (2026-11-15)
- **Found in:** a 100-receipt run for T-011, 2026-11-15: 20 photos picked at once, one upload failed with `TransactionCanceledException ... [None, TransactionConflict]`.
- **Completion:** Cause: `createReceipt`, `startAttempt`, and `finishAttempt` each run a `TransactWriteItems` that also bumps the `CURRENT_SESSION` item, DynamoDB cancels a transaction that meets another one on the same item, and the SDK does not retry it (`attempts: 1` in the error). Reproduced on the real table as a `smoke-test-` user: 10 parallel `createReceipt` calls for one user (`Promise.allSettled`), 3 rounds: 4, 3, and 2 of 10 saved, every failure `None/TransactionConflict`. Fix: `sendTransaction` (`src/server/repo/transact.ts`) sends the transaction again, up to 5 tries with a short random wait, when the only reason is a conflict; a failed condition still returns at once. After the fix: 10 of 10 in 3 rounds and 20 of 20 in 2 rounds. 158 unit tests (suite total), four new ones for the retry.
- **Code:** `src/server/repo/transact.ts`, `src/server/repo/receipts.ts`, `src/server/repo/__tests__/receipts.test.ts`

### T-019: On Lambda, every session change downloads all thumbnails again

- **Type:** bug
- **Status:** done (2026-11-16); the builder's own iPhone use is the last check
- **Found in:** T-013, 2026-11-15: in the builder's existing session on the deployed app, 新 session, 拍照, and 从相册选 stopped responding; a new session brought the page back.
- **Completion:** Cause, measured on the deployed app as a `smoke-test-` user: each Lambda instance signs photo URLs with its own temporary credentials (8 parallel reads gave 5 URLs for one photo), and every new URL made the browser download and decode the full photo again: with the phone and the Mac open, 10 uploads made the phone download 58 photos, 63 MB, for 12 receipts in 15 s. On the iPhone the full photos (about 12 MB decoded each) and the original-file upload previews (about 48 MB each) most likely exhausted memory; not reproduced on a real iPhone. Fix (builder's choice): the phone makes a 400 px copy at upload from the same decode (`preparePhoto`), stored as `<receiptId>.thumb.jpg` (`thumbKey` on the receipt, `thumbUrl` in the view); the list and the upload preview show it and the link opens the full photo; a card keeps the URL it shows until it fails to load (`src/client/stable-urls.ts`), asking for new URLs at most once a minute per receipt. After the deploy (run `43728904061`), the same 10 uploads: the phone downloaded 14 small copies, 0.70 MB, for 16 receipts, and the Mac 16, 0.79 MB; scrolling through loaded all 16 on the phone, no errors. 176 unit tests (suite total).
- **Code:** `src/client/compress-image.ts`, `src/client/stable-urls.ts`, `src/client/receipts-screen.tsx`, `src/client/upload-receipt.ts`, `src/server/upload-form.ts`, `src/server/photos.ts`, `src/server/receipt-view.ts`, `src/server/repo/receipts.ts`, `src/app/api/receipts/route.ts`

## Requests From Real Use

### T-020: See the full photo over the list, not in a new tab

- **Type:** feature
- **Status:** done (2026-11-16)
- **Requirement:** `docs/work/mvp/requirements.md#s-05-see-receipts-on-every-device` (criterion 3: a thumbnail that can be opened larger)
- **Completion:** Builder, 2026-11-16: a new tab had to be closed and switched back from. A tap on a thumbnail now shows the full photo in a viewer over the list (`src/client/photo-viewer.tsx`): 90% of the width and 75% of the height on the phone (at most 60 rem wide on the Mac), the whole photo visible, a round close button at the top right. The close button, a tap anywhere but the photo, and Escape close it; a tap on the photo does not; the list does not scroll behind it. Checked in WebKit (iPhone profile) and Chromium on the local production build, with screenshots; one tab throughout, no page errors.
- **Code:** `src/client/photo-viewer.tsx`, `src/client/photo-viewer.module.css`, `src/client/receipts-screen.tsx`, `src/client/receipts-screen.module.css`

### T-021: Redesign every page in the builder's chosen style

- **Type:** feature
- **Status:** done (2026-11-16)
- **Requirement:** `docs/work/mvp/requirements.md#non-functional-requirements` (ease of use; mobile first)
- **Completion:** Builder, 2026-11-16: the pages were too plain. Of three HTML mockups (kept out of git), the builder chose B, "warm notebook", as good enough for the MVP, and approved the built pages on a local test server before the push. Colours are CSS variables in `src/app/globals.css`: off-white background, orange primary, round corners. Phone: `receipt-pro` and a "⋯" menu (加规则, 新 session in red, 退出登录) at the top; at the bottom, a large round 拍照 between 相册 and 规则, above the iPhone's home indicator. Computer (from 900 px): header buttons 选照片, 加规则, 规则, 新 session; one row per receipt, a 14.5 rem photo beside the text, a large 复制, prices in bold. The card is `src/client/receipt-card.tsx`; `/rules` got its own 加规则; the 加规则 dialog, photo viewer, and `/login` share the style. Checked in WebKit (iPhone profile) and Chromium on the local production build with screenshots of every page; Mac copy equal to the shown text; no page errors. 176 unit tests (suite total).
- **Code:** `src/app/globals.css`, `src/app/layout.tsx`, `src/client/receipts-screen.tsx`, `src/client/receipt-card.tsx`, `src/client/receipt-text.tsx`, `src/client/logout.ts`, `src/client/*.module.css`, `src/client/rules-screen.tsx`, `src/client/login-screen.tsx`

### T-022: Item names keep their brand

- **Type:** feature
- **Status:** done (2026-11-16)
- **Requirement:** `docs/knowledge/business.md#output`
- **Completion:** Builder, 2026-11-16: 美心月饼 and 月饼 are different things. Fixed rule 4 in `src/server/ai/system-prompt.ts` now writes the printed brand plus a short Chinese name; the common Chinese brand name if there is one, otherwise as printed; a Chinese brand joined to the name, an English one followed by a space; nothing guessed; no store's own brand. Measured with `PROBE_THINKING=off pnpm exec tsx --env-file=.env.local scripts/probe-deepseek.ts probe-photos/*.HEIC` on the six real photos, two runs: brands appear for most printed ones (Swisse, 李施德林, 鸿运, 利口福, 南翔, 螺霸王, Indomie), spacing consistent. A first draft listed example brands and one was copied onto a receipt (東鵬特飲 → 维他奶); examples are now tied to printed text. Remaining reading noise, as in G-004: 韩龙/韩式 and 粮全其美/轻食 vary run to run, 東鵬 is missed, 柳全 once read as 柳州. Three new prompt tests.
- **Code:** `src/server/ai/system-prompt.ts`, `src/server/ai/__tests__/system-prompt.test.ts`

## Later (not in a milestone)

### T-016: Reset a forgotten password

- **Type:** feature
- **Status:** backlog (deferred by the builder, 2026-11-15)
- **Requirement:** none yet; S-01 has no reset
- **Knowledge:** `docs/knowledge/architecture.md#data-model` (the `PROFILE` item holds only a `scrypt` hash)
- **Code:** `scripts/`, `src/server/repo/users.ts`
- **Description:** Today a forgotten password cannot be recovered: the hash cannot be reversed, and `scripts/create-user.ts` refuses an account that exists. A reset script, run in the builder's own Terminal, would set a new password hash on the existing `PROFILE` and clear `failedLogins` and `lockedUntil`.
- **Notes:** Raised in T-006's sitting. Not needed for the MVP.
