# receipt-pro

A personal project. It deploys to the owner's own AWS account (Lambda) and the owner's own
domain.

## Machine Rules

If `docs/local/machine-rules.md` exists, read it before any other work and follow it. It holds
rules for this machine that stay out of git.

## AWS Account

The app only ever talks to the AWS account in `RECEIPT_PRO_AWS_ACCOUNT_ID`, through the profile
in `RECEIPT_PRO_AWS_PROFILE`. Get AWS clients from `getAws()` in `src/server/aws.ts`; never
construct one elsewhere, and never rely on `AWS_PROFILE` or the default credential chain.
Rules: `docs/knowledge/tech-conventions.md#aws-account-safety`.

Never ask the owner to paste a secret (AWS keys, the DeepSeek key) into chat, and never have
them run `aws configure` through `!`: it echoes the key into the transcript. Secrets are typed
in the owner's own Terminal or written by the owner into `.env.local`.

## Context Routing

- Start with `docs/README.md`. Read only the current-truth, work, or runbook pages the task needs.
- Treat `docs/records/` and `docs/sources/` as historical evidence, not current behaviour.
- `docs/sources/inbox/` is the unprocessed source queue. Process it with OMT Digest. An empty inbox means nothing is waiting.
- Shared documentation is English only. Drafts, scratch notes, and non-English material go in the gitignored `docs/local/`.
- Per-task working notes go in the gitignored `.omt/`, never in `docs/`.
- When a directory has its own `AGENTS.md`, follow it for work in that scope.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
