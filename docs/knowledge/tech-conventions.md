# Tech Conventions

> **Purpose:** Technical choices the builder has settled. Architecture detail goes in `docs/knowledge/architecture.md`.
> **Status:** Current
> **Verified against:** Builder interview, 2026-11-15; code at `c58c302` (M1 boundary review), 2026-11-15

## Summary

One standalone, mobile-first web app built on an isomorphic full-stack framework such as
Next.js, installed as a PWA, hosted on Lambda in the builder's own AWS account under the
builder's own domain. The AI is DeepSeek. Cheapest working option first, but never at the
cost of robustness. (source: `docs/records/meetings/2026-11-15_mvp-ideation-interview.md`)

## Settled

| Area            | Choice                                                                                                                             | Note                                                                                                                                                     |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework       | Next.js, App Router, TypeScript, pnpm                                                                                              | `docs/knowledge/architecture.md`                                                                                                                         |
| Data and photos | DynamoDB table `receipt-pro` and bucket `receipt-pro-photos-jasen` in `ap-southeast-2`, one environment shared by local and Lambda | ADR-003, ADR-005; see [AWS Account Safety](#aws-account-safety)                                                                                          |
| Sync            | Polling a session version every 3 seconds                                                                                          | ADR-004                                                                                                                                                  |
| Tests           | Vitest                                                                                                                             | Setup in [Tooling](#tooling)                                                                                                                             |
| Styling         | CSS Modules                                                                                                                        | Builder's choice, 2026-11-15: built into Next.js, no extra dependency                                                                                    |
| Shape           | One standalone site                                                                                                                | Not a micro frontend, not a monorepo. One app serves pages and API                                                                                       |
| Client          | Mobile-first PWA, home screen on iPhone and Xiaomi                                                                                 | Desktop browser must work too: that is where the text gets copied                                                                                        |
| Hosting         | AWS Lambda in the builder's own account, the builder's own domain                                                                  | Local version first; the domain is chosen at deployment                                                                                                  |
| AI              | DeepSeek API, `deepseek-flash` for reading photos                                                                                  | Only `deepseek-flash` accepts images. See `docs/records/decisions/ADR-001-deepseek-for-receipt-reading.md`                                               |
| AI library      | Vercel AI SDK (`ai`, `@ai-sdk/deepseek`)                                                                                           | Builder's choice, 2026-11-15: switching to another model if DeepSeek disappoints is a provider change, not a rewrite. All calls live in `src/server/ai/` |
| Login           | Username and password                                                                                                              | Biometric and Google login later                                                                                                                         |
| Cost            | Cheapest option that works                                                                                                         | Personal account, personal money                                                                                                                         |
| Robustness      | No lag, breakage, or garbled text after long use                                                                                   | Chinese text must survive copy and paste intact                                                                                                          |

## Tooling

Settled with the builder in T-001 (2026-11-15). One Next.js app serves both pages and API.

| Area                  | Setting                                                                                                                                                                                                                                                                              |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Package               | One package, `"type": "module"`, `packageManager` pinned, exact versions (no `^`)                                                                                                                                                                                                    |
| pnpm settings         | `pnpm-workspace.yaml` (pnpm reads settings there even with one package): `minimumReleaseAge: 1440` (a release must be one day old before install), `blockExoticSubdeps: true`, `allowBuilds` lists which packages may run install scripts                                            |
| Format                | oxfmt, `.oxfmtrc.json`: LF, 2 spaces, no trailing commas, `arrowParens: avoid`, sorted imports. Markdown under `docs/` is formatted too                                                                                                                                              |
| Lint                  | oxlint with `--type-aware` (oxlint-tsgolint), `.oxlintrc.json`, with the `nextjs` plugin. `import/no-default-export` stays on, except for files where Next.js requires a default export                                                                                              |
| Type check            | TypeScript 7, `tsc --pretty`. `strict: true` with `noImplicitAny: false` and `useUnknownInCatchVariables: false`, `moduleResolution: bundler`, `verbatimModuleSyntax`, `isolatedModules`, `types: ["vitest/globals", "node"]`, path alias `src/*`. Plus the options Next.js requires |
| Tests                 | Vitest: `globals: true`, `environment: node`, tests in `__tests__/` folders named `*.test.ts(x)`, `resolve.tsconfigPaths: true`, `passWithNoTests: true`                                                                                                                             |
| Scripts               | `format`, `lint`, `lint:fix`, `type`, `test`; `check` = format, then type and lint in parallel; `check:all` = `check` plus tests                                                                                                                                                     |
| Git hook              | husky `pre-commit`: format, re-stage the staged files that oxfmt changed, then lint and type in parallel. `pre-commit` and `commit-msg` also run `docs/local/hooks/<hook>` when this machine has one                                                                                 |
| Line endings          | `.gitattributes`: LF everywhere, binary types never normalised                                                                                                                                                                                                                       |
| Editor                | `.vscode/settings.json`: oxc formatter on save, type-aware oxc, tsgo                                                                                                                                                                                                                 |
| Browsers              | `browserslist`: `chrome >= 109`, `edge >= 121`, `firefox >= 115`, `safari >= 16`                                                                                                                                                                                                     |
| Scripts in `scripts/` | Run with `tsx`; linted with the same rules as `src/`, because they talk to AWS                                                                                                                                                                                                       |
| Message language      | User-facing text is Chinese. Developer-facing messages (configuration and AWS errors, server logs, terminal output) are English                                                                                                                                                      |

Rule: run `pnpm check:all` before reporting work as done.

Checked 2026-11-15 with a throwaway app: Next.js 16.4.6 builds with TypeScript 7.0.2, and
`tsc` passes. On its first run, `next build` adds `allowJs`, `incremental`, `plugins: [{ name: "next" }]`,
`esModuleInterop`, `resolveJsonModule`, and the `.next/types` includes to `tsconfig.json`.
Reproduce: a minimal `src/app/layout.tsx` and `page.tsx` with `next@16.4.6`,
`typescript@7.0.2`, then `pnpm exec tsc --pretty && pnpm exec next build`.

### Next.js Behaviour to Know

- `next dev` appends a managed `nextjs-agent-rules` block to `AGENTS.md` on every start and restores it if removed. The builder chose to keep and commit it (2026-11-15): it points agents at the docs for the installed Next.js version in `node_modules/next/dist/docs/`. `agentRules: false` in `next.config.ts` would remove it. Source: `node_modules/next/dist/server/lib/generate-agent-files.js`.
- Next.js blocks dev-only requests from origins other than `localhost`. `allowedDevOrigins` in `next.config.ts` lists the home network ranges so the phone can use the dev server by the Mac's LAN address. Checked 2026-11-15: the page opened on the builder's phone at `http://<Mac LAN IP>:3000`.
- `next dev` stops at start with the name of any missing variable (`src/instrumentation.ts`), so `DEEPSEEK_API_KEY` must be in `.env.local` before `pnpm dev` runs.
- After a long run with many edited and deleted files, `next dev` 16.4 (Turbopack) once went into a reload loop: the log repeated `✓ Compiled in 2ms` and `GET / 200` with no file changing, and the page's fetches were cancelled. Restarting `pnpm dev` fixed it (2026-11-15).

- Next.js 16 renamed `middleware.ts` to `proxy.ts` (export `proxy`). It runs on the Node.js runtime by default, so `node:crypto` works there. The docs advise checking authentication in each route as well; every API route calls `requireUser()` (`src/server/identity.ts`).

### Rules for the Receipt Prompt (T-017)

- The fixed rules never fix anything the user's template decides: field order, date style, separators. A fixed example ("2026 年 10 月 1 日") beat the builder's template in 6 of 6 readings.
- Exact formatting the model cannot hold, such as several spaces, is made exact in code from the template after reading (`src/server/ai/date-style.ts` for the leading date). If more exact-format rules appear, the general fix is for the model to return fields and code to assemble the line; that changes ADR-002 and is the builder's call.

### DynamoDB Transactions (T-018)

- Every `TransactWriteItems` goes through `sendTransaction` (`src/server/repo/transact.ts`). DynamoDB cancels a transaction that meets another one on the same item (`TransactionConflict`), and the SDK does not retry that. Every receipt write bumps `CURRENT_SESSION`, so one batch of photos meets itself there: 10 parallel writes for one user lost 6 to 8 of 10 before the retry, none after (2026-11-15).

### Browser Rules Found in T-003

- The phone uses the dev server over plain HTTP, which is not a secure context: `crypto.randomUUID` and `navigator.clipboard` do not exist there. IDs come from `src/client/random-id.ts` (`crypto.getRandomValues`).
- Photos are re-encoded in the browser (`src/client/compress-image.ts`) with `createImageBitmap(file, { imageOrientation: "from-image" })`, falling back to `<img>` decoding. Checked 2026-11-15 on an iPhone and a Xiaomi phone: camera and library photos arrive as JPEG, 1536×2048, portrait kept, 0.4–1.3 MB.
- Photos are shown with a plain `<img>` and presigned URLs, never through the Next.js image optimizer, which would cache private photos. `src/server/photos.ts` signs as of the start of the hour for two hours, so a photo's URL stays the same for an hour and polling does not re-download it.
- Testing on the phone: `docs/runbooks/phone-test.md`.

### What We Don't Use

| Not used                                        | Instead                                                                          | Why                                                         |
| ----------------------------------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| A monorepo with a separate frontend and backend | One Next.js app                                                                  | Builder's choice: one isomorphic app                        |
| A separate bundler or server framework          | Next.js                                                                          | Next.js builds and serves both sides                        |
| OpenNext, SST, CDK, or SAM for deployment       | CloudFormation templates in `deploy/`, deployed by the AWS CLI in GitHub Actions | No new tool; four resources (ADR-007)                       |
| A UI component library or CSS-in-JS             | CSS Modules                                                                      | Builder's choice                                            |
| GraphQL or an RPC layer                         | Next.js route handlers with JSON                                                 | Few endpoints, one client                                   |
| An ORM, decorators                              | DynamoDB SDK calls in `src/server/repo/`                                         | One table, a handful of item types                          |
| `cross-env`                                     | nothing                                                                          | One platform (macOS), and Next.js loads `.env.local` itself |
| ESLint, Prettier, Jest                          | oxlint, oxfmt, Vitest                                                            | Faster, one toolchain                                       |

## AWS Account Safety

The app must only ever touch the builder's personal AWS account. This Mac also holds other AWS
profiles, and the shell may set `AWS_PROFILE` to one of them. Next.js gives variables already
in `process.env` precedence over `.env` files, so an `AWS_PROFILE` line in `.env.local` would
lose to the shell's value.

Rules:

1. The app reads its profile from `RECEIPT_PRO_AWS_PROFILE` and passes it to the AWS SDK explicitly. It never relies on `AWS_PROFILE` or the default credential chain. On Lambda (`AWS_LAMBDA_FUNCTION_NAME` set), which has no profile, it takes the function role's credentials from the environment explicitly (`fromEnv`), and never reads a profile (T-013).
2. At startup, the server calls STS `GetCallerIdentity` and refuses every AWS operation unless the account ID equals `RECEIPT_PRO_AWS_ACCOUNT_ID`.
3. Every `aws` CLI command for this project passes `--profile` with the personal profile and unsets `AWS_PROFILE`. Scripts check the account ID before changing anything.

Rules 1 and 2 are code since T-001:

- `src/server/aws.ts` gives every client `profile`, `region`, and `fromIni({ profile })`; on Lambda, `region` and `fromEnv()`. A middleware on the DynamoDB and S3 clients awaits the account check before every command, so new code cannot skip it. Get clients from `getAws()`; never construct an AWS client elsewhere.
- Deployment uses no AWS key: GitHub Actions assumes role `receipt-pro-deploy` through OIDC, only from environment `production` of this repository (ADR-007).
- `src/instrumentation.ts` validates the configuration when the server starts and logs the account check result. A missing variable stops `next dev` with its name.
- Unit tests stub STS and the request handler: `src/server/__tests__/aws.test.ts`.
- `pnpm check:aws` re-verifies the real account, table, and bucket.

## Local Environment

Checked 2026-11-15 on the builder's Mac:

| Tool        | Version       | Note                                                                                    |
| ----------- | ------------- | --------------------------------------------------------------------------------------- |
| Node        | v22.23.1      |                                                                                         |
| pnpm        | 12.12.1       |                                                                                         |
| aws-cli     | 2.34.1        | Always `env -u AWS_PROFILE aws <command> --profile receipt-pro --region ap-southeast-2` |
| git         | 2.37.1        |                                                                                         |
| Docker      | 20.10.22      | Not used (ADR-003)                                                                      |
| cdk, mkcert | not installed |                                                                                         |

The agent's shell is zsh, which does not word-split an unquoted variable: `P="--profile x"; aws ... $P`
passes one argument and fails with `Unknown options`. Pass flags literally, use an array, or run
the snippet under `bash`.

## DeepSeek Image Input

Checked against the official docs on 2026-11-15 (`https://api-docs.deepseek.com/api/create-chat-completion`):

- Send the image as a user message content part of type `image_url`, with an `http(s)` URL or a base64 data URL.
- Accepted formats: JPEG, PNG, GIF, WebP.
- Optional `detail`: `low` (downsamples to 512x512), `high`, `original`, `auto`.
- `deepseek-v4-pro` does not accept images.

### Resolved: `deepseek-flash` accepts images through the AI SDK (T-002, 2026-11-15)

The two sources disagreed; a call settled it.

- DeepSeek's docs (`https://api-docs.deepseek.com/quick_start/pricing`) said `deepseek-flash` supports vision. The AI SDK's provider page said it has no image input.
- The provider page's "no image input" is only catalog metadata (`node_modules/@ai-sdk/deepseek/src/deepseek-model-catalog.ts`). `convert-to-deepseek-chat-messages.ts` turns every JPEG, PNG, GIF, or WebP file part into an `image_url` part for any model.
- `@ai-sdk/deepseek` 3.0.87 with `ai` 7.0.173, chat endpoint, `generateText` with `Output.object({ schema })`: the request carries one `image_url` part and `response_format: { "type": "json_object" }`; the SDK writes the schema into the system message (it logs a "compatibility mode" warning). DeepSeek read a synthetic receipt correctly and returned bare JSON, nothing before or after.
- Measured on that synthetic receipt (880×1120 JPEG, 94 KB): thinking off 2.0 s, 924 input and 76 output tokens; thinking on (DeepSeek's default) 2.4 s, 949 input and 211 output tokens, 139 of them reasoning. Both outputs correct.
- AI SDK 7 drops request bodies from results unless `include: { requestBody: true }` is set.
- `@ai-sdk/openai-compatible` is not needed.

Reproduce: `pnpm exec tsx --env-file=.env.local scripts/probe-deepseek.ts <photo> ...` (macOS; it re-encodes each photo like the app with `sips` and Pillow, then runs thinking off and on).

### Real Receipts (T-002, 2026-11-15)

Six iPhone photos of five of the builder's receipts (supermarket, restaurant, hardware store,
pharmacy; one receipt photographed twice), 30 calls in total. Photos stay out of git in
`probe-photos/`.

- **Upright pixels matter.** iPhone photos are stored sideways with an orientation tag, and DeepSeek reads raw pixels. Sent sideways, 2 of 6 dates came out with day and month swapped and 1 of 6 totals was wrong. Sent upright, as the app's canvas re-encoding produces them, all 6 dates and totals were right. Anything that sends a photo to DeepSeek must send upright pixels.
- **Thinking off** (upright, base prompt): 1.8–2.4 s per call; about 1,340 input tokens (the image is about 1,000) and 80–160 output tokens. Dates 6/6, totals 6/6, payment method 6/6, item prices 31 of 34 right. The misses: a receipt that prints each item on two lines (Chinese name, then English name) with the price on one of them, where the model split one item into two and shifted the prices (2 phantom items, 2 wrong prices); and one faintly printed price. Two item names were mistranslated.
- **Thinking on** (DeepSeek's default): 3–38 s per call, 300–7,400 reasoning tokens. Not more accurate on these receipts; better item names; and one reply could not be parsed.
- **Prompt rules do not fix layout errors with thinking off.** Adding "an item may span two lines", "check that item prices add up to the subtotal", and the Australian date order changed nothing on the three misread photos, two runs each.
- **Invalid JSON happens, in one shape.** 2 of 30 replies were a JSON object, then free text (a self-check, or a leaked `<｜end▁of▁thinking｜>` token), then a second JSON object. The AI SDK rejects these (`AI_NoObjectGeneratedError`), so the text never reaches the user. No reply was blank.
- **Format slips:** once `共$71.70` (a currency symbol the template does not have), once `19.9` for `19.90`.

Recommendation for T-004: thinking off, JSON mode, strict parsing, one retry on an invalid reply. A cheap code check, item prices against the printed subtotal, would have flagged every wrong price above; it is not in the MVP.

Reproduce one photo, thinking off only: `PROBE_THINKING=off pnpm exec tsx --env-file=.env.local scripts/probe-deepseek.ts probe-photos/<photo>`. The probe now uses the app's prompt (`src/server/ai/system-prompt.ts`); the T-002 numbers above came from an earlier draft.

**Format rules and temperature (2026-11-15, after the builder's review).** With the field rules in `docs/knowledge/business.md#output` and `temperature: 0`, all 9 photos tried (the 6 above and 3 more of the builder's) gave only `现金` or `刷卡`, short merchant names, short simplified item names. Run three times on the same bytes, a photo gave the same text in most runs, not all: one run dropped an item. A re-encoded copy of a photo can read differently from the original. Item-level misreads remain (G-004): the two-line layout, swapped prices on adjacent items, unknown brands.
