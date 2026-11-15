# Architecture

> **Purpose:** How receipt-pro is built: components, data model, request flows, and the rules that keep it deployable to Lambda.
> **Status:** Current
> **Verified against:** Code at `c58c302` (M1 boundary review), 2026-11-15; builder decisions and DeepSeek docs, 2026-11-15
> **Primary code:** `src/app/`, `src/server/`

## Summary

One Next.js app (App Router, TypeScript, pnpm) serves both the pages and the API. Data lives
in DynamoDB, photos in S3, both in the builder's own AWS account in `ap-southeast-2`. There is
one environment: the local version on the Mac and the deployed version on Lambda use the same
table and bucket (ADR-005). Devices stay in sync by polling a session version
number. The server calls DeepSeek `deepseek-flash` with the photo and the user's settings.
The server never holds state between requests, so it fits Lambda unchanged.
(sources: `docs/records/meetings/2026-11-15_mvp-ideation-interview.md`,
`docs/records/meetings/2026-11-15_mvp-requirements-review.md`, ADR-001 to ADR-005)

## Components

| Component       | Choice                                                                                                                                           | Decision                             |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------ |
| Web app and API | Next.js, App Router, route handlers under `src/app/api/`                                                                                         | `docs/knowledge/tech-conventions.md` |
| Data            | DynamoDB, one table, on-demand billing                                                                                                           | ADR-003                              |
| Photos          | S3, one private bucket                                                                                                                           | ADR-003                              |
| AI              | DeepSeek `deepseek-flash` through the Vercel AI SDK, called only from the server                                                                 | ADR-001, ADR-006                     |
| Sync            | Polling a session version number every 3 seconds while the page is visible                                                                       | ADR-004                              |
| Identity        | Username and password; a signed, HTTP-only cookie (`rp_session`, 30 days, renewed on use) checked by `src/proxy.ts` and again in every API route | T-012                                |

## Environments

One environment (ADR-005):

| Where the app runs                                | Identity                                                                               | Table         | Bucket                     |
| ------------------------------------------------- | -------------------------------------------------------------------------------------- | ------------- | -------------------------- |
| The builder's Mac, `next dev` on the home network | IAM user `receipt-pro`, profile `receipt-pro`                                          | `receipt-pro` | `receipt-pro-photos-jasen` |
| Lambda, function `receipt-pro` (T-013, ADR-007)   | IAM role `receipt-pro-app`, within the permissions boundary `receipt-pro-app-boundary` | same          | same                       |

All created by hand in the builder's console on 2026-11-15. Verified the same day with profile `receipt-pro`: table `ACTIVE`, `PAY_PER_REQUEST`; a test object written, read back byte-identical (Chinese included), refused to an anonymous request (403), served through a presigned URL (200), and deleted. The IAM user's only permission is the
inline policy `receipt-pro-data`: item read/write on table `receipt-pro` in `ap-southeast-2`,
and object get/put/delete plus list on buckets named `receipt-pro-photos-*`. It cannot create or
delete tables or buckets. Data written while developing is real data.

Re-verify at any time with `pnpm check:aws` (`scripts/check-aws.ts`): it confirms the account,
that the table is readable and the bucket reachable, and that the key is denied
`s3:ListAllMyBuckets`. All four passed on 2026-11-15 with the shell's `AWS_PROFILE` still set to
another profile.

## Data Model

One DynamoDB table with string keys `PK` and `SK`. Every item belongs to a user, so login can
arrive without a data migration.

| Item            | PK                               | SK                                    | Attributes                                                                                                                                                                                          |
| --------------- | -------------------------------- | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Current session | `USER#<userId>`                  | `CURRENT_SESSION`                     | `sessionId`, `version` (number, incremented on every receipt change), `createdAt`, `previousSessionId` (the session it replaced, whose cleanup the next new session retries)                        |
| Settings        | `USER#<userId>`                  | `SETTINGS`                            | `template` (`{ text, updatedAt }` or absent), `words` (list of `{ id, source, target, updatedAt }`), `instructions` (list of `{ id, text, updatedAt }`), `version` (number, for conditional writes) |
| Receipt         | `SESSION#<sessionId>`            | `RECEIPT#<createdAt ISO>#<receiptId>` | `receiptId`, `userId`, `photoKey`, `thumbKey` (since T-019; absent on older receipts), `status`, `text`, `error`, `attempts`, `createdAt`, `updatedAt`                                              |
| User            | `USER#<userId>`                  | `PROFILE`                             | `username`, `passwordHash` (scrypt), `failedLogins`, `lockedUntil`, `createdAt`                                                                                                                     |
| Username lookup | `USERNAME#<normalised username>` | `USERNAME`                            | `userId`; written with `PROFILE` in one transaction, so login finds the user without a scan                                                                                                         |

- Receipt `status`: `processing` | `done` | `unreadable` | `failed`. A receipt in `processing` whose `updatedAt` is more than 2 minutes old is shown as `failed`, so nothing hangs forever.
- Settings is one item because a single user has few rules and every AI call reads all of them in one request.
- `attempts` counts processing runs. A run starts by raising it and setting `processing`; its result is written only if `attempts` is unchanged, so a slow earlier run never overwrites a newer one (T-004, used by T-009).
- The settings item is created by the first processing run, whatever its outcome, which saves the builder's usual template, with empty `words` and `instructions`; or by the first saved rule, if that comes first. A deleted template is saved again the same way on the next run.
- A word entry is keyed by its normalised `source` (trimmed, case-folded), so a new rule for the same source overrides the old one.

