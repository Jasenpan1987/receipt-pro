# Epic: mvp

> **Status:** in progress; M1 accepted 2026-11-15
> **Goal:** The capture-to-copy loop: phone photo in, one line of plain text out, copied on the computer into Word.
> **Current milestone:** M3, login and cloud (`docs/work/mvp/milestones.md#m3-login-and-cloud`); M2's verification T-011 is in backlog
> **Current task:** T-015, M3 verification in the cloud (unblocked by T-014). Done: T-001 to T-010, T-012 to T-014, T-017 to T-022

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

Requirements v1.1. M1 is accepted (`docs/records/completed-work/mvp-m1.md`). M2's features are
built; its verification T-011 waits in backlog. The app runs on Lambda in the personal account
at `https://receipts.jasenpan.com` through CloudFront (T-014), deployed by GitHub Actions on every
push to `main` that changes more than docs (ADR-007, `docs/runbooks/deploy.md`). Since the first real use (2026-11-16): small
thumbnails and stable photo URLs (T-019), the photo viewer (T-020), design B on every page
(T-021), and item names with their brand (T-022). Table `receipt-pro` and bucket
`receipt-pro-photos-jasen` are the one environment shared by the Mac and Lambda (ADR-005). Reading
accuracy is measured on six photos only (G-004).

## Next Action

T-015: M3 verification on the deployed app at `https://receipts.jasenpan.com`, from the installed
home-screen app and the Mac; its notes collect the phone checks waiting for it, T-014's included.
