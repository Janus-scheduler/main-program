/**
 * Covers `src/node.ts` — the filesystem loader — against the REAL build output
 * rather than the TypeScript source.
 *
 * Why not `import { loadArtifacts } from "../src/node"` like every other test?
 * `src/node.ts` uses `import.meta.url` to locate its own bundled `artifacts/`
 * directory. That is correct in the shipped ESM build, and Vite rewrites it to
 * a `__filename`-based equivalent in the CJS build (verified below). But
 * ts-jest transpiles TypeScript straight to CommonJS with no such rewrite, and
 * `import.meta` is a *syntax* error in CommonJS — the file fails to parse
 * before any branch is evaluated.
 *
 * Testing `dist/node.cjs` is also the stronger test: it proves the thing
 * consumers actually `require()` resolves its artifacts correctly, which is
 * precisely what `import.meta.url` is there to do.
 *
 * Skips with a clear message when `dist/` is absent, so `npm test` works on a
 * clean checkout. CI runs `build` before `test`.
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { Artifacts, Prototype } from "../src/types";

const DIST = resolve(__dirname, "../dist");
const NODE_CJS = resolve(DIST, "node.cjs");
const built = existsSync(NODE_CJS);

interface NodeEntry {
  artifactsDir(): string;
  readArtifact(fileName: string): Buffer;
  loadArtifacts(dir?: string): Artifacts;
  loadPrototypes(dir?: string): Prototype[];
}

const describeIfBuilt = built ? describe : describe.skip;

if (!built) {
  console.warn(
    `[node-loader.test] SKIPPED: ${NODE_CJS} not found. Run \`npm run build -w @janus-scheduler/nlp\` first.`,
  );
}

describeIfBuilt("@janus-scheduler/nlp/node (built CJS entry)", () => {
  const nodeEntry: NodeEntry = require(NODE_CJS);

  it("resolves its own bundled artifacts directory", () => {
    const dir = nodeEntry.artifactsDir();
    expect(existsSync(resolve(dir, "vocab.json"))).toBe(true);
    expect(existsSync(resolve(dir, "vectors.bin"))).toBe(true);
    expect(existsSync(resolve(dir, "prototypes.json"))).toBe(true);
  });

  it("readArtifact returns the file's real bytes", () => {
    const viaLoader = nodeEntry.readArtifact("vocab.json");
    const direct = readFileSync(resolve(__dirname, "../artifacts/vocab.json"));
    expect(viaLoader.length).toBe(direct.length);
    expect(viaLoader.equals(direct)).toBe(true);
  });

  it("loadArtifacts decodes a usable vocabulary and embedding table", () => {
    const a = nodeEntry.loadArtifacts();
    expect(a.tokens.length).toBeGreaterThan(0);
    expect(a.tokenToId.size).toBe(a.tokens.length);
    expect(a.dim).toBeGreaterThan(0);
    expect(a.pooling).toBe("zipf");
    // The int8 table must be exactly one row of `dim` per token — a wrong
    // byteOffset (Node Buffers are views into a shared pool) shows up here.
    expect(a.table.length).toBe(a.tokens.length * a.dim);
    expect(a.scales).toHaveLength(a.tokens.length);
    expect(a.weights).toHaveLength(a.tokens.length);
  });

  it("loadPrototypes decodes float32 vectors of the right width", () => {
    const a = nodeEntry.loadArtifacts();
    const protos = nodeEntry.loadPrototypes();
    expect(protos.length).toBeGreaterThan(0);
    for (const p of protos) {
      expect(p.vecFull).toBeInstanceOf(Float32Array);
      expect(p.vecVerb).toBeInstanceOf(Float32Array);
      expect(p.vecFull).toHaveLength(a.dim);
      expect(p.vecVerb).toHaveLength(a.dim);
    }
  });

  it("the built CJS entry contains no unrewritten `import.meta`", () => {
    expect(readFileSync(NODE_CJS, "utf-8")).not.toMatch(/import\s*\.\s*meta/);
  });

  it("the PURE entry pulls in no filesystem access", () => {
    const indexCjs = readFileSync(resolve(DIST, "index.cjs"), "utf-8");
    const indexEs = readFileSync(resolve(DIST, "index.es.js"), "utf-8");
    for (const src of [indexCjs, indexEs]) {
      expect(src).not.toMatch(/readFileSync/);
      expect(src).not.toMatch(/node:fs/);
    }
  });
});
