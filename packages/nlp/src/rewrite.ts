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

import { INTENT_VERBS } from "./constants";
import { withinDistance } from "./spelling";
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
/**
 * Padding that says nothing about WHAT to do, only how politely.
 *
 * Measured, against the shipped artifacts:
 *
 *   “could you please put something in for tomorrow afternoon in OR1”  0.27
 *   “put something in for tomorrow afternoon in OR1”                    0.85
 *   “I was hoping to get Lab 3 booked out on friday”                    0.34
 *   “book Lab 3 on friday”                                             0.86
 *
 * The classifier embeds the WHOLE utterance, so these words are not free —
 * they pull the vector toward nothing in particular and drag confidence
 * under the 0.45 floor. Every one of them is politeness, not instruction.
 *
 * `LEAD` above handles the short forms the frozen `LEADING_WRAPPERS` knows.
 * This handles the longer ones it does not, and it removes them ENTIRELY
 * rather than replacing them — there is nothing to preserve.
 */
const POLITENESS_RE = new RegExp(
  "^" +
    String.raw`\s*` +
    "(?:" +
    [
      // “I was hoping to”, “I am hoping to”, “I’d like to”, “I want to”
      String.raw`i(?:'d| would| had)? (?:like|want|need|hope|hoping|was hoping|am hoping|would like) to`,
      String.raw`i(?:'m| am) (?:trying|looking) to`,
      // “would you mind”, “do you think you could”
      String.raw`would you mind`,
      String.raw`do you think you (?:could|can)`,
      String.raw`(?:can|could|would|will) you (?:please )?(?:go ahead and )?`,
      String.raw`(?:please|kindly)`,
      String.raw`(?:let's|lets)`,
      String.raw`(?:i need|i want|we need|we want)`,
    ].join("|") +
    ")" +
    String.raw`\b\s*`,
  "i",
);

/**
 * Strip politeness, repeatedly.
 *
 * Repeatedly because they stack: “could you please…” is two of these, and
 * “I was hoping you could please…” is three. Bounded so a pathological input
 * cannot spin.
 */
export function stripPoliteness(text: string): string {
  let out = text;
  for (let i = 0; i < 4; i++) {
    const next = out.replace(POLITENESS_RE, "");
    if (next === out) break;
    out = next;
  }
  // Never hand the classifier an empty string: a bare “please” is not a
  // request, and it should reach the gates as the nothing it is.
  return out.trim().length > 0 ? out : text;
}

/**
 * Does the utterance already contain a command verb?
 *
 * Read from the FROZEN `INTENT_VERBS` rather than a second list, so the
 * question “is there a verb here?” has one answer in this package.
 */
const VERB_ANYWHERE_RE = new RegExp(
  String.raw`\b(?:` +
    [...new Set(Object.values(INTENT_VERBS).flat())]
      .sort((a, b) => b.length - a.length)
      .map((v) => v.replace(/ /g, String.raw`\s+`))
      .join("|") +
    String.raw`)\b`,
  "i",
);

/** A clock time, a weekday, or a relative day — enough to anchor an event. */
const TIME_ISH_RE = new RegExp(
  String.raw`\b(?:` +
    [
      String.raw`\d{1,2}(?::\d{2})?\s*(?:am|pm)`,
      String.raw`\d{1,2}:\d{2}`,
      "noon|midnight|today|tomorrow|tmrw|tonight",
      "mon|tues?|wednes|thurs?|fri|satur|sun",
    ].join("|") +
    String.raw`)`,
  "i",
);

/**
 * Give a verbless utterance the verb it obviously implies.
 *
 * Measured, against the shipped artifacts:
 *
 *   “OR1 3pm tmrw”        0.23  →  “book OR1 3pm tmrw”        0.86
 *   “lab 3 friday 2pm”    0.18  →  “book lab 3 friday 2pm”    0.86
 *   “sarah 10am”          0.09  →  “book sarah 10am”          0.92
 *
 * The classifier is verb-driven, so a sentence with no verb has nothing to
 * classify and lands near zero. But a room and a time and nothing else has
 * exactly one reading to any human, and it is the commonest way people type
 * when they are in a hurry.
 *
 * This is NOT a guess about intent. It only fires when there is no verb at
 * all — so there is no competing reading to be wrong about — and `book` is
 * the only thing a bare noun-plus-time can mean. A sentence that names a verb
 * keeps it, whatever it is.
 *
 * As always, the gates still see the ORIGINAL. A synthesised verb cannot
 * carry anything past an anchor check it would not have cleared alone.
 */
/**
 * Words that mean this is a SENTENCE, not a shorthand booking.
 *
 * The rule below fires on a bare noun-phrase-plus-time. Without this guard it
 * also fired on ordinary sentences that merely lack a command verb —
 * “I'm free at 2pm, aren't you?”, “arent we meeting today” — turning a
 * question or a statement into a booking request. Those are the negation
 * fixtures, and they caught it.
 */
