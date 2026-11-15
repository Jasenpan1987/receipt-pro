# Runbook: Deploy

> **Purpose:** How the app reaches Lambda, how to set deployment up once, change a secret, roll back, and read logs.
> **Status:** Current
> **Verified against:** the first successful deploy, run `43718373723`, 2026-11-15

Why it is built this way: `docs/records/decisions/ADR-007-deploy-lambda-github-actions.md`.

## How a Deploy Happens

Every push to `main` runs the workflow **Deploy** (`.github/workflows/deploy.yml`):

1. **Check and build** (Linux arm64): `oxfmt --check`, `pnpm type`, `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm package:lambda`. A failure here deploys nothing.
2. **Deploy** (environment `production`): updates stack `receipt-pro-app` from `deploy/app.yaml`, uploads `dist/lambda.zip` to function `receipt-pro`, then checks that `/login` answers 200.

Watch it with `gh run watch` or on the repository's Actions page. Run it again without a push:
Actions → Deploy → Run workflow, or `gh workflow run Deploy`.

## One-Time Setup

Done once per AWS account, by the builder, with an administrator in the console.

1. CloudFormation console, region **Asia Pacific (Sydney) ap-southeast-2** → **Create stack** → **With new resources (standard)**.
2. **Upload a template file** → `deploy/bootstrap.yaml` from the repository.
3. Stack name `receipt-pro-bootstrap`. Keep the parameter defaults. `GitHubRepository` is in GitHub's immutable OIDC form, `owner@owner-id/name@repo-id`; for another repository, take it from `gh api repos/<owner>/<name>/actions/oidc/customization/sub` (`sub_claim_prefix`, without `repo:`).
4. Tick the box that acknowledges that the stack creates IAM resources with custom names, then submit.
5. When the stack shows `CREATE_COMPLETE`, open **Outputs** and copy `DeployRoleArn`.
6. GitHub → the repository → Settings → Environments → `production` → add secret `AWS_DEPLOY_ROLE_ARN` with that value.

Environment `production` must also hold `DEEPSEEK_API_KEY` and `SESSION_SECRET` (at least 32
characters, a new value, not the one in `.env.local`), and allow deployments from `main` only.
Make a session secret in your own Terminal, never in a chat:

```sh
node -e 'console.log(require("crypto").randomBytes(48).toString("base64url"))'
```

## Change a Secret

1. Update the secret in GitHub → Settings → Environments → `production`.
2. Run the workflow again (Actions → Deploy → Run workflow). The stack passes the new value to the function.

A new `SESSION_SECRET` logs every device out once.

## Roll Back

Revert the bad commit and push it to `main`; the workflow deploys the reverted code. Re-running
an older successful run also works, but the next push deploys `main` again.

## Find the App and Its Logs

- Address: Lambda console → function `receipt-pro` → **Function URL**; or CloudFormation → stack `receipt-pro-app` → **Outputs** → `Url`. The workflow masks it in the public logs.
- Logs: CloudWatch → Log groups → `/aws/lambda/receipt-pro` (kept 14 days).

## Remove Everything

Delete stack `receipt-pro-app`, then stack `receipt-pro-bootstrap`. The table and the photo
bucket are not in either stack and stay (ADR-005).
