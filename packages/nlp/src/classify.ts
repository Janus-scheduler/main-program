/**
 * Dual-vector kNN scoring — ALGORITHM.md §7.
 *
 * Ported from `bin/index.js` 262-293.
 */

import { TOP_K, ALPHA, BETA, NONE_ALPHA, NONE_BETA } from "./constants";
import type {
  Artifacts,
  ClassifyResult,
  Intent,
  Neighbour,
  Prototype,
  ScoreResult,
} from "./types";
import { cosine, embedText } from "./embed";
import { headVerbPhraseLexicon, stripSlots } from "./preprocess";

/**
 * Score a query against every prototype, then vote among the top-K.
 *
 * Two things here look like bugs and are not:
 *
 * (1) **`none` is scored on a different blend.** α=1/β=0 for `none`,
 *     α=0.2/β=0.8 for every event intent (ALGORITHM.md §7, Task 4.5 Option A).
 *     `none` is object-carried, not verb-carried; including `vec_verb` in its
 *     score collides it with event examples that share a verb.
 *
 * (2) **The vote is MAX per intent, not SUM.** Summing would double-count an
 *     intent that happens to occupy several top-K slots, turning the vote into
 *     a popularity contest over near-duplicate prototypes.
 */
function classifyVectorDual(
  queryFull: Float32Array,
  queryVerb: Float32Array,
  prototypes: Prototype[],
): ScoreResult {
  const scored: Neighbour[] = prototypes.map((p) => {
    const isNone = p.intent === "none";
    const a = isNone ? NONE_ALPHA : ALPHA;
    const b = isNone ? NONE_BETA : BETA;
    const sim =
      a * cosine(queryFull, p.vecFull) + b * cosine(queryVerb, p.vecVerb);
    return { intent: p.intent, text: p.text, sim };
  });
  scored.sort((x, y) => y.sim - x.sim);
  const top = scored.slice(0, TOP_K);

  const votes = new Map<Intent, number>();
  for (const n of top) {
    votes.set(n.intent, Math.max(votes.get(n.intent) ?? -Infinity, n.sim));
  }
  const ranked = [...votes.entries()].sort((x, y) => y[1] - x[1]);

  if (ranked.length === 0) {
    return { intent: "none", confidence: 0, margin: 0, neighbours: top };
  }
  const [intent, confidence] = ranked[0];

  // LOAD-BEARING — the one that most looks like an oversight (ALGORITHM.md §7,
  // "margin redefined", and Pre-Task-5 Check 4):
  //
  //   `none` is excluded from the runner-up search ENTIRELY — including when
  //   `none` is itself the winner, in which case the margin is measured against
  //   the next *event* intent instead.
  //
  // Rationale: `none` and the event intents are scored by structurally
  // different blends (see above), so a margin computed against a `none`
  // runner-up sits on a different scale and is not comparable to MARGIN_FLOOR.
  // `none` already has two dedicated rejection paths (gates 2 and 3); margin
  // does not need to carry that signal a third time.
  //
  // When no other event intent appears in the top-K, `competitorScore` stays 0,
  // so margin == confidence: nothing to be ambiguous against, maximally
  // unambiguous by construction.
  const competitor = ranked.slice(1).find(([i]) => i !== "none");
  const competitorScore = competitor ? competitor[1] : 0;
  return {
    intent,
    confidence,
    margin: confidence - competitorScore,
    neighbours: top,
  };
}

/**
 * Embed both views of `text` and score them.
 *
 * Note the asymmetry in the inputs, which mirrors §5/§6: the `full` view is
 * built from `stripSlots(text)` while the `verb` view is built from the RAW
 * text (`headVerbPhraseLexicon` does its own wrapper stripping and would find
 * nothing useful in an already-stripped string).
 */
export function classify(
  text: string,
  artifacts: Artifacts,
  prototypes: Prototype[],
): ClassifyResult {
  const full = embedText(stripSlots(text), artifacts);
  const verb = embedText(headVerbPhraseLexicon(text), artifacts);
  const result = classifyVectorDual(full.vec, verb.vec, prototypes);
  return {
    ...result,
    normalizedFull: full.normalized,
    idsFull: full.ids,
    normalizedVerb: verb.normalized,
    idsVerb: verb.ids,
  };
}
