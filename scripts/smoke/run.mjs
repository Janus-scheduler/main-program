/**
 * Real-consumer smoke test.
 *
 * Every demo app aliases `@janus-scheduler/*` back to `src`, so nothing in this
 * repo exercises the built packages the way an npm consumer does. That is how
 * the published v1.0.3 shipped with two Zustand stores: the react wrapper
 * inlined its own copy of core while `ui` resolved the real one from
 * node_modules, so `manager.addEvent()` wrote to a store the timeline never read.
 *
 * This script packs the real tarballs, installs them into a throwaway app
 * OUTSIDE the workspace, and asserts the packages actually work there.
 */
import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  writeFileSync,
  copyFileSync,
  readdirSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "../..");

const PACKAGES = [
  "packages/core",
  "packages/ui",
  "packages/nlp",
  "packages/wrappers/react-wrapper",
  "packages/app",
];

const run = (cmd, args, cwd) =>
  execFileSync(cmd, args, {
    cwd,
    stdio: "inherit",
    shell: process.platform === "win32",
  });

/**
 * On Windows, a build that starts while the previous one's output is still
 * being scanned by the virus scanner fails with
 * `EPERM: operation not permitted` on the dist files. The handles clear on
 * their own, so wait and retry rather than failing the whole smoke run.
 */
const runWithRetry = (cmd, args, cwd, attempts = 4, waitMs = 15000) => {
  for (let i = 1; ; i++) {
    try {
      return run(cmd, args, cwd);
    } catch (err) {
      if (i >= attempts) throw err;
      console.log(
        `\n  … attempt ${i} failed, retrying in ${waitMs / 1000}s (locked dist?)\n`,
      );
      // Deliberately synchronous: this script is a linear pipeline.
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, waitMs);
    }
  }
};

/**
 * `--no-build` skips the rebuild, for callers that have just built (CI runs
 * `build:all` as its own step). Building twice back-to-back is the main way to
 * trip the Windows file-lock problem above.
 */
const skipBuild = process.argv.includes("--no-build");

const app = mkdtempSync(join(tmpdir(), "janus-smoke-"));
console.log(`\n▶ smoke app: ${app}\n`);

try {
  if (skipBuild) {
    console.log("▶ skipping build (--no-build)");
  } else {
    console.log("▶ building packages…");
    runWithRetry("npm", ["run", "build:all"], repo);
  }

  console.log("\n▶ packing tarballs…");
  const tars = join(app, "tars");
  mkdirSync(tars, { recursive: true });
  for (const p of PACKAGES) {
    run(
      "npm",
      ["pack", "--pack-destination", tars, "--ignore-scripts"],
      join(repo, p),
    );
  }

  const tarballs = readdirSync(tars).map((f) => join(tars, f));
  console.log(`\n▶ installing ${tarballs.length} tarballs into a clean app…`);
  writeFileSync(
    join(app, "package.json"),
    JSON.stringify(
      { name: "janus-smoke", version: "1.0.0", private: true, type: "module" },
      null,
      2,
    ),
  );
  run(
    "npm",
    ["install", ...tarballs, "react@19", "react-dom@19", "jsdom@25"],
    app,
  );

  copyFileSync(join(here, "assert-esm.mjs"), join(app, "assert-esm.mjs"));
  copyFileSync(join(here, "assert-cjs.cjs"), join(app, "assert-cjs.cjs"));

  console.log("\n▶ ESM assertions");
  run("node", ["assert-esm.mjs"], app);
  console.log("\n▶ CJS assertions");
  run("node", ["assert-cjs.cjs"], app);

  console.log("\n✅ smoke test passed\n");
} finally {
  rmSync(app, { recursive: true, force: true });
}
