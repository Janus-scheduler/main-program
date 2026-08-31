/**
 * Artifact decoding — PURE. No `fs`, no `fetch`, no path resolution.
 *
 * Restructured from `bin/index.js` 376-401, which read from disk and decoded in
 * one step. Here the decode half is isolated so it can run in a browser (where
 * the caller fetched the bytes), in a test (where they came from a fixture),
 * and in Node (via `@janus-scheduler/nlp/node`) — one implementation, three
 * environments.
 *
 * The artifacts total ~6 MB on disk and must NEVER be reached by a static
 * `import` of the JSON: a bundler would inline every byte into the consumer's
 * application bundle. Passing buffers in at runtime is the whole reason this
 * split exists.
 */

import type { Artifacts, ArtifactBuffers, Pooling, Prototype } from "./types";

/** Shape of `vocab.json` as produced by the build script. */
interface RawVocab {
  tokens: string[];
  scales: number[];
  weights: number[];
  dim: number;
  unkId: number;
  pooling: Pooling;
}

/** Shape of one entry in `prototypes.json`. */
interface RawPrototype {
  intent: string;
  text: string;
  vec_full: number[];
  vec_verb: number[];
}

const decoder = new TextDecoder("utf-8");

/** Accept UTF-8 text, its bytes, or an ArrayBuffer of them. */
function toText(source: string | Uint8Array | ArrayBuffer): string {
  if (typeof source === "string") return source;
  if (source instanceof ArrayBuffer)
    return decoder.decode(new Uint8Array(source));
  return decoder.decode(source);
}

/**
 * View raw bytes as the int8 embedding table.
 *
 * The `byteOffset`/`length` arguments are not incidental: Node's `Buffer` is a
 * view into a shared, pooled `ArrayBuffer`, so `new Int8Array(buf.buffer)`
 * alone would expose the whole pool and silently misalign every row. This
 * reinterprets in place — no copy, which matters at ~3 MB.
 */
function toInt8Table(source: Uint8Array | Int8Array | ArrayBuffer): Int8Array {
  if (source instanceof ArrayBuffer) return new Int8Array(source);
  if (source instanceof Int8Array) return source;
  return new Int8Array(source.buffer, source.byteOffset, source.byteLength);
}

/**
 * Decode `vocab.json` + `vectors.bin` into the runtime `Artifacts` object.
 *
 * Builds the `token -> id` Map once here rather than per call, which is what
 * keeps tokenization O(word length) at query time.
 */
export function parseArtifacts(buffers: ArtifactBuffers): Artifacts {
  const vocab = JSON.parse(toText(buffers.vocab)) as RawVocab;
  const table = toInt8Table(buffers.vectors);
  const tokenToId = new Map<string, number>(
    vocab.tokens.map((t, i) => [t, i] as [string, number]),
  );
  return {
    tokens: vocab.tokens,
    tokenToId,
    scales: vocab.scales,
    weights: vocab.weights,
    dim: vocab.dim,
    unkId: vocab.unkId,
    pooling: vocab.pooling,
    table,
  };
}

/**
 * Decode `prototypes.json`.
 *
 * `Float32Array.from` is required, not cosmetic: `cosine()` relies on both
 * operands holding float32 values, and a plain `number[]` from JSON would carry
 * float64 precision into the dot product and drift from the Python reference.
 */
export function parsePrototypes(
  source: string | Uint8Array | ArrayBuffer,
): Prototype[] {
  const data = JSON.parse(toText(source)) as RawPrototype[];
  return data.map((p) => ({
    intent: p.intent as Prototype["intent"],
    text: p.text,
    vecFull: Float32Array.from(p.vec_full),
    vecVerb: Float32Array.from(p.vec_verb),
  }));
}
