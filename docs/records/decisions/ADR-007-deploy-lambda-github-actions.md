# ADR-007: Deploy to One Lambda Through GitHub Actions and OIDC

**Date:** 2026-11-15
**Status:** accepted
**Decision makers:** Builder (deploy tool, CI, trigger, branch flow); Claude (details in the templates)
**Supersedes:** the T-013 plan of a deployment IAM user with a key on the Mac (agreed 2026-11-15, never built)

## Context

T-013 puts the app on Lambda in the personal account, reachable over HTTPS, with no always-on
cost (`docs/work/mvp/requirements.md#technical-constraints`). The repository is public. The Mac
also holds profiles for other AWS accounts, so a long-lived key that can create AWS resources should not
live there. The builder wanted CI, and every push to `main` to deploy.

## Decision

- **Runtime:** one Lambda function, `receipt-pro` (Node.js 22, arm64, 1024 MB, 120 s), running
  the Next.js standalone server (`output: "standalone"`) behind the AWS Lambda Web Adapter layer
  (v1.1.0, layer version 30). `deploy/run.sh` starts the server on port 8080.
- **Address:** a public Lambda Function URL (HTTPS, auth `NONE`, buffered). The app's own login
  decides who gets in. The builder's domain comes later (T-014).
- **Infrastructure as code:** `deploy/app.yaml`, CloudFormation stack `receipt-pro-app`: the
  function, its role `receipt-pro-app`, the Function URL with its two permissions, and log group
  `/aws/lambda/receipt-pro` (14 days). The table and bucket stay outside it (ADR-005).
- **Deploy access:** `deploy/bootstrap.yaml`, stack `receipt-pro-bootstrap`, uploaded once by the
  builder: the GitHub OIDC provider, role `receipt-pro-deploy`, and the permissions boundary
  `receipt-pro-app-boundary`. Only GitHub tokens for environment `production` of this repository
  can assume the role. The role can only manage the app stack's resources, and can only create
  the app role with the boundary, so the app role can never exceed the table, the bucket, and its
  logs. No AWS key exists for deployment.
- **CI:** `.github/workflows/deploy.yml`. Every push to `main` runs format, type check, lint,
  tests, build, and packaging on Linux arm64 (the standalone build carries native packages),
  then a separate deploy job in environment `production` deploys the stack and uploads
  `dist/lambda.zip` (13.5 MB; direct uploads allow 50 MB). Only the deploy job has the OIDC
  permission and the secrets, and it installs no npm packages. Code goes straight to `main`, no
  pull requests. Claude reports every deploy's result to the builder.
- **Secrets:** `DEEPSEEK_API_KEY`, `SESSION_SECRET` (a new value, not the local one), and
  `AWS_DEPLOY_ROLE_ARN` are secrets of environment `production`, entered by the builder. They
  reach the function as environment variables through `NoEcho` stack parameters.
- **Credentials in the app:** off Lambda, the `receipt-pro` profile as before. On Lambda
  (`AWS_LAMBDA_FUNCTION_NAME` set), the function role's credentials from the environment
  (`fromEnv`). The account check runs either way.

## Consequences

- Nothing is billed by the hour: Lambda, the Function URL, and CloudWatch Logs charge per use.
- A push to `main` is a release. A failed check or build deploys nothing. A rollback is a revert
  pushed to `main`, or re-running an earlier successful workflow run.
- Workflow logs are public: the workflow masks the account ID and the app's address, and prints
  no secret.
- The Function URL is public. Anyone who learns it can send requests, each a small Lambda
  charge; there is no concurrency cap yet.
- CloudFormation does not manage the function's code: the stack holds a placeholder, and the
  workflow uploads the real code after each stack update.

## Alternatives Considered

- **OpenNext with SST:** fuller Next.js support and CloudFront included, but a new tool, more
  than ten resources including its own state bucket, and Next.js 16.4 support not confirmed.
- **Deploying from the Mac with a deployment IAM user:** simpler at first, but a long-lived key
  with create rights on a Mac that holds profiles for other accounts, and deploys tied to that Mac.
- **AWS Lambda Web Functions** (launched 2026-10; native HTTP, billed for active CPU time): AWS
  recommends it for new Node.js web apps, but it is not offered in `ap-southeast-2`, where the
  data is. Worth revisiting when Sydney has it.
- **Repository secrets instead of an environment:** every workflow of the repository could read
  them; the environment limits them to the deploy job from `main`.

## Evidence

- Builder's choices in chat, 2026-11-15: option A (one Lambda), CI option 1 (GitHub Actions with
  OIDC), deploy when tests pass and report each deploy, push straight to `main`.
- `cfn-lint` and `actionlint`: no findings on the templates and the workflow (2026-11-15).
- The unzipped `dist/lambda.zip`, started as `deploy/run.sh` does, served `/login` (200), static
  assets (200), and answered `/api/session` with 401 without a cookie (2026-11-15, on the Mac).
- Lambda Web Functions regions: `https://aws.amazon.com/about-aws/whats-new/2026/10/aws-lambda-web-functions/`.
- Function URL permissions: `https://docs.aws.amazon.com/lambda/latest/dg/urls-auth.html`.
