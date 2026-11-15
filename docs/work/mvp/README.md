# Epic: mvp

> **Status:** planned; M1 in progress
> **Goal:** The capture-to-copy loop: phone photo in, one line of plain text out, copied on the computer into Word.
> **Current milestone:** M1, local capture-to-copy loop (`docs/work/mvp/milestones.md#m1-local-capture-to-copy-loop-committed`)
> **Current task:** T-002 and T-003, ready (T-001 done 2026-11-15)

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

| Module                   | Role                                                                             |
| ------------------------ | -------------------------------------------------------------------------------- |
| `src/server/config.ts`   | Validated environment configuration                                              |
| `src/server/aws.ts`      | DynamoDB and S3 clients pinned to the personal account; get them from `getAws()` |
| `src/instrumentation.ts` | Startup validation                                                               |
| `scripts/check-aws.ts`   | `pnpm check:aws`                                                                 |
| `src/app/`               | Pages (placeholder until T-003)                                                  |

## Current State

Requirements v1.1 reviewed. Fifteen tasks in three milestones. AWS profile `receipt-pro` verified (G-009).
Table `receipt-pro` and bucket `receipt-pro-photos-jasen` exist and are verified (one environment, ADR-005). T-001 is done: scaffold, account guard, and `pnpm check:aws` all pass. Only the personal AWS account is ever used (`docs/knowledge/tech-conventions.md#aws-account-safety`).

## Next Action

OMT Work starts T-003 (photo to list), or T-002 once the builder has written `DEEPSEEK_API_KEY` into `.env.local` and supplied 3–5 real receipt photos. Both must finish before T-004.
