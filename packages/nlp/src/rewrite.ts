/**
 * Domain-verb normalisation, for the CLASSIFIER'S EYES ONLY.
 *
 * ══════════════════════════════════════════════════════════════════════════
 *  Every community has its own word for "schedule". A school timetables, a
 *  hospital admits, a rota system rosters, a salon fits you in. The frozen
 *  classifier was trained on business-meeting language and rejects all of
 *  them — "timetable maths tomorrow at 9am" scores 0.27 against a 0.45 floor.
 *
 *  This maps those verbs onto ones the classifier already knows, and hands the
 *  result to `classify()` ONLY. The gates and the entity extractor still see
 *  the user's own words, so nothing invented ever reaches the screen and no
 *  anchor decision is made on rewritten text.
 *
 *  The split is not a new idea here: `evaluate()` already classifies one
 *  string while gating another (see `stripNegationCues`). This uses the same
 *  seam.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * ── THREE RULES FOR EDITING THE MAP ───────────────────────────────────────
 *
 * 1. **Only verbs the classifier REJECTS.** Never rewrite one it already
 *    handles. The first version of this file mapped `book` (0.92), `reserve`
 *    (1.00), `show` (0.91), `clear` (1.00) and 14 others — verbs that were
 *    already right. It touched 38 of the 237 routing fixtures and broke one:
 *    "show me everything scheduled for friday" became "look up me everything
 *    scheduled for friday", which is ungrammatical, dropped below the floor,
 *    and turned a working lookup into a refusal. A rewrite can only ever add
 *    risk to a sentence that already worked.
 *
 * 2. **The replacement must PRESERVE the intent.** The rewrite is invisible to
 *    the gates but it DECIDES the intent, and gates 2 and 5 both read that. A
 *    wrong entry produces a confident wrong action: mapping `drop` to "book"
 *    turns "drop maths tomorrow" from a cancellation into a booking at 0.84
 *    confidence. Each rule below declares its intent, and a test asserts the
 *    replacement actually classifies to it.
 *
 * 3. **Anchored to the leading verb**, never a global replace. `plan`, `book`,
 *    `clear` and `find` are ordinary nouns too — "the floor plan review", "my
 *    book club" — and a global pattern rewrites them mid-sentence.
 *
 * Confidences quoted below were measured against the shipped artifacts with
 * the frame "<verb> Room A tomorrow at 3pm".
 */

import type { Intent } from "./types";

/**
 * An optional politeness prefix, so "can you timetable maths" still matches.
 * Mirrors what `headVerbPhraseLexicon` does with `LEADING_WRAPPERS`.
 */
const LEAD = "^\\s*(?:(?:can|could|would|will)\\s+you\\s+)?(?:please\\s+)?";

interface VerbRule {
  /** Anchored at the start of the utterance. */
  pattern: RegExp;
  replacement: string;
  /** What the replacement MUST classify as. Asserted by a test. */
  intent: Intent;
}

const anchored = (verbs: string[]): RegExp =>
  new RegExp(LEAD + "(?:" + verbs.join("|") + ")\\b", "i");

const VERB_RULES: VerbRule[] = [
  // ── booking ───────────────────────────────────────────────────────────
  //
  // `meet` needs the long form. "meeting with" alone scores 0.36 and still
  // fails; "schedule a meeting with" scores 0.94. The replacement has to be a
  // phrase the classifier is confident about, not merely a related word.
  {
    pattern: anchored(["meet"]),
    replacement: "schedule a meeting with",
    intent: "add_event",
  },
  {
    // timetable 0.27 · enrol 0.19 · roster 0.17 · organise 0.17 · plan 0.33
    // slot in 0.26 · coordinate 0.23 · assign 0.24 · allocate 0.20
    // use 0.32 · admit 0.24 · host 0.27
    pattern: anchored([
      "timetable",
      "enrol",
      "enroll",
      "roster",
      "organize",
      "organise",
      "coordinate",
      "allocate",
      "assign",
      "admit",
      "host",
      "plan",
      "slot in",
      "use",
      "fit me in",
      "squeeze in",
    ]),
    replacement: "schedule",
    intent: "add_event",
  },

  // ── moving ────────────────────────────────────────────────────────────
  //
  // `delay` is the interesting one: it scores 0.41 AND classifies as
  // delete_event — the wrong intent, not merely a weak one. Mapping it here
  // corrects both.
  {
    // postpone 0.22 · delay 0.41 (as delete!) · alter 0.26 · adjust 0.21
    pattern: anchored(["postpone", "delay", "alter", "adjust"]),
    replacement: "reschedule",
    intent: "modify_event",
  },

  // ── cancelling ────────────────────────────────────────────────────────
  //
  // `scrap` scores 0.51 — above the confidence floor — but classifies as
  // `none`, so gate 2 rejects it. Confidence alone is not the test.
  {
    // kill 0.31 · abort 0.19 · scrap 0.51 (as none)
    pattern: anchored(["kill", "abort", "scrap"]),
    replacement: "cancel",
    intent: "delete_event",
  },

  // ── looking up ────────────────────────────────────────────────────────
  //
  // `show` is deliberately ABSENT as a SOURCE: it already scores 0.91, and
  // including it is what broke a routing fixture. It is the TARGET instead.
  //
  // "look up" was the obvious replacement and is the wrong one — it scores
  // 0.39 on its own, below the floor, so "find my meetings tomorrow" became
  // "look up my meetings tomorrow" and was still rejected (none, 0.55). A
  // replacement has to be a phrase the classifier is CONFIDENT about, not
  // merely one that means the right thing. "show me" scores 0.91.
  {
    // find 0.44 · display 0.42 · list 0.41 · search 0.31
    pattern: anchored(["find", "display", "list", "search"]),
    replacement: "show me",
    intent: "get_details",
  },
];

/**
 * Map a domain verb onto one the classifier knows.
 *
 * At most ONE rule applies — the first that matches the leading verb. Applying
 * several would compose replacements into nonsense.
 *
 * Returns the text unchanged when nothing matches, which is the common case:
 * the map only covers verbs the classifier rejects, so ordinary phrasing never
 * reaches a rule at all.
 */
export function rewriteForClassifier(text: string): string {
  for (const rule of VERB_RULES) {
    if (rule.pattern.test(text)) {
      return text.replace(rule.pattern, (m) => {
        // Preserve any politeness prefix that the anchor consumed, so the
        // replacement lands where the verb was rather than eating the lead.
        const lead = m.match(
          /^\s*(?:(?:can|could|would|will)\s+you\s+)?(?:please\s+)?/i,
        );
        return (lead?.[0] ?? "") + rule.replacement;
      });
    }
  }
  return text;
}

/** The rules, exported so a test can assert each replacement's intent. */
export const REWRITE_RULES: ReadonlyArray<{
  replacement: string;
  intent: Intent;
}> = VERB_RULES.map(({ replacement, intent }) => ({ replacement, intent }));
