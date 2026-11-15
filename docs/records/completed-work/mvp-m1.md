# Completed Work: MVP M1, Local Capture-to-Copy Loop

> **Epic:** `docs/work/mvp/README.md`
> **Accepted:** 2026-11-15, by the builder, in T-006 (`docs/work/mvp/test-plan.md`)
> **Boundary review:** OMT QA, 2026-11-15, at `main` @ `c58c302`

## Summary

M1 is accepted. The builder takes or picks receipt photos on the phone, and each one appears on
the Mac within seconds, without a refresh, as one line of text in the builder's template. One
tap copies the line, and it pastes into Word unchanged, Chinese included. All six planned tasks
are done, plus one bug found in verification (T-017). Reading accuracy is measured on six photos
only, so G-004 stays open. At the review, `pnpm check:all` passed: 154 unit tests in 24 files,
format, type check, and lint.

## Planned Versus Completed

| Task  | Planned                                    | Result                                                      |
| ----- | ------------------------------------------ | ----------------------------------------------------------- |
| T-001 | Scaffold, AWS account guard, dev resources | Done                                                        |
| T-002 | DeepSeek probe with real receipts          | Done                                                        |
| T-003 | Take a photo and see it in the list        | Done                                                        |
| T-004 | Generate the output text                   | Done, then fixed after the builder's review of real outputs |
| T-005 | See receipts on the computer and copy      | Done                                                        |
| T-006 | M1 verification with real receipts         | Done, accepted                                              |
| T-017 | Not planned: bug found in T-006            | Done                                                        |

Built during M1 but planned later, by the builder's choice to batch manual checks at the end:
T-007 to T-010 (M2) and T-012 (M3). T-006 checked them together with M1 (`docs/work/mvp/test-plan.md`).
They are accepted with their own milestones: M2 in T-011, M3 in T-015.

## Definition of Done

| Criterion                                                                                 | Result                                                                                                                                                                                           |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A photo from the iPhone or Xiaomi phone appears on the Mac within 5 s and turns into text | Met on the iPhone: three photos on the Mac in 5.4 s; one photo in text in 3.5 s. The Xiaomi phone passed T-003; its checks of T-004 onward wait for T-015                                        |
| Copy on the Mac, pasted into Word, gives exactly that text, Chinese included              | Met: Chrome and Safari, by the builder (T-005)                                                                                                                                                   |
| No output contains conversational text                                                    | Met: in every automated run and in the builder's sitting                                                                                                                                         |
| Unreadable receipts and failed AI calls show plain messages, never a copy button          | Met (T-004, T-006)                                                                                                                                                                               |
| No AWS resource outside the personal account; the app refuses any other account           | Met (T-001; `pnpm check:aws`)                                                                                                                                                                    |
| Reading accuracy and time per receipt are measured and recorded                           | Partly. Time: 2–4 s per receipt. Accuracy: measured once, on six photos in T-002 (item prices 31 of 34, dates and totals 6 of 6). The builder's evening batch was not counted receipt by receipt |

## Delivered, in the Builder's Terms

- On the phone: 拍照, or 从相册选 with several photos at once. Each photo is one receipt.
- Each receipt appears on the Mac in a few seconds, without a refresh, as one line in the builder's template.
- One tap copies the line. It pastes into Word exactly as shown, Chinese included.
- A photo that cannot be read says `看不清，请重拍`. A failed AI call says what went wrong. Neither has a copy button.
- The app works only with the builder's personal AWS account and refuses any other.

## Added and Deferred

**Added during M1:**

