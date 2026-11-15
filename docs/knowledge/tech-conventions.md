# Tech Conventions

> **Purpose:** Technical choices the builder has settled. Architecture detail goes in `docs/knowledge/architecture.md` once it exists.
> **Status:** Current
> **Verified against:** Builder interview, 2026-11-15; T-001 setup, 2026-11-15

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
| Git hook              | husky `pre-commit`: format, re-stage the staged files that oxfmt changed, then lint and type in parallel                                                                                                                                                                             |
| Line endings          | `.gitattributes`: LF everywhere, binary types never normalised                                                                                                                                                                                                                       |
| Editor                | `.vscode/settings.json`: oxc formatter on save, type-aware oxc, tsgo                                                                                                                                                                                                                 |
| Browsers              | `browserslist`: `chrome >= 109`, `edge >= 121`, `firefox >= 115`, `safari >= 16`                                                                                                                                                                                                     |
| Scripts in `scripts/` | Run with `tsx`                                                                                                                                                                                                                                                                       |

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

### What We Don't Use

| Not used                                        | Instead                                     | Why                                                         |
| ----------------------------------------------- | ------------------------------------------- | ----------------------------------------------------------- |
| A monorepo with a separate frontend and backend | One Next.js app                             | Builder's choice: one isomorphic app                        |
| A separate bundler or server framework          | Next.js; the deploy tool is chosen in T-013 | Next.js builds and serves both sides                        |
| A UI component library or CSS-in-JS             | CSS Modules                                 | Builder's choice                                            |
| GraphQL or an RPC layer                         | Next.js route handlers with JSON            | Few endpoints, one client                                   |
| An ORM, decorators                              | DynamoDB SDK calls in `src/server/repo/`    | One table, a handful of item types                          |
| `cross-env`                                     | nothing                                     | One platform (macOS), and Next.js loads `.env.local` itself |
| ESLint, Prettier, Jest                          | oxlint, oxfmt, Vitest                       | Faster, one toolchain                                       |

## AWS Account Safety

The app must only ever touch the builder's personal AWS account. This Mac also holds other AWS
profiles, and the shell may set `AWS_PROFILE` to one of them. Next.js gives variables already
in `process.env` precedence over `.env` files, so an `AWS_PROFILE` line in `.env.local` would
lose to the shell's value.

Rules:

1. The app reads its profile from `RECEIPT_PRO_AWS_PROFILE` and passes it to the AWS SDK explicitly. It never relies on `AWS_PROFILE` or the default credential chain.
2. At startup, the server calls STS `GetCallerIdentity` and refuses every AWS operation unless the account ID equals `RECEIPT_PRO_AWS_ACCOUNT_ID`.
3. Every `aws` CLI command for this project passes `--profile` with the personal profile and unsets `AWS_PROFILE`. Scripts check the account ID before changing anything.

Rules 1 and 2 are code since T-001:

- `src/server/aws.ts` gives every client `profile`, `region`, and `fromIni({ profile })`. A middleware on the DynamoDB and S3 clients awaits the account check before every command, so new code cannot skip it. Get clients from `getAws()`; never construct an AWS client elsewhere.
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

### Conflict: does `deepseek-flash` accept images through the AI SDK?

Checked 2026-11-15. The two sources disagree; T-002 settles it.

- DeepSeek's docs (`https://api-docs.deepseek.com/quick_start/pricing`): `deepseek-flash` supports vision; `deepseek-v4-flash-vision-exp` is retired and routed to `deepseek-flash`.
- The AI SDK's DeepSeek provider page (`https://ai-sdk.dev/providers/ai-sdk-providers/deepseek`): `deepseek-flash` has no image input; only `deepseek-v4-flash-vision-exp` does. The same page says the provider's Responses API (`deepSeek.responses()`) supports JSON schema structured outputs for `deepseek-flash`, which DeepSeek's own JSON mode page does not mention.
- Fallback if `@ai-sdk/deepseek` refuses image parts: `@ai-sdk/openai-compatible` pointed at `https://api.deepseek.com`, still inside the AI SDK.
