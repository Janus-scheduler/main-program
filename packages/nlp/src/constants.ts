/**
 * Every frozen constant in the pipeline, in one file.
 *
 * ══════════════════════════════════════════════════════════════════════════
 *  THE ALGORITHM IS FROZEN. docs/ALGORITHM.md is NORMATIVE.
 *
 *  Do not "improve" a value here. Every number below is the output of a
 *  measured sweep recorded in ALGORITHM.md §9; every word list is the output
 *  of an audit script. Changing one silently invalidates the 120-row parity
 *  fixture and the 237-row routing fixture, and there is no Python
 *  implementation left to re-derive them from.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Ported from the research repo's `bin/index.js` (445 lines, parity-verified).
 * Ordering inside every literal below is load-bearing: several derived lists
 * are produced by a *stable* sort over these, so re-alphabetizing a list would
 * change tie-break order and therefore change tokenization.
 */

// ── scoring (ALGORITHM.md §7, §9) ─────────────────────────────────────────

/** kNN neighbourhood size. Unchanged since Phase 1. */
export const TOP_K = 5;

/**
 * Blend weights for `sim = ALPHA*cos(full) + BETA*cos(verb)`.
 * Chosen from a 21-point 0.05-step grid; 0.05–0.20 is a flat plateau and 0.20
 * is its upper end, for maximum distance from the lexicon's ~25% OOV rate.
 */
export const ALPHA = 0.2;
export const BETA = 0.8;

/**
 * LOAD-BEARING ASYMMETRY — looks like a bug, is not. (ALGORITHM.md §7 +
 * "Task 4.5 — `none` scoring asymmetry", shipped as Option A.)
 *
 * `none` prototypes are scored on `vec_full` ALONE (α=1, β=0) while every
 * event intent is scored on the α=0.2/β=0.8 blend. Reason: `none` is
 * object-carried, not verb-carried — scoring it on `vec_verb` creates
 * near-guaranteed collisions with event examples that share a verb. Making
 * these symmetric re-opens that collision.
 *
 * This asymmetry is also *why* `margin` has to exclude `none` — see
 * `classify.ts`.
 */
export const NONE_ALPHA = 1.0;
export const NONE_BETA = 0.0;

// ── routing thresholds (ALGORITHM.md §8, §9) ──────────────────────────────

/**
 * Task 6 full grid sweep (0.35–0.90): flat from 0.35–0.80. Every value that
 * reduces false-accepts trades 2–4× as many new false negatives. Frozen at its
 * pre-sweep value because nothing on the grid improves it.
 */
export const CONF_FLOOR = 0.45;

/** Task 6 sweep: inert across [0.05, 0.30]. Already optimal. */
export const MARGIN_FLOOR = 0.1;

// ── tokenization (ALGORITHM.md §2, §9) ────────────────────────────────────

/** Mirrors BERT's `WordpieceTokenizer.max_input_chars_per_word`. */
export const MAX_WORD_CHARS = 100;

// ── normalization tables (ALGORITHM.md §1) ────────────────────────────────

/**
 * Apostrophe'd contractions. Matched as literal substrings via longest-first
 * alternation, NOT word-boundary — safe precisely because the apostrophe makes
 * every key unambiguous.
 *
 * Insertion order matters: the alternation is built by a stable length-descending
 * sort over `Object.keys()`, so equal-length keys keep the order written here.
 */
export const CONTRACTIONS: Record<string, string> = {
  "won't": "will not",
  "can't": "can not",
  "n't": " not",
  "i'm": "i am",
  "you're": "you are",
  "we're": "we are",
  "they're": "they are",
  "it's": "it is",
  "that's": "that is",
  "what's": "what is",
  "who's": "who is",
  "there's": "there is",
  "here's": "here is",
  "let's": "let us",
  "i've": "i have",
  "you've": "you have",
  "we've": "we have",
  "they've": "they have",
  "i'll": "i will",
  "you'll": "you will",
  "we'll": "we will",
  "they'll": "they will",
  "i'd": "i would",
  "you'd": "you would",
  "we'd": "we would",
  "they'd": "they would",
};

/**
 * Apostrophe-LESS contractions — word-boundary matched, because a bare word
 * can collide with an unrelated real word.
 *
 * LOAD-BEARING OMISSION (ALGORITHM.md §1, "Deliberately excluded"): six
 * plausible entries are missing on purpose — `were` (we're), `its` (it's),
 * `ill` (i'll), `well` (we'll), `id` (i'd), `wed` (we'd). For each, the bare
 * word is a common English word in its own right and a blind swap would be
 * wrong more often than right. Do not add them without a context-aware rule.
 *
 * This table is also the SOURCE of the negation cue list — `gates.ts` derives
 * it from the entries whose expansion ends in `" not"` rather than re-listing
 * them, so the two can never drift apart.
 */
export const NO_APOSTROPHE_CONTRACTIONS: Record<string, string> = {
  dont: "do not",
  doesnt: "does not",
  didnt: "did not",
  wont: "will not",
  cant: "can not",
  isnt: "is not",
  arent: "are not",
  wasnt: "was not",
  werent: "were not",
  hasnt: "has not",
  havent: "have not",
  hadnt: "had not",
  wouldnt: "would not",
  couldnt: "could not",
  shouldnt: "should not",
  im: "i am",
  youre: "you are",
  theyre: "they are",
  whats: "what is",
  thats: "that is",
  whos: "who is",
  theres: "there is",
  heres: "here is",
  lets: "let us",
  ive: "i have",
  youve: "you have",
  weve: "we have",
  theyve: "they have",
  youll: "you will",
  theyll: "they will",
  youd: "you would",
  theyd: "they would",
};

// ── slot stripping (ALGORITHM.md §5) ──────────────────────────────────────

