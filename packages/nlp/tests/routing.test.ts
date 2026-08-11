/**
 * Routing agreement: the TypeScript port must make the same ROUTING DECISION
 * the Python reference makes, on all 237 rows of `fixtures/routing_fixtures.json`.
 *
 * ══════════════════════════════════════════════════════════════════════════
 *  WHY THIS EXISTS — it covers what parity.test.ts structurally cannot
 *
 *  `parity.test.ts` proves the EMBEDDING half is exact (normalized text, token
 *  ids, vectors). It never calls `classify()` and never touches a single gate.
 *  A port could pass 120/120 parity with a wrong `CONF_FLOOR`, an inverted
 *  margin, a swapped gate order, or a typo in `EVENT_NOUNS`, and nothing would
 *  notice.
 *
 *  This file closes that gap, and it is the LAST chance to: once the Python
 *  implementation is left behind there is no other source of truth for the
 *  scoring and gate layers.
 *
 *  It asserts AGREEMENT, not accuracy. ALGORITHM.md's own measured numbers are
 *  87.5% none-recall / 2.86% false-accept — the fixture faithfully records
 *  Python's mistakes too, and this port must reproduce them.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Provenance — see `fixtures/README.md`. Generated once by running the exact
 * function PROJECT.md §7 prescribes (`gates.route_query`) over 105 dev.jsonl
 * rows + 12 typo-probe rows + 120 parity.json texts. The JSON is committed, so
 * this suite — and CI, and consumers — never need Python.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { parseArtifacts, parsePrototypes, routeQuery } from "../src";
import type { Artifacts, Gate, Intent, Prototype, Route } from "../src/types";

const ARTIFACTS_DIR = resolve(__dirname, "../artifacts");

/**
 * Tolerance for `confidence` / `margin`.
 *
 * These are NOT expected to be bit-identical, and requiring that would be
 * wrong. Python computes the dot products with NumPy over float32 arrays, so
 * `sim` is a float32 accumulated by BLAS (which may also reassociate the sum).
 * JavaScript has no float32 arithmetic: `cosine()` reads float32 inputs but
 * accumulates in a float64 JS number. The two agree to roughly float32
 * precision (~1e-7 relative), never exactly.
 *
 * 1e-5 is loose enough to absorb that and tight enough that a genuinely
 * different formula — a summed instead of max-per-intent vote, a margin that
 * counts `none` — would blow straight through it.
 *
 * `intent`, `route` and `gate` are compared EXACTLY. They are the decision.
 */
const NUMERIC_TOLERANCE = 1e-5;

interface RoutingFixture {
  text: string;
  source: "dev.jsonl" | "typo_robustness_check" | "parity.json";
  intent: Intent;
  confidence: number;
  margin: number;
  route: Route;
  gate: Gate;
}

const fixtures: RoutingFixture[] = JSON.parse(
  readFileSync(
    resolve(__dirname, "../fixtures/routing_fixtures.json"),
    "utf-8",
  ),
);

let artifacts: Artifacts;
let prototypes: Prototype[];

beforeAll(() => {
  artifacts = parseArtifacts({
    vocab: readFileSync(resolve(ARTIFACTS_DIR, "vocab.json"), "utf-8"),
    vectors: readFileSync(resolve(ARTIFACTS_DIR, "vectors.bin")),
  });
  prototypes = parsePrototypes(
    readFileSync(resolve(ARTIFACTS_DIR, "prototypes.json"), "utf-8"),
  );
});

