/**
 * Publishes every @janus-scheduler package in dependency order.
 *
 * Why not `changeset publish`? It first calls `GET /-/npm/v1/user` to decide
 * whether a one-time password is needed. npm now treats that as an
 * account-administration route and returns 403 for tokens configured to bypass
 * 2FA, after which changesets falls back to prompting for a TOTP code — which
 * is impossible in CI, and impossible for a maintainer whose only 2FA method is
 * a passkey. Calling `npm publish` directly skips that check entirely.
 *
 * Idempotent: a package whose exact version is already on the registry is
 * skipped, so re-running after a partial failure is safe.
 *
 * Usage:
 *   node scripts/publish-packages.mjs            # publish
 *   node scripts/publish-packages.mjs --dry-run  # verify without publishing
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dryRun = process.argv.includes("--dry-run");

// npm is a .cmd shim on Windows and cannot be spawned without a shell, so
// `shell: true` is required there. Node warns about this (DEP0190) because
// arguments are concatenated rather than escaped — harmless here: every
// argument is a constant or a name read from our own package.json files,
// never user input.

// Dependency order: core and nlp depend on nothing internal, ui needs core,
// the wrappers need core+nlp+ui, app needs core+ui.
const PACKAGES = [
  "packages/core",
  "packages/nlp",
  "packages/ui",
  "packages/wrappers/react-wrapper",
  "packages/wrappers/angular-wrapper",
  "packages/wrappers/solid-js-wrapper",
  "packages/integrations",
  "packages/app",
];

const read = (dir) =>
  JSON.parse(readFileSync(resolve(repo, dir, "package.json"), "utf8"));

const onRegistry = (name, version) => {
  try {
    execFileSync("npm", ["view", `${name}@${version}`, "version"], {
      stdio: "pipe",
      shell: process.platform === "win32",
    });
    return true;
  } catch {
    return false;
  }
};

let published = 0;
let skipped = 0;
const failed = [];

for (const dir of PACKAGES) {
  const { name, version } = read(dir);

  if (onRegistry(name, version)) {
    console.log(`── skip     ${name}@${version} (already on registry)`);
    skipped++;
    continue;
  }

  // `--ignore-scripts` skips prepublishOnly. The caller is expected to have run
  // `npm run build:all` already; rebuilding once per package is redundant, and
  // on Windows it trips EPERM file locks on the freshly written dist.
  const args = ["publish", "--ignore-scripts", "--access", "public"];
  if (dryRun) args.push("--dry-run");

  console.log(`── ${dryRun ? "dry-run" : "publish"}  ${name}@${version}`);
  try {
    execFileSync("npm", args, {
      cwd: resolve(repo, dir),
      stdio: "inherit",
      shell: process.platform === "win32",
    });
    if (!dryRun) published++;
  } catch {
    console.error(`   FAILED: ${name}@${version}`);
    failed.push(`${name}@${version}`);
  }
}

console.log(
  `\npublished: ${published}   already-present: ${skipped}   failed: ${failed.length}`,
);

if (failed.length) {
  console.error(`\nfailed to publish:\n  ${failed.join("\n  ")}`);
  console.error("\nRe-run — packages already published are skipped.");
  process.exit(1);
}
