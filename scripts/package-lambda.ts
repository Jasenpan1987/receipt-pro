// Packages the standalone build for Lambda (T-013): `pnpm build`, then
//   pnpm package:lambda
// writes dist/lambda.zip: the Next.js server with only the files it needs, the static assets,
// and deploy/run.sh, which the Lambda Web Adapter starts. CI runs this on Linux arm64, the
// architecture of the function, because the standalone build carries native packages.

import { execFileSync } from "node:child_process";
import { chmodSync, cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const standalone = path.join(root, ".next/standalone");
const out = path.join(root, "dist/lambda");
const zip = path.join(root, "dist/lambda.zip");

if (!existsSync(path.join(standalone, "server.js"))) {
  throw new Error('No .next/standalone/server.js. Run `pnpm build` first (output: "standalone").');
}

rmSync(path.join(root, "dist"), { recursive: true, force: true });
mkdirSync(out, { recursive: true });
// pnpm's node_modules are symlinks; copied as links, the package is 13 MB instead of 44 MB.
cpSync(standalone, out, { recursive: true, verbatimSymlinks: true });
cpSync(path.join(root, ".next/static"), path.join(out, ".next/static"), { recursive: true });
if (existsSync(path.join(root, "public"))) {
  cpSync(path.join(root, "public"), path.join(out, "public"), { recursive: true });
}
cpSync(path.join(root, "deploy/run.sh"), path.join(out, "run.sh"));
chmodSync(path.join(out, "run.sh"), 0o755);

// Secrets reach Lambda only as environment variables from the deploy. A local build may sit next
// to .env.local, so refuse any .env file in the package.
const envFiles = readdirSync(out, { recursive: true, encoding: "utf8" }).filter(file =>
  path.basename(file).startsWith(".env")
);
if (envFiles.length > 0) {
  throw new Error(`Refusing to package .env files: ${envFiles.join(", ")}`);
}

// -y stores symlinks as links. Lambda accepts at most 50 MB zipped for a direct upload.
execFileSync("zip", ["-qry", zip, "."], { cwd: out, stdio: "inherit" });
const mb = statSync(zip).size / 1024 / 1024;
if (mb > 50) {
  throw new Error(`dist/lambda.zip is ${mb.toFixed(1)} MB; Lambda accepts at most 50 MB.`);
}
console.log(`dist/lambda.zip: ${mb.toFixed(1)} MB`);
