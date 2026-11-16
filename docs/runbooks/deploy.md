# Runbook: Deploy

> **Purpose:** How the app reaches Lambda, how to set deployment up once, change a secret, roll back, and read logs.
> **Status:** Current
> **Verified against:** the first successful deploy, run `43718373723`, 2026-11-15; certificate, CloudFront, and DNS added by T-014, first run `43895844512`, 2026-11-17

Why it is built this way: `docs/records/decisions/ADR-007-deploy-lambda-github-actions.md`.

## How a Deploy Happens

Every push to `main` runs the workflow **Deploy** (`.github/workflows/deploy.yml`), unless it changes
only `docs/`, Markdown files, or `.vscode/` (builder, 2026-11-16):

1. **Check and build** (Linux arm64): `oxfmt --check`, `pnpm type`, `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm package:lambda`. A failure here deploys nothing.
2. **Deploy** (environment `production`, Linux arm64 as well): updates stack `receipt-pro-cert` in us-east-1 from `deploy/cert.yaml` (the certificate), then stack `receipt-pro-app` from `deploy/app.yaml` (function, CloudFront, DNS records), uploads `dist/lambda.zip` to function `receipt-pro`, then checks that `/login` answers 200 at the Function URL and at `https://receipts.jasenpan.com`.

The first deploy with a new certificate or distribution takes longer: the certificate waits for its
DNS validation (usually a few minutes), and a new or changed distribution takes 5 to 15 minutes.

Watch it with `gh run watch` or on the repository's Actions page. Run it again without a push:
Actions → Deploy → Run workflow, or `gh workflow run Deploy`.

If a job fails with "The job was not started because it repeatedly failed to be acquired",
GitHub found no runner for it, and nothing reached AWS. Re-run the failed job:
`gh run rerun <run-id> --failed`. On 2026-11-16 this happened twice in a row to the deploy job on
`ubuntu-24.04`; it now runs on `ubuntu-24.04-arm`, like the build, and installs the AWS CLI if the
image lacks it.

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

## Update the Bootstrap Stack

Needed when `deploy/bootstrap.yaml` changes, for example when the deploy role needs a new
permission (T-014 added CloudFront, ACM, and the app's Route 53 records). Until then, a deploy that
needs the new permission fails with `AccessDenied` and changes nothing. With an administrator:

1. CloudFormation console, region **Asia Pacific (Sydney) ap-southeast-2** → stack `receipt-pro-bootstrap`.
2. **Update stack** → **Make a direct update** → **Replace existing template** → **Upload a template file** → `deploy/bootstrap.yaml`.
3. Keep every parameter. New parameters show their defaults; `AppDomainName` and `HostedZoneId` must equal `APP_DOMAIN` and `HOSTED_ZONE_ID` in `.github/workflows/deploy.yml`.
4. Tick the box that acknowledges IAM resources with custom names, then submit.
5. Wait for `UPDATE_COMPLETE`. The deploy role ARN does not change; the GitHub secret stays.

Then run the workflow again (Actions → Deploy → Run workflow), or push.

## Change a Secret

1. Update the secret in GitHub → Settings → Environments → `production`.
2. Run the workflow again (Actions → Deploy → Run workflow). The stack passes the new value to the function.

A new `SESSION_SECRET` logs every device out once.

## Roll Back

Revert the bad commit and push it to `main`; the workflow deploys the reverted code. Re-running
an older successful run also works, but the next push deploys `main` again.

## Find the App and Its Logs

- Address: `https://receipts.jasenpan.com` (stack `receipt-pro-app` → **Outputs** → `DomainUrl`).
- Function URL, which CloudFront forwards to: Lambda console → function `receipt-pro` → **Function URL**; or stack `receipt-pro-app` → **Outputs** → `Url`. The workflow masks it in the public logs.
- Logs: CloudWatch → Log groups → `/aws/lambda/receipt-pro` (kept 14 days).

## Remove Everything

Delete stack `receipt-pro-app` (Sydney), then stack `receipt-pro-cert` (N. Virginia, us-east-1),
then stack `receipt-pro-bootstrap`. Deleting `receipt-pro-app` removes the app's DNS records; the
hosted zone `jasenpan.com` and its other records stay. The table and the photo bucket are not in
any stack and stay (ADR-005).
