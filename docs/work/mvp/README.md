# Epic: mvp

> **Status:** planned; M1 in progress
> **Goal:** The capture-to-copy loop: phone photo in, one line of plain text out, copied on the computer into Word.
> **Current milestone:** M1, local capture-to-copy loop (`docs/work/mvp/milestones.md#m1-local-capture-to-copy-loop-committed`)
> **Current task:** T-008, ready (T-001 to T-005, T-007, T-009, T-010 done 2026-11-15); T-006 waits for the builder

## Read First

| What                                   | Where                                |
| -------------------------------------- | ------------------------------------ |
| Requirements                           | `docs/work/mvp/requirements.md`      |
| Tasks and critical path                | `docs/work/mvp/tasks.md`             |
| Milestones                             | `docs/work/mvp/milestones.md`        |
| Open questions                         | `docs/work/mvp/gaps.md`              |
| Architecture                           | `docs/knowledge/architecture.md`     |
| Behaviour rules                        | `docs/knowledge/business.md`         |
| Terms                                  | `docs/knowledge/glossary.md`         |
| Settled technology, AWS account safety | `docs/knowledge/tech-conventions.md` |

## Primary Modules

| Module                   | Role                                                                                     |
| ------------------------ | ---------------------------------------------------------------------------------------- |
| `src/server/config.ts`   | Validated environment configuration                                                      |
| `src/server/aws.ts`      | DynamoDB and S3 clients pinned to the personal account; get them from `getAws()`         |
| `src/instrumentation.ts` | Startup validation                                                                       |
| `scripts/check-aws.ts`   | `pnpm check:aws`                                                                         |
| `src/app/`               | Page and API routes (`api/receipts`, `api/session`)                                      |
| `src/client/`            | Browser code: the receipts screen, photo re-encoding, upload                             |
| `src/server/repo/`       | DynamoDB access; every function takes `userId` or `sessionId` explicitly                 |
| `src/server/ai/`         | The fixed rules and prompt (`system-prompt.ts`), the DeepSeek call, and the reply parser |

## Current State

Requirements v1.1 reviewed. Fifteen tasks in three milestones. AWS profile `receipt-pro` verified (G-009).
Table `receipt-pro` and bucket `receipt-pro-photos-jasen` exist and are verified (one environment, ADR-005). T-001 to T-005 are done: a photo taken on the phone becomes one line of text in the builder's template within a few seconds, appears on the computer without a refresh, and copies into Word (T-002 findings in `docs/knowledge/tech-conventions.md#real-receipts-t-002-2026-11-15`). Only the personal AWS account is ever used (`docs/knowledge/tech-conventions.md#aws-account-safety`).

## Next Action

OMT Work does T-008 (see and delete rules). T-006, the M1 verification, runs with the builder in one sitting; its notes list the manual checks collected so far.
