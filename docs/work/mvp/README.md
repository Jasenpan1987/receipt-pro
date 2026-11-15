# Epic: mvp

> **Status:** in progress; M1 accepted 2026-11-15
> **Goal:** The capture-to-copy loop: phone photo in, one line of plain text out, copied on the computer into Word.
> **Current milestone:** M2, rules, regenerate, sessions (`docs/work/mvp/milestones.md#m2-rules-regenerate-sessions`); M3's T-012 is done early
> **Current task:** T-011 (M2 verification, automated by QA); then T-013, which needs the builder (T-001 to T-010, T-012, and T-017 done 2026-11-15)

## Read First

| What                                   | Where                                   |
| -------------------------------------- | --------------------------------------- |
| Requirements                           | `docs/work/mvp/requirements.md`         |
| Tasks and critical path                | `docs/work/mvp/tasks.md`                |
| Milestones                             | `docs/work/mvp/milestones.md`           |
| What shipped in M1, and its review     | `docs/records/completed-work/mvp-m1.md` |
| Open questions                         | `docs/work/mvp/gaps.md`                 |
| Architecture                           | `docs/knowledge/architecture.md`        |
| Behaviour rules                        | `docs/knowledge/business.md`            |
| Terms                                  | `docs/knowledge/glossary.md`            |
| Settled technology, AWS account safety | `docs/knowledge/tech-conventions.md`    |

## Primary Modules

| Module                             | Role                                                                                                         |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `src/server/config.ts`             | Validated environment configuration                                                                          |
| `src/server/aws.ts`                | DynamoDB and S3 clients pinned to the personal account; get them from `getAws()`                             |
| `src/instrumentation.ts`           | Startup validation                                                                                           |
| `scripts/check-aws.ts`             | `pnpm check:aws`                                                                                             |
| `src/app/`                         | Pages (receipts, `/rules`, `/login`) and API routes (`api/receipts`, `api/session`, `api/rules`, `api/auth`) |
| `src/server/rules/`                | Turning a plain-language rule into a checked proposal, and saving it                                         |
| `src/server/auth/`, `src/proxy.ts` | Passwords, the signed session cookie, and the login check on every request                                   |
| `src/client/`                      | Browser code: the receipts screen, photo re-encoding, upload                                                 |
| `src/server/repo/`                 | DynamoDB access; every function takes `userId` or `sessionId` explicitly                                     |
| `src/server/ai/`                   | The fixed rules and prompt (`system-prompt.ts`), the DeepSeek call, and the reply parser                     |

## Current State

Requirements v1.1. Fifteen tasks in three milestones, plus bug T-017 and the deferred T-016.
M1 is accepted (2026-11-15): a photo taken on the phone becomes one line of text in the builder's
template within a few seconds, appears on the computer without a refresh, and copies into Word
(`docs/records/completed-work/mvp-m1.md`). M2's features are built (T-007 to T-010): rules in
plain language, the rules page, regenerate, and new session. Login (T-012) is built and in use
locally. Table `receipt-pro` and bucket `receipt-pro-photos-jasen` are the one environment
(ADR-005). Only the personal AWS account is ever used
(`docs/knowledge/tech-conventions.md#aws-account-safety`). Reading accuracy is measured on six
photos only (G-004).

## Next Action

T-011: QA automates a 100-receipt session and an 8-hour open tab as a `smoke-test-` user, and
measures G-003. Then T-013 (deploy to Lambda), which needs the builder: a deployment IAM user and
its key on a new profile, made together (see its notes).