const SENTENCE_MARKER_RE = new RegExp(
  [
    String.raw`\b(?:` +
      [
        "i|we|you|he|she|they|it",
        String.raw`i'?m|we'?re|you'?re`,
        "is|are|am|was|were|be|been|do|does|did",
        String.raw`don'?t|doesn'?t|didn'?t|can'?t|cant`,
        String.raw`aren'?t|arent|isn'?t|isnt|won'?t|wont`,
        "not|free|busy|available|maybe|think|about",
      ].join("|") +
      String.raw`)\b`,
    String.raw`\?`,
  ].join("|"),
  "i",
);

/** At most this many words still reads as shorthand rather than prose. */
const MAX_SHORTHAND_WORDS = 4;

/** Every single word of the frozen verb lexicon, for the typo guard. */
const VERB_WORDS = [
  ...new Set(
    Object.values(INTENT_VERBS)
      .flat()
      .flatMap((v) => v.split(" ")),
  ),
];

/**
 * Is any word here a command verb the user simply MISSPELLED?
 *
 * The routing fixtures are full of them — “cancle my 3pm”, “scedule a
 * meeting”, “moev the auditor meeting” — and a misspelled verb looks exactly
 * like no verb at all. Synthesising `book` in front of one turns a
 * cancellation into a booking at high confidence, which is the worst failure
 * this layer can produce.
 *
 * Distance 1 only: far enough for a transposition or a dropped letter, close
 * enough that ordinary short nouns are not swallowed.
 */
/**
 * Words that make an utterance prose or a question, checked with the same
 * tolerance as the verbs.
 *
 * “waht's on tomorrow” is a LOOKUP with a typo, and “theyd prefer friday” is
 * a statement — neither is a shorthand booking, and both slipped past an
 * exact-match guard.
 */
const PROSE_WORDS = [
  "what",
  "when",
  "where",
  "who",
  "why",
  "how",
  "which",
  "they",
  "them",
  "their",
  "theyd",
  "prefer",
  "maybe",
  "about",
];

/**
 * Is any word here a command verb, question word or pronoun the user simply
 * MISSPELLED?
 *
 * The routing fixtures are full of them — “cancle my 3pm”, “scedule a
 * meeting”, “moev the auditor meeting” — and a misspelled verb looks exactly
 * like no verb at all. Synthesising `book` in front of one turns a
 * cancellation into a booking at high confidence, which is the worst failure
 * this layer can produce.
 *
 * Distance 1 only: far enough for a transposition or a dropped letter, close
 * enough that ordinary short nouns are not swallowed.
 */
function looksLikeProseOrAVerb(words: string[]): boolean {
  return words.some((w) => {
    // Compare the STEM: “waht's” is a typo of “what's”, and stripping the
    // apostrophe to “wahts” puts it 2 edits from “what” instead of 1.
    const stem = w.toLowerCase().split(/[’']/)[0];
    const word = stem.replace(/[^a-z]/g, "");
    if (word.length < 3) return false;
    return [...VERB_WORDS, ...PROSE_WORDS].some((v) =>
      withinDistance(word, v, 1),
    );
  });
}

export function synthesiseVerb(text: string): string {
  if (VERB_ANYWHERE_RE.test(text)) return text;
  // A verb this package knows how to REWRITE is still a verb.
  if (VERB_RULES.some((rule) => rule.pattern.test(text))) return text;

  // Prose, a question, or anything with a subject is not shorthand.
  if (SENTENCE_MARKER_RE.test(text)) return text;

  // Split without a regex on purpose: a mangled `s` here silently produced
  // a word count of 1 for a six-word sentence and let this fire on prose.
  const words = text.trim().split(" ").filter(Boolean);
  if (words.length === 0 || words.length > MAX_SHORTHAND_WORDS) return text;

  // A misspelled verb is still a verb, and guessing `book` over one inverts
  // the user's intent. Same for a question word: it makes this a query.
  if (looksLikeProseOrAVerb(words)) return text;

  if (!TIME_ISH_RE.test(text)) return text;

  // Something has to be BOOKED, not just a bare time. “3pm” alone is a
  // fragment, and answering it as a booking would invent the subject.
  const withoutTime = text.replace(new RegExp(TIME_ISH_RE.source, "gi"), " ");
  if (!/[a-z]{2,}/i.test(withoutTime)) return text;

  return `book ${text.trim()}`;
}

export function rewriteForClassifier(text: string): string {
  // Politeness first: a verb rule is anchored to the START, so padding in
  // front of the verb hides it from every rule below.
  text = stripPoliteness(text);

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

  // LAST, and only if nothing else claimed the sentence.
  //
  // Ordering is load-bearing. Run before the rules, a synthesised `book`
  // lands in front of an unknown domain verb — “book postpone the standup” —
  // and the rule that would have mapped `postpone` to `reschedule` no longer
  // matches its anchor. Every domain verb broke that way.
  return synthesiseVerb(text);
}

/** The rules, exported so a test can assert each replacement's intent. */
export const REWRITE_RULES: ReadonlyArray<{
  replacement: string;
  intent: Intent;
}> = VERB_RULES.map(({ replacement, intent }) => ({ replacement, intent }));
