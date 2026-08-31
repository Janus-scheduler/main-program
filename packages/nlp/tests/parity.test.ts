/**
 * Parity: the TypeScript port must reproduce the Python reference pipeline's
 * output on every fixture in `fixtures/parity.json`.
 *
 * Ported from the research repo's `bin/parity_check.js` (141 lines).
 *
 * ══════════════════════════════════════════════════════════════════════════
 *  WHAT THIS ASSERTS, AND WHAT IT DOES NOT
 *
 *  This is an agreement test, not an accuracy test. It proves TS ≡ Python on
 *  120 recorded inputs. It says nothing about whether the classifier is
 *  *right* — ALGORITHM.md's own measured numbers are 87.5% none-recall and
 *  2.86% false-accept, so 100% accuracy is impossible by construction.
 *
 *  What it catches is a mistyped `CONF_FLOOR`, a reordered word list, a
 *  float64 accumulator where a float32 one belonged — the class of porting
 *  error that is invisible by inspection and unrecoverable once the Python
 *  implementation is left behind.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Four assertions per fixture:
 *   1. `normalized_full` string matches exactly
 *   2. `ids_full` and `ids_verb` deep-equal
 *   3. cosine(ts.vec_full, py.vec_full) > 0.9999
 *   4. cosine(ts.vec_verb, py.vec_verb) > 0.9999
 *
 * These run against the package's real exported functions, not a copy of the
 * pipeline — a copy would only prove the copy agrees with itself.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  cosine,
  embedText,
  headVerbPhraseLexicon,
  parseArtifacts,
  stripSlots,
} from "../src";
import type { Artifacts } from "../src/types";

/**
 * Artifacts are loaded through the PURE `parseArtifacts()` here rather than
 * through `src/node.ts`'s `loadArtifacts()`, for two reasons:
 *
 *   1. Parity is a property of the algorithm, not of the file loader. Reading
 *      the bytes here keeps the test focused on the thing that must not drift.
 *   2. `src/node.ts` uses `import.meta.url` (correct in the shipped ESM build;
 *      Vite rewrites it for the CJS build). ts-jest transpiles TS straight to
 *      CommonJS, where `import.meta` is a syntax error even in a dead branch —
 *      so importing that module from a Jest test fails to parse. The loader is
 *      covered separately by `node-loader.test.ts`, against the real build.
 */
const ARTIFACTS_DIR = resolve(__dirname, "../artifacts");

const COSINE_THRESHOLD = 0.9999;

interface ParityFixture {
  text: string;
  stripped: string;
  verb_phrase: string;
  normalized_full: string;
  ids_full: number[];
  ids_verb: number[];
  vec_full: number[];
  vec_verb: number[];
}

const fixtures: ParityFixture[] = JSON.parse(
  readFileSync(resolve(__dirname, "../fixtures/parity.json"), "utf-8"),
);

let artifacts: Artifacts;
beforeAll(() => {
  artifacts = parseArtifacts({
    vocab: readFileSync(resolve(ARTIFACTS_DIR, "vocab.json"), "utf-8"),
    vectors: readFileSync(resolve(ARTIFACTS_DIR, "vectors.bin")),
  });
});

function normSq(v: ArrayLike<number>): number {
  let s = 0;
  for (let i = 0; i < v.length; i++) s += v[i] * v[i];
  return s;
}

/**
 * `cosine()` is a raw dot product, valid as a cosine similarity ONLY because
 * `embed()` L2-normalizes its output. That guarantee breaks for empty input:
 * `embed()` returns an UNnormalized all-zero vector when given zero ids (the
 * division-by-zero guard). Two independently-computed empty-input vectors are
 * therefore exactly equal all-zero vectors whose dot product is 0, not 1 —
 * cosine similarity is mathematically undefined at the origin.
 *
 * So: both zero → exact match (a stronger claim than the threshold check);
 * exactly one zero → genuine mismatch; otherwise fall through to the real
 * comparison. Several fixtures have an empty verb phrase and hit this path.
 */
