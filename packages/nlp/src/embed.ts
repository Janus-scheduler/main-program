/**
 * Pooling and embedding — ALGORITHM.md §3.
 *
 * Ported from `bin/index.js` 141-169 (plus `cosine`, 256-260).
 */

import type { Artifacts, EmbedResult } from "./types";
import { normalize } from "./normalize";
import { wordpiece } from "./wordpiece";

/**
 * Dequantize → Zipf-weighted mean → L2-normalize.
 *
 * BIT-PARITY NOTE: the accumulator is a `Float32Array`, not a `number[]`. Every
 * `pooled[d] += ...` therefore rounds to float32 on each write, exactly as
 * NumPy's float32 accumulation does. Swapping in a plain array would accumulate
 * in float64 and drift away from the Python reference. Do not "optimize" this.
 */
function embed(ids: number[], artifacts: Artifacts): Float32Array {
  const { table, scales, weights, dim, pooling } = artifacts;
  const pooled = new Float32Array(dim);
  // LOAD-BEARING (ALGORITHM.md §3 step 1): empty ids yield an all-zero vector
  // that is NOT L2-normalized (it can't be). Callers comparing two vectors with
  // a raw dot product must special-case this — see `cosineSafe` in the parity
  // test, which treats zero-vs-zero as an exact match rather than cos = 0.
  if (ids.length === 0) return pooled;

  let wsum = 0;
  for (const id of ids) {
    const w = pooling === "zipf" ? weights[id] : 1;
    const scale = scales[id];
    const offset = id * dim;
    for (let d = 0; d < dim; d++) pooled[d] += table[offset + d] * scale * w;
    wsum += w;
  }
  const denom = wsum > 0 ? wsum : 1; // guard: sum(w) == 0 → divide by 1.0
  for (let d = 0; d < dim; d++) pooled[d] /= denom;

  let norm = 0;
  for (let d = 0; d < dim; d++) norm += pooled[d] * pooled[d];
  norm = Math.sqrt(norm);
  if (norm > 0) for (let d = 0; d < dim; d++) pooled[d] /= norm;
  return pooled;
}

/**
 * Full text → vector, returning the intermediate values too.
 *
 * `normalized` and `ids` are not debug extras: they are two of the four
 * assertions the 120-row parity fixture checks, because a divergence there
 * localizes a bug far faster than a cosine drop does.
 */
export function embedText(text: string, artifacts: Artifacts): EmbedResult {
  const normalized = normalize(text);
  const ids = wordpiece(normalized, artifacts.tokenToId, artifacts.unkId);
  const vec = embed(ids, artifacts);
  return { normalized, ids, vec };
}

/**
 * Raw dot product.
 *
 * This is a valid cosine similarity ONLY because `embed()` L2-normalizes its
 * output. The one input for which that guarantee does not hold is the empty-id
 * zero vector (see above).
 */
export function cosine(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}
