/**
 * The two query-time views — ALGORITHM.md §5 (slot stripping) and §6
 * (verb-phrase extraction).
 *
 * Ported from `bin/index.js` 173-252.
 *
 * LOAD-BEARING INVARIANT (§5 and §6 headers, both): these exact transforms run
 * at BUILD time when prototypes are embedded and at QUERY time when an
 * utterance is embedded. A prototype embedded from one view can never be
 * compared against a query embedded from another. Change either function and
 * every vector in `prototypes.json` becomes meaningless — they would have to
 * be rebuilt in Python, which is precisely the capability this port retires.
 */

import {
  LEAD,
  TIME_PATTERNS,
  RESOURCE_NAMES,
  PARTICIPANT_NAMES,
  INTENT_VERBS,
  LEADING_WRAPPERS,
} from "./constants";
import { escapeRe, WS_RE } from "./normalize";

/**
 * The time-phrase pattern source, `_LEAD`-prefixed and word-boundary wrapped.
 *
 * Exported as a STRING rather than as a RegExp so `gates.ts` can build its own
 * instance from the identical source. The two uses need different flags and
 * must not share mutable `lastIndex` state — see the note on `TIME_RE` below.
 */
export const TIME_RE_SOURCE =
  "\\b" + LEAD + "(?:" + TIME_PATTERNS.join("|") + ")\\b";

/**
 * Global instance, used ONLY with `String.prototype.replace`.
 *
 * The original `bin/index.js` shared this single `/gi` object between
 * `stripSlots` (`.replace`) and `hasTimeAnchor` (`.test`). `.test` on a /g
 * regex advances `lastIndex`, so consecutive calls on the same object return
 * alternating results — the original is correct only because of a manual
 * `lastIndex = 0` reset immediately before each test (bin/index.js L313).
 *
 * We keep the `/gi` instance here for `replace` and let `gates.ts` build a
 * separate `/i` instance, which is stateless by construction and cannot be
 * broken by a future caller forgetting the reset. Behaviour is identical: a
 * `/g` regex whose `lastIndex` is 0 gives the same boolean as a non-`/g` one.
 */
const TIME_RE = new RegExp(TIME_RE_SOURCE, "gi");

/**
 * Resource + participant names as one longest-first alternation.
 *
 * Sorted by length descending so "conference room b" is tried before "room".
 * The sort is stable, so equal-length names keep the order they appear in
 * `RESOURCE_NAMES` then `PARTICIPANT_NAMES` — do not reorder those lists.
 */
const GAZETTEER = [...RESOURCE_NAMES, ...PARTICIPANT_NAMES].sort(
  (a, b) => b.length - a.length,
);
const GAZETTEER_RE = new RegExp(
  "\\b" + LEAD + "(?:" + GAZETTEER.map(escapeRe).join("|") + ")\\b",
  "gi",
);

/**
 * Remove time phrases and resource/participant names, each together with any
 * immediately preceding preposition/determiner (`_LEAD`).
 *
 * Produces the `vec_full` input. Note the order — times first, then the
 * gazetteer — and that it is not commutative in general.
 */
export function stripSlots(text: string): string {
  let s = text.replace(TIME_RE, " ");
  s = s.replace(GAZETTEER_RE, " ");
  return s.replace(WS_RE, " ").trim();
}

/**
 * Flattened verb lexicon, longest-first BY WORD COUNT (not character length),
 * so multi-word phrases like "set up" are tried before the bare "set"/"put"
 * entries that would otherwise shadow them.
 */
const ALL_VERB_PHRASES = [...new Set(Object.values(INTENT_VERBS).flat())].sort(
  (a, b) => b.split(" ").length - a.split(" ").length,
);
const VERB_PHRASE_RES: Array<[string, RegExp]> = ALL_VERB_PHRASES.map((p) => [
  p,
  new RegExp("^" + escapeRe(p) + "\\b", "i"),
]);

/** Non-global, so `.exec` is stateless. */
const FIRST_WORD_RE = /\w+/;

/**
 * Extract the head verb phrase, producing the `vec_verb` input.
 *
 * 1. Strip at most ONE leading politeness/pronoun wrapper (the `break` is
 *    deliberate — "can you please schedule" keeps "please").
 * 2. Return the longest lexicon phrase anchored at the start.
 * 3. Otherwise fall back to the first `\w+` token, or `""` for empty input.
 *
 * An empty return value is legitimate and flows into `embed()`'s zero-vector
 * path; it is not an error condition.
 */
export function headVerbPhraseLexicon(text: string): string {
  let lowered = text.trim().toLowerCase();
  for (const wrapper of LEADING_WRAPPERS) {
    if (lowered.startsWith(wrapper)) {
      lowered = lowered.slice(wrapper.length);
      break;
    }
  }
  for (const [phrase, re] of VERB_PHRASE_RES) {
    if (re.test(lowered)) return phrase;
  }
  const first = FIRST_WORD_RE.exec(lowered);
  return first ? first[0] : "";
}