function cosineSafe(a: ArrayLike<number>, b: ArrayLike<number>): number {
  const isZeroA = normSq(a) < 1e-12;
  const isZeroB = normSq(b) < 1e-12;
  if (isZeroA && isZeroB) return 1.0;
  if (isZeroA || isZeroB) return 0.0;
  return cosine(a, b);
}

describe("parity with the Python reference pipeline", () => {
  it("loads all 120 fixtures", () => {
    expect(fixtures).toHaveLength(120);
  });

  describe.each(fixtures.map((f, i) => [i, f.text, f] as const))(
    "[%i] %s",
    (_i, _text, fixture) => {
      it("normalized_full matches exactly", () => {
        const full = embedText(stripSlots(fixture.text), artifacts);
        expect(full.normalized).toBe(fixture.normalized_full);
      });

      it("ids_full deep-equal", () => {
        const full = embedText(stripSlots(fixture.text), artifacts);
        expect(full.ids).toEqual(fixture.ids_full);
      });

      it("ids_verb deep-equal", () => {
        const verb = embedText(headVerbPhraseLexicon(fixture.text), artifacts);
        expect(verb.ids).toEqual(fixture.ids_verb);
      });

      it(`cosine(vec_full) > ${COSINE_THRESHOLD}`, () => {
        const full = embedText(stripSlots(fixture.text), artifacts);
        const cos = cosineSafe(full.vec, Float32Array.from(fixture.vec_full));
        expect(cos).toBeGreaterThan(COSINE_THRESHOLD);
      });

      it(`cosine(vec_verb) > ${COSINE_THRESHOLD}`, () => {
        const verb = embedText(headVerbPhraseLexicon(fixture.text), artifacts);
        const cos = cosineSafe(verb.vec, Float32Array.from(fixture.vec_verb));
        expect(cos).toBeGreaterThan(COSINE_THRESHOLD);
      });
    },
  );

  /**
   * The headline number, reported the way `bin/parity_check.js` reported it:
   * a fixture passes only if all four of its assertions pass. This duplicates
   * the per-fixture tests above on purpose — those localize a failure, this
   * one is the acceptance gate ("120/120").
   */
  it("120/120 fixtures pass all four assertions", () => {
    const failures: string[] = [];

    for (const fixture of fixtures) {
      const full = embedText(stripSlots(fixture.text), artifacts);
      const verb = embedText(headVerbPhraseLexicon(fixture.text), artifacts);
      const problems: string[] = [];

      if (full.normalized !== fixture.normalized_full) {
        problems.push(
          `normalized_full: ts=${JSON.stringify(full.normalized)} py=${JSON.stringify(fixture.normalized_full)}`,
        );
      }
      if (JSON.stringify(full.ids) !== JSON.stringify(fixture.ids_full)) {
        problems.push(
          `ids_full: ts=${JSON.stringify(full.ids)} py=${JSON.stringify(fixture.ids_full)}`,
        );
      }
      if (JSON.stringify(verb.ids) !== JSON.stringify(fixture.ids_verb)) {
        problems.push(
          `ids_verb: ts=${JSON.stringify(verb.ids)} py=${JSON.stringify(fixture.ids_verb)}`,
        );
      }
      const cosFull = cosineSafe(full.vec, Float32Array.from(fixture.vec_full));
      if (cosFull <= COSINE_THRESHOLD) {
        problems.push(`cosine(vec_full)=${cosFull.toFixed(6)}`);
      }
      const cosVerb = cosineSafe(verb.vec, Float32Array.from(fixture.vec_verb));
      if (cosVerb <= COSINE_THRESHOLD) {
        problems.push(`cosine(vec_verb)=${cosVerb.toFixed(6)}`);
      }

      if (problems.length > 0) {
        failures.push(
          `${JSON.stringify(fixture.text)}\n    ${problems.join("\n    ")}`,
        );
      }
    }

    if (failures.length > 0) {
      throw new Error(
        `${fixtures.length - failures.length}/${fixtures.length} passed. Failures:\n  ` +
          failures.join("\n  "),
      );
    }
    expect(failures).toHaveLength(0);
  });
});