/** 11 time/date alternatives. Weekday stems: mon, tues?, wednes, thurs?, fri, satur, sun. */
export const TIME_PATTERNS = [
  "\\d{1,2}(:\\d{2})?\\s?(am|pm)",
  "noon|midnight",
  "(next|this|last)\\s+(week|month|quarter|year|sprint|monday|tuesday|wednesday|thursday|friday|saturday|sunday)",
  "(mon|tues?|wednes|thurs?|fri|satur|sun)day'?s?",
  "today'?s?",
  "tomorrow'?s?",
  "tonight",
  "an?\\s+hour(\\s+later)?",
  "a\\s+day\\b",
  "\\d+\\s+minutes?",
  "morning|afternoon|evening",
];

/**
 * Optional leading preposition/determiner, consumed ONLY as part of a
 * gazetteer/time match — never stripped on its own. This is what makes
 * "with marketing" disappear as one unit instead of leaving a dangling "with".
 */
export const LEAD =
  "(?:(?:with|in|at|on|for|under)\\s+)?(?:(?:a|an|the|my|our|your)\\s+)?";

/** 32 resource surface forms, written longest-first. */
export const RESOURCE_NAMES = [
  "conference room b",
  "conference room",
  "demo room",
  "huddle room",
  "training room",
  "recording studio",
  "room",
  "rooms",
  "studio",
  "rooftop",
  "lobby",
  "boardroom",
  "projector",
  "laptop",
  "monitor",
  "headsets",
  "headset",
  "equipment",
  "whiteboard",
  "catering",
  "parking",
  "wifi",
  "seating",
  "table",
  "microphones",
  "microphone",
  "transportation",
  "garage",
  "venue",
  "av setup",
  "av equipment",
  "av",
];

/**
 * 23 participant surface forms.
 *
 * NOTE for anything built on top of this package: these are CORPUS names, not
 * the host application's real people. They exist so `strip_slots` can delete a
 * participant mention before embedding. Entity *extraction* (`entities.ts`)
 * deliberately does not use this list — it matches against a catalog supplied
 * by the caller, because "sarah"/"alice"/"marketing" would make a parse card
 * look broken on real data.
 */
export const PARTICIPANT_NAMES = [
  "sarah",
  "alice",
  "marketing",
  "legal",
  "team",
  "client",
  "vendor",
  "pm",
  "new hire",
  "support",
  "design",
  "candidate",
  "dentist",
  "recruiter",
  "investors",
  "investor",
  "auditors",
  "auditor",
  "finance",
  "hr",
  "qa",
  "manager",
  "intern",
  "guest",
];

// ── verb-phrase extraction (ALGORITHM.md §6) ──────────────────────────────

/**
 * The closed verb lexicon — enumerable because the intent set is closed.
 *
 * `call off, scrap, list, find, plan, when, hold` are unreachable in the
 * current corpus and are retained ON PURPOSE for real-user coverage (verified
 * by the research repo's `scripts/audit_lexicon.py`, 2026-07-22). Do not prune
 * them as dead code.
 *
 * Adding a SINGLE-word entry here is a behaviour no-op under Task 3's
 * dual-vector architecture; only multi-word entries change matching.
 *
 * Key order and per-array order are load-bearing: `ALL_VERB_PHRASES` is a
 * stable sort by word count over `Object.values(...).flat()`.
 */
export const INTENT_VERBS: Record<string, string[]> = {
  add_event: [
    "schedule",
    "book",
    "set up",
    "pencil in",
    "put",
    "arrange",
    "add",
    "create",
    "plan",
    "get",
    "grab",
    "reserve",
    "hold",
    "block off",
    "block out",
    "line up",
    "throw in",
  ],
  delete_event: [
    "cancel",
    "delete",
    "remove",
    "drop",
    "scrap",
    "call off",
    "clear",
    "take off",
    "scratch",
  ],
  modify_event: [
    "move",
    "reschedule",
    "push",
    "shift",
    "change",
    "update",
    "bump",
    "extend",
    "shorten",
    "swap",
    "switch",
    "set aside",
  ],
  get_details: [
    "show",
    "what",
    "when",
    "is",
    "are",
    "list",
    "check",
    "find",
    "who",
    "do i have",
    "give me",
    "how many",
  ],
};

/**
 * Politeness/pronoun wrappers, each INCLUDING its trailing space. Sorted
 * longest-first so `"i need "` is tried before bare `"i "`. Exactly one is
 * stripped (first match wins, then `break`).
 */
export const LEADING_WRAPPERS = [
  "can you ",
  "can we ",
  "could you ",
  "would you ",
  "will you ",
  "do you mind ",
  "please ",
  "i need ",
  "could i ",
  "can i ",
  "i'd ",
  "i'm ",
  "i ",
  "we'd ",
  "we ",
].sort((a, b) => b.length - a.length);

// ── gates (ALGORITHM.md §8) ───────────────────────────────────────────────

/**
 * 27 scheduling nouns. Audited: 26/27 fire on real corpus content.
 * `appointment` is currently dead weight and `lunch` is the known over-broad
 * entry (it is one of the 3 documented false accepts — "what's for lunch
 * today" gets a domain anchor it does not deserve). BOTH ARE KEPT. Removing
 * `lunch` is a corpus decision, not a port decision.
 */
export const EVENT_NOUNS = [
  "meeting",
  "call",
  "event",
  "booking",
  "appointment",
  "sync",
  "standup",
  "review",
  "1:1",
  "lunch",
  "interview",
  "session",
  "workshop",
  "retro",
  "kickoff",
  "demo",
  "onboarding",
  "brainstorm",
  "all-hands",
  "training",
  "presentation",
  "check-in",
  "coffee chat",
  "happy hour",
  "town hall",
  "recording",
  "setup",
  "planning",
];
