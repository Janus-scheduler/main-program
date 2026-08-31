/**
 * @janus-scheduler/nlp/node — Node-only filesystem loader.
 *
 * This is the ONLY module in the package permitted to import `node:fs`. It
 * reads the bundled artifact files off disk and delegates every byte of
 * decoding to the pure helpers in `artifacts.ts`, so there is exactly one
 * implementation of the decode path regardless of where the bytes came from.
 *
 * Corresponds to the filesystem half of `bin/index.js` 376-401.
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { parseArtifacts, parsePrototypes } from "./artifacts";
import type { Artifacts, Prototype } from "./types";

/**
 * Absolute path to this package's bundled `artifacts/` directory.
 *
 * Resolved from this module's own location rather than `process.cwd()`, so it
 * works whether the package is consumed from `node_modules` or from source, and
 * regardless of what directory the host process was started in.
 *
 * The `__dirname` check comes first because the CJS build has no
 * `import.meta.url`; the ESM build has no `__dirname`. Both builds ship.
 */
export function artifactsDir(): string {
  const here =
    typeof __dirname === "string"
      ? __dirname
      : dirname(fileURLToPath(import.meta.url));
  return resolve(here, "..", "artifacts");
}

/** Read one file from the bundled `artifacts/` directory. */
export function readArtifact(fileName: string): Buffer {
  return readFileSync(resolve(artifactsDir(), fileName));
}

/**
 * Load and decode `vocab.json` + `vectors.bin`.
 *
 * Call this once and reuse the result — it allocates a ~12k-entry Map and holds
 * a ~3 MB int8 table. Re-loading per query would dominate the runtime.
 */
export function loadArtifacts(dir: string = artifactsDir()): Artifacts {
  return parseArtifacts({
    vocab: readFileSync(resolve(dir, "vocab.json"), "utf-8"),
    vectors: readFileSync(resolve(dir, "vectors.bin")),
  });
}

/** Load and decode `prototypes.json`. Also worth caching. */
export function loadPrototypes(dir: string = artifactsDir()): Prototype[] {
  return parsePrototypes(
    readFileSync(resolve(dir, "prototypes.json"), "utf-8"),
  );
}