/**
 * The fixtures also record the two intermediate views. The original harness did
 * not assert on them (it only used them as debugging output), but they are
 * free evidence that `stripSlots` and `headVerbPhraseLexicon` — the two
 * functions whose output must match the build-time prototype embedding exactly
 * — agree with Python character for character.
 */
describe("intermediate views (stronger than the original harness asserted)", () => {
  it("stripSlots matches Python's strip_slots on all 120 fixtures", () => {
    const mismatches = fixtures
      .filter((f) => stripSlots(f.text) !== f.stripped)
      .map(
        (f) =>
          `${JSON.stringify(f.text)}: ts=${JSON.stringify(stripSlots(f.text))} py=${JSON.stringify(f.stripped)}`,
      );
    expect(mismatches).toEqual([]);
  });

  /**
   * ── A REAL, PRE-EXISTING JS↔PYTHON DIVERGENCE ───────────────────────────
   *
   * One fixture disagrees, and it is not a porting error — the reference
   * `bin/index.js` produces the same value this port does. It is a language
   * difference the original parity harness could not see:
   *
   *   ALGORITHM.md §6 step 3 says "fall back to the first `\w+` token".
   *   In Python's `re`, `\w` on a `str` pattern is Unicode-aware, so
   *   "café meeting…" yields "café". In JavaScript, `\w` is hard-wired to
   *   `[A-Za-z0-9_]`, so the same input yields "caf".
   *
   * It is inert. `normalize()` runs next and strips every non-ASCII character
   * via `PUNCT_RE` (`[^a-z0-9\s]` → space), so "café" and "caf" both normalize
   * to "caf" and produce identical `ids_verb` and identical `vec_verb`. That
   * is exactly why all four official parity assertions pass 120/120 and why
   * `bin/parity_check.js` — which only ever checked normalized text, ids and
   * cosines — never surfaced it.
   *
   * NOT FIXED, deliberately. Switching `FIRST_WORD_RE` to a Unicode-property
   * pattern would be an unrequested change to a FROZEN algorithm, and it would
   * alter the verb phrase for every accented input — with no way left to re-verify
   * the consequences against Python. The divergence is recorded rather than
   * silenced, so that if a SECOND one ever appears this test fails loudly.
   */
  const KNOWN_UNICODE_WORD_BOUNDARY_DIVERGENCE = new Set([
    "café meeting at naïve resort",
  ]);

  it("headVerbPhraseLexicon matches Python on all 120 fixtures, except the one known Unicode `\\w` divergence", () => {
    const mismatches = fixtures
      .filter((f) => headVerbPhraseLexicon(f.text) !== f.verb_phrase)
      .map(
        (f) =>
          `${JSON.stringify(f.text)}: ts=${JSON.stringify(headVerbPhraseLexicon(f.text))} py=${JSON.stringify(f.verb_phrase)}`,
      );

    const unexpected = fixtures
      .filter(
        (f) =>
          headVerbPhraseLexicon(f.text) !== f.verb_phrase &&
          !KNOWN_UNICODE_WORD_BOUNDARY_DIVERGENCE.has(f.text),
      )
      .map(
        (f) =>
          `${JSON.stringify(f.text)}: ts=${JSON.stringify(headVerbPhraseLexicon(f.text))} py=${JSON.stringify(f.verb_phrase)}`,
      );

    expect(unexpected).toEqual([]);
    // The known case must still be present — if it silently starts passing,
    // something changed in `normalize`/`FIRST_WORD_RE` and this note is stale.
    expect(mismatches).toHaveLength(
      KNOWN_UNICODE_WORD_BOUNDARY_DIVERGENCE.size,
    );
  });

  it("the known divergence is inert: both spellings produce identical ids_verb", () => {
    for (const text of KNOWN_UNICODE_WORD_BOUNDARY_DIVERGENCE) {
      const fixture = fixtures.find((f) => f.text === text)!;
      const tsVerb = embedText(headVerbPhraseLexicon(text), artifacts);
      const pyVerb = embedText(fixture.verb_phrase, artifacts);
      expect(tsVerb.normalized).toBe(pyVerb.normalized);
      expect(tsVerb.ids).toEqual(pyVerb.ids);
      expect(tsVerb.ids).toEqual(fixture.ids_verb);
    }
  });
});
