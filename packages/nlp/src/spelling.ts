/**
 * Typo tolerance for time words.
 *
 * ══════════════════════════════════════════════════════════════════════════
 *  NEW BEHAVIOUR, ADDITIVE, AND OPT-IN. It runs BEFORE the pipeline, on the
 *  raw utterance, and touches no frozen constant.
 *
 *  "schedule a meeting tommorow" was a genuinely bad experience: the frozen
 *  `TIME_PATTERNS` do not match the typo, so gate 5 fired and the user was
 *  asked "when?" about a sentence in which they had plainly said when. Worse,
 *  the unrecognised word stayed in the leftover text and became the event's
 *  TITLE — "meeting tommorow".
 *
 *  Running before the pipeline is the load-bearing part. Both the frozen gate
 *  and the extractor then see the SAME corrected text, so the invariant that
 *  `hasTimeAnchor()` and `parseTimeSpan()` agree is preserved. Correcting in
 *  only one of them would let an utterance clear gate 5 and still produce a
 *  card with an empty "when", or the reverse.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * There is no dictionary and no model here — just bounded edit distance
 * against a small closed vocabulary, which is why it stays deterministic and
 * dependency-free.
 */

import { hasTimeAnchor } from "./gates";
import type { Artifacts, EntityCatalog } from "./types";

/**
 * The words worth correcting towards.
 *
 * Drawn from `TIME_PATTERNS`, but written out rather than parsed back out of
 * the regex sources — extracting literals from a regex is guesswork, and this
 * list is short enough to state. A test asserts every entry is one the frozen
 * `hasTimeAnchor()` actually recognises, so a correction can never produce a
 * word the gate still refuses. That is the failure that would matter: a fix
 * that silently does nothing.
 *
 * Deliberately excludes short words. See `MIN_LENGTH`.
 */
export const TIME_VOCABULARY = [
  "today",
  "tomorrow",
  "tonight",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
  "morning",
  "afternoon",
  "evening",
  "midnight",
];

/**
 * Shortest token that may be corrected.
 *
 * At four characters and below, an edit-distance-1 neighbourhood stops being a
 * typo and starts being a different word: "may" is one edit from "day", "mon"
 * from "noon", "wed" from "week". Five is the shortest length at which a
 * single-edit match is overwhelmingly likely to be a misspelling.
 */
const MIN_LENGTH = 5;

/**
 * How far a token may be from a vocabulary word, scaled by its length.
 *
 * One edit is not enough for the typo that prompted all this: "tommorow" and
 * "tomorrow" are **two** edits apart (drop an `m`, add an `r`) — a doubled
 * letter in the wrong place is one slip to a human and two to an algorithm.
 *
 * The allowance only widens for long words, where a two-edit neighbourhood is
 * still sparse. At eight characters and up there is no pair in
 * `TIME_VOCABULARY` close enough for this to introduce an ambiguity, and a
 * test asserts that stays true.
 */
function maxDistanceFor(token: string): number {
  return token.length >= 8 ? 2 : 1;
}

/** One word this module changed, with where it was. */
export interface SpellingCorrection {
  /** As the user typed it. */
  from: string;
  /** What it was read as. */
  to: string;
  start: number;
  end: number;
}

export interface SpellingResult {
  /** The utterance with every correction applied. */
  text: string;
  corrections: SpellingCorrection[];
}

export interface SpellingOptions {
  /**
   * The embedding vocabulary. When supplied, a token that appears in it as a
   * whole word is NEVER corrected — it is a real word the model already knows,
   * and "correcting" it would be this module overruling the user.
   */
  artifacts?: Artifacts;
  /** Catalog names are left alone too: they are spellings the host chose. */
  catalog?: EntityCatalog;
}

/**
 * Damerau-Levenshtein distance, but abandoned as soon as it exceeds `max`.
 *
 * The transposition case matters here more than the others — "tomorow",
 * "tommorow" and "tomrorow" are all one keyboard slip, and plain Levenshtein
 * scores the last of those as 2.
 */
function withinDistance(a: string, b: string, max: number): boolean {
  if (Math.abs(a.length - b.length) > max) return false;

  let previous: number[] = [];
  let current: number[] = Array.from({ length: b.length + 1 }, (_, j) => j);

  for (let i = 1; i <= a.length; i++) {
    // Two rows back, which is what the transposition case needs.
    const beforePrevious = previous;
    previous = current;
    current = [i];
    let best = i;

    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let value = Math.min(
        previous[j] + 1, // deletion
        current[j - 1] + 1, // insertion
        previous[j - 1] + cost, // substitution
      );
      // transposition
      if (
        i > 1 &&
        j > 1 &&
        a[i - 1] === b[j - 2] &&
        a[i - 2] === b[j - 1] &&
        beforePrevious.length > 0
      ) {
        value = Math.min(value, beforePrevious[j - 2] + 1);
      }
      current[j] = value;
      if (value < best) best = value;
    }

    // Every remaining path can only add to the best score on this row.
    if (best > max) return false;
  }

  return current[b.length] <= max;
}

/** Is this a word the user clearly meant, rather than a slip? */
function isKnownWord(token: string, options: SpellingOptions): boolean {
  const lower = token.toLowerCase();

  if (options.artifacts?.tokenToId.has(lower)) return true;

  for (const list of [
    options.catalog?.resources ?? [],
    options.catalog?.participants ?? [],
  ]) {
    for (const entry of list) {
      const forms = [entry.name, ...(entry.aliases ?? [])];
      if (forms.some((f) => f.toLowerCase().split(/\s+/).includes(lower))) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Fix misspelled time words in `text`.
 *
 * Conservative by construction — a token is only changed when ALL of these
 * hold, and each one is there to stop a specific way this could go wrong:
 *
 *   1. it is at least `MIN_LENGTH` characters      (short words have dense
 *                                                   edit-1 neighbourhoods)
 *   2. it is not already a time anchor             (never "fix" what works)
 *   3. it is not a word the model or the catalog   (do not overrule the user
 *      already knows                                on real words)
 *   4. exactly ONE vocabulary entry is within      (ambiguity means guessing,
 *      `maxDistanceFor(token)`                      and guessing silently is
 *                                                   the thing to avoid)
 *
 * Returns the original text and an empty list when nothing qualifies, so the
 * caller can treat "no corrections" as the common case.
 */
export function correctTimeWords(
  text: string,
  options: SpellingOptions = {},
): SpellingResult {
  const corrections: SpellingCorrection[] = [];
  let changed = false;

  // Split keeping separators, so offsets and spacing survive exactly.
  const parts = text.split(/([A-Za-z']+)/);
  let offset = 0;

  const out = parts.map((part, index) => {
    const start = offset;
    offset += part.length;

    // Odd indices are the captured word groups.
    if (index % 2 === 0) return part;

    const lower = part.toLowerCase();
    if (part.length < MIN_LENGTH) return part;
    if (hasTimeAnchor(part)) return part;
    if (isKnownWord(part, options)) return part;

    const max = maxDistanceFor(lower);
    const matches = TIME_VOCABULARY.filter((word) =>
      withinDistance(lower, word, max),
    );
    if (matches.length !== 1) return part;

    changed = true;
    corrections.push({
      from: part,
      to: matches[0],
      start,
      end: start + part.length,
    });
    return matches[0];
  });

  return changed
    ? { text: out.join(""), corrections }
    : { text, corrections: [] };
}