- One writing rule per output field, `temperature: 0`, and saving the builder's usual template instead of the first output. Added to T-004 after the builder reviewed outputs that mixed `现金` and `CASH`.
- T-017: the builder's date style lost to a fixed rule. Fixed the same day.
- Several photos at once from the library (T-003, builder's decision). S-02 criterion 1 does not say this yet.
- A retried upload never makes a duplicate receipt (T-003, builder's decision).

**Deferred:**

- To T-011: a session of 100 receipts; a Mac tab open for 8 hours.
- To T-015: Wi-Fi off during an upload on a real phone; every check of T-004 onward on the Xiaomi phone.
- G-004: accuracy counted receipt by receipt on a real evening's batch.

## Issues Found

| Issue                                                                                              | Found in                      | Outcome                                                   |
| -------------------------------------------------------------------------------------------------- | ----------------------------- | --------------------------------------------------------- |
| Outputs mixed `现金` and `CASH`, long and short merchant names, item sizes, traditional characters | The builder's review of T-004 | Fixed in T-004: one rule per field, `temperature: 0`      |
| The template's date style (no 日, three spaces after the date) was not followed                    | T-006                         | T-017, fixed: 0 of 6 wrong after the fix                  |
| Item misreads: two-line layouts, swapped prices on adjacent items, a dropped item, unknown brands  | T-002, T-004                  | Open (G-004)                                              |
| At `temperature: 0`, 1 of 3 runs on the same photo dropped an item                                 | T-004                         | Open (G-004)                                              |
| `next dev` went into a reload loop after a long run                                                | Development                   | A restart fixes it (`docs/knowledge/tech-conventions.md`) |
| The builder's Safari tab froze once (black screen)                                                 | Development                   | Not reproduced. T-011's 8-hour tab test looks for it      |

## Technical Debt Taken On Deliberately

- Thumbnails are the full 2048 px photos, loaded lazily. If T-011 shows the phone slowing down, small thumbnails made at upload are the likely fix.
- `SESSION_SIZE_PROMPT` in `src/shared/limits.ts` is 100, a guess until G-003 is measured.
- Code rewrites the leading date after reading (`src/server/ai/date-style.ts`). If the model misses more exact-format rules, the general fix is that the model returns fields and code writes the line. That changes ADR-002 and is the builder's call.
- No check that item prices add up to the subtotal. It would catch dropped items, not swapped prices. The builder decides after more real use.
- AWS credentials come from a named profile: `src/server/config.ts` requires `RECEIPT_PRO_AWS_PROFILE`, and `src/server/aws.ts` uses `fromIni`. Lambda has no profile, so T-013 changes both for role credentials.
- `scripts/probe-deepseek.ts` runs only on macOS (`sips`) with Pillow installed.

## Where the Code Wants Restructuring

The code is small: about 3,800 lines without tests. One file stands out.
`src/client/receipts-screen.tsx` (389 lines) is one component with eight state values. It holds
the upload queue, the receipt cards, copy, regenerate, new session, and the rule dialog. Split
it before T-014 adds install and offline behaviour to the same screen. It is not urgent.

## Gaps at the Boundary

- G-003 (session size): carried to T-011, which measures it.
- G-004 (reading accuracy): carried forward. T-015 reruns the success measures on the deployed app.
- G-005 (domain): carried to T-014.

## Recommendation

Proceed. Run T-011 next, then T-013. No restructuring is needed first. Two follow-ups go to their
owners: prd adds "several photos at once" to S-02 criterion 1; kanban updates the critical path
(T-012 is done, so T-011 no longer blocks it) and decides on the `receipts-screen.tsx` split.

## Task Detail

The task entries as they stood in `docs/work/mvp/tasks.md` at acceptance.

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

### T-017: The fixed date rule beat the user's template

- **Type:** bug
- **Status:** done (2026-11-15)
- **Found in:** T-006. The builder's rules dropped 日 and put three spaces after the date; receipts often still had 日 and one space.
- **Reproduce:** with the template `2026 年 10 月 1   Costco 青菜 3.25 水 2.0 啤酒 10.0 共1234，现金`, 6 of 6 readings wrote `1 日` and 6 of 6 missed the three spaces. Cause: fixed rule 2 said `日期写成 "2026 年 10 月 1 日" 这样`, and only rules 3 to 8 yielded to the user's.
- **Fix:** rule 2 now takes the date style from the template, and the user's template, word list, and instructions win over every fixed rule. `src/server/ai/date-style.ts` rewrites the leading date in the template's style (日 or not, the spacing after it), because exact spacing is the model's weak point: with the prompt fix alone, 3 of 6 still had two spaces; with both, 0 of 6.
- **Code:** `src/server/ai/system-prompt.ts`, `src/server/ai/date-style.ts`, `src/app/api/receipts/[id]/process/route.ts`