describe("routing agreement with the Python reference", () => {
  it("loads all 237 fixtures, from all three sources", () => {
    expect(fixtures).toHaveLength(237);
    const bySource = fixtures.reduce<Record<string, number>>((acc, f) => {
      acc[f.source] = (acc[f.source] ?? 0) + 1;
      return acc;
    }, {});
    expect(bySource).toEqual({
      "dev.jsonl": 105,
      typo_robustness_check: 12,
      "parity.json": 120,
    });
  });

  /**
   * A fixture with a gate that never fires proves nothing about that gate. This
   * asserts the corpus actually exercises every branch of ALGORITHM.md §8's
   * table, so "237/237 agree" is a meaningful statement about the whole gate
   * layer rather than about three popular paths.
   */
  it("exercises every gate plus PROCEED", () => {
    const seen = new Set(fixtures.map((f) => f.gate));
    for (const gate of [
      null, // PROCEED
      "negation",
      "gate1_confidence",
      "gate2_nearest_none",
      "gate3_no_anchor",
      "gate3b_resource_only",
      "gate4_margin",
      "gate5_missing_slot",
    ]) {
      expect(seen).toContain(gate);
    }
  });

  describe.each(fixtures.map((f, i) => [i, f.text, f] as const))(
    "[%i] %s",
    (_i, _text, fixture) => {
      it("intent, route and gate match exactly", () => {
        const r = routeQuery(fixture.text, artifacts, prototypes);
        expect({ intent: r.intent, route: r.route, gate: r.gate }).toEqual({
          intent: fixture.intent,
          route: fixture.route,
          gate: fixture.gate,
        });
      });

      it("confidence and margin agree numerically", () => {
        const r = routeQuery(fixture.text, artifacts, prototypes);
        expect(Math.abs(r.confidence - fixture.confidence)).toBeLessThan(
          NUMERIC_TOLERANCE,
        );
        expect(Math.abs(r.margin - fixture.margin)).toBeLessThan(
          NUMERIC_TOLERANCE,
        );
      });
    },
  );

  /**
   * The headline acceptance gate. Duplicates the per-fixture tests on purpose:
   * those localize a failure, this one is the number to report ("237/237").
   */
  it("237/237 rows agree with Python", () => {
    const failures: string[] = [];

    for (const fixture of fixtures) {
      const r = routeQuery(fixture.text, artifacts, prototypes);
      const problems: string[] = [];

      if (r.intent !== fixture.intent) {
        problems.push(`intent: ts=${r.intent} py=${fixture.intent}`);
      }
      if (r.route !== fixture.route) {
        problems.push(`route: ts=${r.route} py=${fixture.route}`);
      }
      if (r.gate !== fixture.gate) {
        problems.push(`gate: ts=${r.gate} py=${fixture.gate}`);
      }
      const dConf = Math.abs(r.confidence - fixture.confidence);
      if (dConf >= NUMERIC_TOLERANCE) {
        problems.push(
          `confidence: ts=${r.confidence} py=${fixture.confidence} (Δ${dConf.toExponential(2)})`,
        );
      }
      const dMargin = Math.abs(r.margin - fixture.margin);
      if (dMargin >= NUMERIC_TOLERANCE) {
        problems.push(
          `margin: ts=${r.margin} py=${fixture.margin} (Δ${dMargin.toExponential(2)})`,
        );
      }

      if (problems.length > 0) {
        failures.push(
          `${JSON.stringify(fixture.text)} [${fixture.source}]\n    ${problems.join("\n    ")}`,
        );
      }
    }

    if (failures.length > 0) {
      throw new Error(
        `${fixtures.length - failures.length}/${fixtures.length} agreed. Disagreements:\n  ` +
          failures.join("\n  "),
      );
    }
    expect(failures).toHaveLength(0);
  });

  /**
   * How close the float32-vs-float64 arithmetic actually lands. Not an
   * acceptance criterion — a tripwire. If a future change makes the worst-case
   * delta approach `NUMERIC_TOLERANCE`, the tolerance is masking a real
   * divergence and should be investigated rather than raised.
   */
  it("worst-case numeric delta stays far below the tolerance", () => {
    let worst = 0;
    let worstText = "";
    for (const fixture of fixtures) {
      const r = routeQuery(fixture.text, artifacts, prototypes);
      const d = Math.max(
        Math.abs(r.confidence - fixture.confidence),
        Math.abs(r.margin - fixture.margin),
      );
      if (d > worst) {
        worst = d;
        worstText = fixture.text;
      }
    }

    console.log(
      `  worst |ts - py| across 237 rows: ${worst.toExponential(3)}  (${JSON.stringify(worstText)})`,
    );
    expect(worst).toBeLessThan(NUMERIC_TOLERANCE / 10);
  });
});

/**
 * The distribution the fixture records, pinned. If a constant changes, the
 * per-row tests say WHICH rows moved; this says HOW MUCH the behaviour moved,
 * which is the number worth arguing about.
 *
 * These counts are Python's, measured — not targets. 93 CLARIFY of 237 (39%)
 * is why Step 5's dialogue manager matters: without it, that whole slice is a
 * dead end for the user.
 */
describe("routing distribution (recorded, not aspirational)", () => {
  it("matches the recorded route distribution", () => {
    const counts = { PROCEED: 0, CLARIFY: 0, REJECT: 0 };
    for (const fixture of fixtures) {
      const r = routeQuery(fixture.text, artifacts, prototypes);
      counts[r.route]++;
    }
    expect(counts).toEqual({ PROCEED: 59, CLARIFY: 93, REJECT: 85 });
  });
});