Photo keys: `photos/<userId>/<sessionId>/<receiptId>.jpg`, and the list's small copy
`photos/<userId>/<sessionId>/<receiptId>.thumb.jpg` (400 px, T-019). The browser shows both through
short-lived presigned GET URLs; the bucket is never public.

## Request Flows

### Capture and process

1. The phone compresses the photo in the browser to JPEG, longest side at most 2048 px, and makes a 400 px copy for the list from the same decode. This also turns iPhone HEIC into JPEG.
2. `POST /api/receipts` (multipart, JPEG only, at most 4 MB: `MAX_PHOTO_BYTES` in `src/server/upload-form.ts`) stores the photo in S3, then creates the receipt with `status: processing` and bumps the session `version` in one transaction, and returns at once. The phone chooses `receiptId` and `createdAt`; a retry with the same pair returns the stored receipt, so a lost response never makes a duplicate. Several photos upload one after another, not in parallel.
3. The phone then calls `POST /api/receipts/<receiptId>/process`. The server reads settings, calls DeepSeek, writes `text` and `status`, and bumps `version`.
4. The phone does not depend on the response to step 3. Every device, the phone included, learns the result by polling. If step 3's HTTP connection drops, the server still finishes, and the 2-minute rule catches a run that died.

Two steps rather than one keep step 2 fast and keep a slow AI call from timing out the upload.

### AI call

Each receipt is one independent request: no earlier receipts or conversation (ADR-006).

- System prompt: fixed output rules (only the receipt text, the three unreadable rules from `docs/knowledge/business.md#unreadable-receipts`), followed by the user's template, word list, and custom instructions.
- JSON output mode, `response_format: {"type": "json_object"}`, asking for `{"status": "ok" | "unreadable", "text": "..."}`. The server keeps only `text`. This is the code guard against conversational text that ADR-002 left to the prompt. JSON mode works together with image input through the AI SDK (T-002, `docs/knowledge/tech-conventions.md#resolved-deepseek-flash-accepts-images-through-the-ai-sdk-t-002-2026-11-15`).
- `temperature: 0`: the same photo gives the same text far more often (DeepSeek defaults to 1.0, and outputs of one receipt varied run to run). Not fully deterministic: in 3 runs on one stored photo, 1 dropped an item.
- Thinking mode off (`providerOptions.deepseek.thinking.type: "disabled"`): about 2 s per receipt instead of 3–38 s, and no less accurate on the builder's receipts (T-002).
- The photo is sent as upright pixels; the browser's re-encoding does this. A sideways photo with only an orientation tag is misread.
- A reply is accepted when it holds exactly one JSON object; text around it is dropped, and only `text` is kept (`src/server/ai/parse-reading.ts`). A blank reply or two objects (the invalid shape seen in T-002: a JSON object, free text, a second object) get one retry, then `status: failed` with a plain message. Each try has a 45 s timeout.
- After reading, code rewrites the leading date in the template's style (日 or not, the spacing after it), because exact spacing is the model's weak point (`src/server/ai/date-style.ts`, T-017).
- No template yet: the builder's usual template is used and saved (`docs/knowledge/business.md#output`).

### Sync

`GET /api/session?since=<version>&sessionId=<id>` returns `{ changed: false }` when both match,
or the whole current session (`sessionId`, `version`, receipts newest first) when they do not.
The session ID is compared too, because a new session starts at version 0 and can reach the old
number. Pages poll every 3 seconds while visible, one request at a time, and immediately when
they become visible again (`src/client/use-session-poll.ts`). They ask for the whole session
every 30 seconds while a receipt is `processing` (the 2-minute rule changes nothing in the
table) and at least every 30 minutes (presigned photo URLs expire).

### New session (M2)

`POST /api/session/new` writes a new `CURRENT_SESSION` (version 0) only if the current one is
still the one the page saw, so two devices pressing at once make one new session. Then it
deletes the old session's photos (by prefix, orphans included) and items. A failed cleanup is
not shown; the next new session retries it through `previousSessionId`. Settings do not change.
From 100 receipts (`SESSION_SIZE_PROMPT` in `src/shared/limits.ts`, provisional until G-003)
the page suggests a new session.

### Rules (M2)

`POST /api/rules/interpret` turns plain language into a proposed change plus a Chinese
explanation, and saves nothing. The page holds the dialog's conversation and sends it whole each turn (at most 12 turns); the server keeps nothing between requests. Which saved rule a proposal replaces is decided in code: a word by its normalised source, a template by the saved one. `POST /api/rules/apply` saves a confirmed proposal with a
conditional write on settings `version`. `GET /api/rules` and `DELETE /api/rules/<id>` back the
rules page.

## Deployment

Every push to `main` deploys through GitHub Actions (ADR-007, `docs/runbooks/deploy.md`). The
function runs the Next.js standalone server behind the AWS Lambda Web Adapter and is reached at a
public Function URL over HTTPS. CloudFormation stack `receipt-pro-app` (`deploy/app.yaml`) holds
the function, its role, the Function URL, and the log group; stack `receipt-pro-bootstrap`
(`deploy/bootstrap.yaml`) holds the GitHub OIDC provider, the deploy role, and the boundary. On
Lambda the app uses the function role's credentials; the account check still runs.

## Lambda Compatibility Rules

The local version must deploy to Lambda without a rewrite:

- No state in memory between requests. Read DynamoDB every time.
- No WebSockets, server-sent events, or other long-lived connections.
- No writes to the local file system outside `/tmp`.
- Request bodies stay well under 6 MB, the Lambda synchronous payload limit. Compressed photos are far below it.
