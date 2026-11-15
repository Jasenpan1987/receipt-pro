# Architecture

> **Purpose:** How receipt-pro is built: components, data model, request flows, and the rules that keep it deployable to Lambda.
> **Status:** Current (design; M1 scaffold in code)
> **Verified against:** Builder decisions, 2026-11-15; DeepSeek docs, 2026-11-15
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

| Component       | Choice                                                                           | Decision                                                      |
| --------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Web app and API | Next.js, App Router, route handlers under `src/app/api/`                         | `docs/knowledge/tech-conventions.md`                          |
| Data            | DynamoDB, one table, on-demand billing                                           | ADR-003                                                       |
| Photos          | S3, one private bucket                                                           | ADR-003                                                       |
| AI              | DeepSeek `deepseek-flash` through the Vercel AI SDK, called only from the server | ADR-001, ADR-006                                              |
| Sync            | Polling a session version number every 3 seconds while the page is visible       | ADR-004                                                       |
| Identity        | One built-in user (`LOCAL_USER_ID`) until login lands in M3                      | `docs/records/meetings/2026-11-15_mvp-requirements-review.md` |

## Environments

One environment (ADR-005):

| Where the app runs                                | Identity                                      | Table         | Bucket                     |
| ------------------------------------------------- | --------------------------------------------- | ------------- | -------------------------- |
| The builder's Mac, `next dev` on the home network | IAM user `receipt-pro`, profile `receipt-pro` | `receipt-pro` | `receipt-pro-photos-jasen` |
| Lambda (M3)                                       | IAM role created at deployment                | same          | same                       |

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

| Item            | PK                    | SK                                    | Attributes                                                                                                                                                                                          |
| --------------- | --------------------- | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Current session | `USER#<userId>`       | `CURRENT_SESSION`                     | `sessionId`, `version` (number, incremented on every receipt change), `createdAt`                                                                                                                   |
| Settings        | `USER#<userId>`       | `SETTINGS`                            | `template` (`{ text, updatedAt }` or absent), `words` (list of `{ id, source, target, updatedAt }`), `instructions` (list of `{ id, text, updatedAt }`), `version` (number, for conditional writes) |
| Receipt         | `SESSION#<sessionId>` | `RECEIPT#<createdAt ISO>#<receiptId>` | `receiptId`, `userId`, `photoKey`, `status`, `text`, `error`, `attempts`, `createdAt`, `updatedAt`                                                                                                  |
| User (M3)       | `USER#<userId>`       | `PROFILE`                             | `username`, `passwordHash`, `createdAt`                                                                                                                                                             |

- Receipt `status`: `processing` | `done` | `unreadable` | `failed`. A receipt in `processing` whose `updatedAt` is more than 2 minutes old is shown as `failed`, so nothing hangs forever.
- Settings is one item because a single user has few rules and every AI call reads all of them in one request.
- A word entry is keyed by its normalised `source` (trimmed, case-folded), so a new rule for the same source overrides the old one.

Photo keys: `photos/<userId>/<sessionId>/<receiptId>.jpg`. The browser shows a photo through a
short-lived presigned GET URL; the bucket is never public.

## Request Flows

### Capture and process

1. The phone compresses the photo in the browser to JPEG, longest side at most 2048 px. This also turns iPhone HEIC into JPEG.
2. `POST /api/receipts` (multipart) stores the photo in S3, creates the receipt with `status: processing`, bumps the session `version`, and returns `receiptId` at once.
3. The phone then calls `POST /api/receipts/<receiptId>/process`. The server reads settings, calls DeepSeek, writes `text` and `status`, and bumps `version`.
4. The phone does not depend on the response to step 3. Every device, the phone included, learns the result by polling. If step 3's HTTP connection drops, the server still finishes, and the 2-minute rule catches a run that died.

Two steps rather than one keep step 2 fast and keep a slow AI call from timing out the upload.

### AI call

Each receipt is one independent request: no earlier receipts or conversation (ADR-006).

- System prompt: fixed output rules (only the receipt text, the three unreadable rules from `docs/knowledge/business.md#unreadable-receipts`), followed by the user's template, word list, and custom instructions.
- JSON output mode, `response_format: {"type": "json_object"}`, asking for `{"status": "ok" | "unreadable", "text": "..."}`. The server keeps only `text`. This is the code guard against conversational text that ADR-002 left to the prompt. JSON mode works together with image input through the AI SDK (T-002, `docs/knowledge/tech-conventions.md#resolved-deepseek-flash-accepts-images-through-the-ai-sdk-t-002-2026-11-15`).
- Thinking mode off (`providerOptions.deepseek.thinking.type: "disabled"`): about 2 s per receipt instead of 3–38 s, and no less accurate on the builder's receipts (T-002).
- The photo is sent as upright pixels; the browser's re-encoding does this. A sideways photo with only an orientation tag is misread.
- Blank or invalid JSON (the docs say blank content can happen) gets one retry, then `status: failed`. The invalid replies seen in T-002 were a JSON object, free text, then a second JSON object; strict parsing rejects them.
- No template yet: the returned `text` is saved as the template.

### Sync

`GET /api/session?since=<version>` returns `{ changed: false }` when nothing changed, or the
whole current session (`sessionId`, `version`, receipts newest first) when it did. Pages poll
every 3 seconds while visible and immediately when they become visible again.

### Rules (M2)

`POST /api/rules/interpret` turns plain language into a proposed change plus a Chinese
explanation, and saves nothing. `POST /api/rules/apply` saves a confirmed proposal with a
conditional write on settings `version`. `GET /api/rules` and `DELETE /api/rules/<id>` back the
rules page.

## Lambda Compatibility Rules

The local version must deploy to Lambda without a rewrite:

- No state in memory between requests. Read DynamoDB every time.
- No WebSockets, server-sent events, or other long-lived connections.
- No writes to the local file system outside `/tmp`.
- Request bodies stay well under 6 MB, the Lambda synchronous payload limit. Compressed photos are far below it.
