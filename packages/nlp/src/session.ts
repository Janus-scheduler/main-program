/**
 * Dialogue manager — deterministic slot filling over the frozen gates.
 *
 * ══════════════════════════════════════════════════════════════════════════
 *  NEW BEHAVIOUR, ADDITIVE ONLY. It sits ON TOP of the frozen routing layer
 *  and never inside it.
 *
 *  A `CLARIFY` route is not a failure — it is the gate saying "ask the user".
 *  Until now nothing asked, so ~39% of scheduling traffic hit a dead end. This
 *  module asks, merges the answer back into the utterance, and re-runs the
 *  SAME frozen `routeFromClassification` on the result.
 *
 *  There is no LLM here and no inference at runtime. Every question is a
 *  template chosen by the gate that fired, and every answer is either text
 *  merged into the utterance or a choice from a fixed list.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * ── The one rule that matters ─────────────────────────────────────────────
 *
 * Answering a question NEVER lowers the bar for the other gates. When a user
 * confirms a negation, the utterance still has to clear gates 1-5 afterwards;
 * when they disambiguate an intent, gate 5 still demands a time. This is
 * enforced structurally: a satisfied gate is suppressed only through an input
 * the frozen function already takes — the `marginFloor` parameter, or a text
 * with the negation cue blanked — and then the whole gate ladder is re-run
 * from the top. No gate is ever skipped by index, and the ordering in
 * `gates.ts` remains the single source of truth.
 *
 * ── Statelessness ─────────────────────────────────────────────────────────
 *
 * `beginSession` and `provideAnswer` are pure functions returning a fresh
 * `SessionState`. Nothing is stored in the module, `now` is injected, and a
 * state can be serialised, stored and resumed. The UI owns the state; this
 * module owns the transitions.
 */

import { CONF_FLOOR, MARGIN_FLOOR, RESOURCE_NAMES } from "./constants";
import { classify } from "./classify";
import { hasNegation, routeFromClassification } from "./gates";
import { alternation } from "./normalize";
import { parseTimeSpan } from "./datetime";
import { extractEntities } from "./entities";
import { correctTimeWords, withinDistance } from "./spelling";
import { rewriteForClassifier } from "./rewrite";
import type {
  CatalogEntry,
  ClassifyResult,
  FiredGate,
  Intent,
  RouteResult,
  SessionAnswer,
  SessionChoice,
  SessionContext,
  SessionDraft,
  SessionQuestion,
  SessionState,
  SlotName,
  RequiredSlot,
  SpellingCorrection,
  TextSpan,
} from "./types";

/**
 * Apply typo correction, if the host asked for it.
 *
 * Runs on the RAW utterance, before `classify` and before `extractEntities`,
 * so the frozen gate and the extractor see the same string. Correcting inside
 * only one of them would let an utterance clear gate 5 and then produce a card
 * with an empty "when".
 */
function correct(
  text: string,
  ctx: SessionContext,
): { text: string; corrections: SpellingCorrection[] } {
  if (!ctx.correctSpelling) return { text, corrections: [] };
  return correctTimeWords(text, {
    artifacts: ctx.artifacts,
    catalog: ctx.catalog,
  });
}

/**
 * How many times the same question may be asked before the session gives up.
 *
 * Two, not more: if a user has answered "when?" twice and the utterance still
 * has no time anchor, a third identical prompt is a loop, not a conversation.
 * The session ends `declined` with a reason the UI can show, and the user can
 * start over — which is honest, where an endless prompt is not.
 */
export const MAX_CLARIFY_ROUNDS = 2;

/**
 * How many answers a whole conversation may take before it must end.
 *
 * `MAX_CLARIFY_ROUNDS` counts CONSECUTIVE asks of one slot, which is the right
 * measure for "you keep asking me the same thing" but cannot see the other
 * loop shape: a session that alternates `when` → `resource` → `when` resets
 * the per-slot counter on every turn and never terminates.
 *
 * Eight, because a productive conversation filling the four host requirements
 * costs four answers, and the extras a legitimate one can still owe — a stale
 * year to confirm, an unknown resource name, a typo re-asked — land on top of
 * that. Cutting a working conversation off is a far worse failure than one
 * extra prompt in a stuck one, so this sits at twice the measured productive
 * length rather than just above it.
 */
export const MAX_TOTAL_ROUNDS = 8;

// ── question templates ────────────────────────────────────────────────────

/**
 * Offered answers to "when?".
 *
 * `value` is merged into the utterance verbatim, so every one of these has to
 * be a phrase the frozen `TIME_PATTERNS` recognises as an anchor AND
 * `datetime.ts` can resolve — otherwise tapping a chip would re-trigger the
 * very gate it is meant to satisfy. A test pins exactly that.
 *
 * The bare day options resolve to the 09:00 default and say so in
 * `ResolvedTime.assumptions`, which the parse card shows.
 */
const WHEN_CHOICES: SessionChoice[] = [
  { id: "when-today", label: "Today", value: "today" },
  { id: "when-tomorrow", label: "Tomorrow", value: "tomorrow" },
  {
    id: "when-tomorrow-morning",
    label: "Tomorrow morning",
    value: "tomorrow morning",
  },
  {
    id: "when-tomorrow-afternoon",
    label: "Tomorrow afternoon",
    value: "tomorrow afternoon",
  },
  { id: "when-next-week", label: "Next week", value: "next week" },
];

const TIME_OF_DAY_CHOICES: SessionChoice[] = [
  { id: "time-9am", label: "9:00 AM", value: "at 9:00 AM" },
  { id: "time-10am", label: "10:00 AM", value: "at 10:00 AM" },
  { id: "time-11am", label: "11:00 AM", value: "at 11:00 AM" },
  { id: "time-2pm", label: "2:00 PM", value: "at 2:00 PM" },
  { id: "time-3pm", label: "3:00 PM", value: "at 3:00 PM" },
  { id: "time-4pm", label: "4:00 PM", value: "at 4:00 PM" },
  { id: "time-morning", label: "Morning", value: "in the morning" },
  { id: "time-afternoon", label: "Afternoon", value: "in the afternoon" },
];

const YES_NO_CHOICES: SessionChoice[] = [
  { id: "confirm-yes", label: "Yes, go ahead", value: "yes" },
  { id: "confirm-no", label: "No, never mind", value: "no" },
];

/** Prose for each intent, for the disambiguation question and confirmations. */
const INTENT_LABELS: Record<Intent, string> = {
  add_event: "Add an event",
  modify_event: "Move or change an event",
  delete_event: "Cancel an event",
  get_details: "Look something up",
  none: "None of these",
};

const INTENT_VERB_PHRASES: Record<Intent, string> = {
  add_event: "schedule",
  modify_event: "change",
  delete_event: "cancel",
  get_details: "look up",
  none: "handle",
};

/**
 * Phrases that make an earlier clock mean "the next day", not "before we start".
 *
 * Only these justify rolling an end time over midnight. Without the cue an
 * earlier clock is far more likely to be a confused answer than a deliberate
 * overnight booking, and rolling it silently produced 18- to 24-hour events.
 */
const OVERNIGHT_CUE_RE =
  /\b(?:until|untill|till|til|thru|through|to|ends?\s+at|ending\s+at|finish(?:es|ing)?\s+at)\b/i;

const AFFIRMATIVE_RE =
  /^\s*(y|yes|yep|yeah|yup|sure|ok|okay|confirm(?:ed)?|correct|right|go ahead|do it|please do)\b/i;
const NEGATIVE_RE =
  /^\s*(n|no|nope|nah|cancel|stop|don'?t|never ?mind|forget it|leave it)\b/i;

// ── negation suppression ──────────────────────────────────────────────────

const WHITESPACE_ONLY = /^\s+$/;

function isWord(part: string): boolean {
  return part.length > 0 && !WHITESPACE_ONLY.test(part);
}

function blank(part: string): string {
  return " ".repeat(part.length);
}

/**
 * Blank out the negation cue(s) in `text`, leaving everything else in place.
 *
 * Needed because `negation` is the FIRST gate: once a user has confirmed
 * "yes, I did mean to cancel it", gates 1-5 have still never run on that
 * utterance, so we have to route it again — and it would trip the same gate
 * forever unless the cue is removed.
 *
 * The cue list is NOT re-declared here. `hasNegation` — the frozen detector
 * itself — is used as the oracle: a token is a cue if the detector fires on
 * that token alone, and a pair of adjacent tokens is a cue if it fires on the
 * pair ("no longer", "no more" are the only two-word forms today, and this
 * finds any future one for free). That is what stops a second copy of the list
 * from drifting out of sync with `gates.ts`.
 *
 * Only the cue is blanked, never a prefix or the whole string: blanking
 * anything else could remove a time/resource/event-noun anchor and turn a
 * confirmed utterance into a `gate3_no_anchor` rejection.
 *
 * If the detector still fires afterwards the ORIGINAL text is returned
 * unchanged — better to re-ask than to route a mangled sentence.
 */
export function stripNegationCues(text: string): string {
  if (!hasNegation(text)) return text;

  // Split on whitespace but KEEP it, so character offsets and word spacing
  // survive verbatim into the re-routed text.
  const parts = text.split(/(\s+)/);
  const out = [...parts];

  for (let i = 0; i < out.length; i++) {
    if (isWord(out[i]) && hasNegation(out[i])) out[i] = blank(out[i]);
  }

  if (hasNegation(out.join(""))) {
    for (let i = 0; i < out.length; i++) {
      if (!isWord(out[i])) continue;
      const j = out.findIndex((p, k) => k > i && isWord(p));
      if (j < 0) break;
      if (hasNegation(out.slice(i, j + 1).join(""))) {
        out[i] = blank(out[i]);
        out[j] = blank(out[j]);
      }
    }
  }

  const cleaned = out.join("");
  return hasNegation(cleaned) ? text : cleaned;
}

// ── evaluation ────────────────────────────────────────────────────────────

function buildDraft(
  text: string,
  intent: Intent,
  ctx: SessionContext,
): SessionDraft {
  /**
   * The negation cue is routing information, never event content.
   *
   * "don't book Operating Room 1 tomorrow at 3pm" named its room and its time,
   * so nothing was left over but the cue itself — which became the event
   * TITLE, "don't book". Whether the user said "don't" is the negation gate's
   * business; it has no place in the name of the thing being scheduled.
   *
   * Blanked rather than cut, so every offset still indexes into `text` and
   * `titleSpan` stays a valid slice of the original. `stripNegationCues`
   * returns the string untouched when there is no cue, so this costs nothing
   * for the overwhelming majority of utterances.
   */
  const entities = extractEntities(stripNegationCues(text), {
    catalog: ctx.catalog,
    now: ctx.now,
    timezone: ctx.timezone,
  });
  return {
    intent,
    title: entities.title,
    titleSpan: entities.titleSpan,
    timeSpan: entities.timeSpan,
    time: entities.time,
    resources: entities.resources,
    participants: entities.participants,
  };
}

// ── unrecognised resource names ───────────────────────────────────────────

/**
 * The frozen resource vocabulary as one longest-first alternation.
 *
 * READ-ONLY use of a frozen constant, which is the same thing `gates.ts` and
 * `preprocess.ts` do. Nothing in `constants.ts` is modified.
 */
const RESOURCE_WORD_RE = new RegExp(alternation(RESOURCE_NAMES), "gi");

/** "A", "B", "1", "101" — the part of "Room A" that is not the word "room". */
const DESIGNATOR_RE = /^[a-z0-9]{1,3}$/i;

/** Anchored copy of the frozen vocabulary, for testing a single token. */
const RESOURCE_WORD_EXACT_RE = new RegExp(
  `^(?:${alternation(RESOURCE_NAMES, { boundary: false })})$`,
  "i",
);

/** Is this single token one of the frozen resource words? */
function isResourceWord(token: string): boolean {
  return RESOURCE_WORD_EXACT_RE.test(token.replace(/[^a-z0-9]/gi, ""));
}

/**
 * Did the user name a room that the host's catalog does not contain?
 *
 * The problem this solves: `extractEntities` matches only against the HOST
 * catalog, by design. So "book Room A tomorrow at 3pm" against a catalog of
 * "Operating Room 1" matches nothing, "Room A" survives into the leftover text,
 * and the leftover text IS the title. The user then gets asked "Which room or
 * person is “Room A” for?" — quoting their room back at them as though it were
 * an event name — and the event is finally created called "Room A".
 *
 * Detecting this needs more than "the title contains a resource word", because
 * plenty of real event names do:
 *
 *     "room inspection"   "projector demo"   "table read"
 *
 * The distinction that actually separates them is what is LEFT once the
 * resource vocabulary is removed. A resource reference leaves nothing, or a
 * bare designator:
 *
 *     "Room A"            -> ""            -> resource reference
 *     "Conference Room B" -> "B"           -> resource reference
 *     "boardroom"         -> ""            -> resource reference
 *     "room inspection"   -> "inspection"  -> a real title
 *     "projector demo"    -> "demo"        -> a real title
 *
 * Only ever consulted when the catalog matched NOTHING. If the utterance named
 * a real resource, the title is whatever else the user wrote and is not
 * second-guessed.
 */
function unrecognisedResourceName(
  draft: SessionDraft,
  ctx?: SessionContext,
): string | null {
  if (!draft.title || !draft.titleSpan) return null;
  if (draft.resources.length > 0 || draft.participants.length > 0) return null;

  // ── Rule 1: nothing but resource vocabulary and a designator ────────────
  // "Room A" → "", "Conference Room B" → "B", "boardroom" → "".
  const stripped = draft.title
    .replace(RESOURCE_WORD_RE, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (
    stripped !== draft.title &&
    (stripped === "" || DESIGNATOR_RE.test(stripped))
  ) {
    return draft.title;
  }

  // ── Rule 2: the HEAD noun is a resource word ────────────────────────────
  //
  // Rule 1 alone missed "3rd floor room": stripping "room" leaves "3rd floor",
  // which is neither empty nor a designator, so it read as a title.
  //
  // The head of an English noun phrase is its last noun, and that is what the
  // phrase actually denotes. "3rd floor ROOM" is a room that happens to be on
  // the 3rd floor; "room INSPECTION" is an inspection that happens to concern a
  // room. Same word, opposite meaning, decided entirely by position — which is
  // why a bag-of-words test cannot separate them and this one can.
  const words = draft.title.trim().split(/\s+/);
  const head = words[words.length - 1] ?? "";
  if (words.length > 1 && isResourceWord(head)) return draft.title;

  // ── Rule 3: a near-miss for something in the caller's own catalog ───────
  //
  // "MRI Scanner C" contains no frozen resource word at all, so rules 1 and 2
  // never see it — yet it is obviously a reference to "MRI Scanner A" or
  // "MRI Scanner B". Edit distance against the real catalog catches the whole
  // class of unknown equipment, which is what most real installations have.
  const entries = [
    ...(ctx?.catalog?.resources ?? []),
    ...(ctx?.catalog?.participants ?? []),
  ];

  // Compared against every contiguous SUB-PHRASE of the title, longest first,
  // not just the whole thing.
  //
  // Whole-title comparison broke on one stray word. "Pick MRI Scanner A" —
  // where "Pick" is not in the frozen verb lexicon, so it is never stripped —
  // produced the title "Pick MRI Scanner A", which is nowhere near
  // "MRI Scanner B", so the user was asked "Which room or person is
  // “Pick MRI Scanner A” for?" instead of being told there is no Scanner A.
  //
  // No length floor is needed: `withinDistance` rejects immediately when the
  // lengths differ by more than the bound, so a short window cannot match a
  // long catalog name ("Pick" vs "MRI Scanner B" differs by 9).
  for (let len = words.length; len >= 1; len--) {
    for (let i = 0; i + len <= words.length; i++) {
      const phrase = words.slice(i, i + len).join(" ");
      const lowered = phrase.toLowerCase();
      for (const entry of entries) {
        // Tight bound: one or two characters. "MRI Scanner C" vs
        // "MRI Scanner A" is 1. Looser starts matching genuine titles of a
        // similar length, and a false positive interrogates the user about a
        // name they meant.
        if (withinDistance(lowered, entry.name.toLowerCase(), 2)) {
          // Report the SUB-PHRASE, so the question names what the user got
          // wrong rather than quoting their whole sentence back at them.
          return phrase;
        }
      }
    }
  }

  return null;
}

/** Sentinel a UI sends to keep an unmatched name as the event title. */
export const KEEP_TITLE_ANSWER = "__keep_title__";

/**
 * Replace `span` of `text` with `replacement`, tidying the whitespace.
 *
 * The offsets come from `extractEntities`, which ran on this exact string, so
 * they are always in range. Guarded anyway: a stale span from a serialised
 * state must degrade to an append, never throw or corrupt the utterance.
 */
function spliceSpan(text: string, span: TextSpan, replacement: string): string {
  if (span.start < 0 || span.end > text.length || span.start > span.end) {
    return `${text} ${replacement}`.replace(/\s+/g, " ").trim();
  }
  return `${text.slice(0, span.start)} ${replacement} ${text.slice(span.end)}`
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Replace several disjoint spans with one string, keeping the gaps.
 *
 * Blanks from the end backwards so earlier offsets stay valid, then inserts
 * the replacement where the FIRST span began. The alternative — one splice
 * from the first span's start to the last one's end — also swallows whatever
 * sits between them, which is how changing a room deleted the time.
 */
function spliceSpans(
  text: string,
  spans: TextSpan[],
  replacement: string,
): string {
  const usable = spans
    .filter((s) => s.start >= 0 && s.end <= text.length && s.start <= s.end)
    .sort((a, b) => a.start - b.start);
  if (usable.length === 0) return `${text} ${replacement}`.trim();

  let out = text;
  for (let i = usable.length - 1; i >= 0; i--) {
    out = out.slice(0, usable[i].start) + out.slice(usable[i].end);
  }
  const at = usable[0].start;
  return `${out.slice(0, at)} ${replacement} ${out.slice(at)}`
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Wall-clock "15:00" → "3:00 pm", a form the time parser can actually read.
 *
 * LOAD-BEARING. These strings are merged back into the utterance and re-parsed,
 * and the frozen clock pattern requires a meridiem — `\d{1,2}(:\d{2})?\s?(am|pm)`.
 * A 24-hour string does NOT match, so a suffix built straight from
 * `ResolvedTime.localTime` parsed as nothing and the hour fell back to the 09:00
 * default: answering "Tomorrow" to a question about a 3pm booking silently
 * moved it to 9am. Any chip value carrying a time has to go through here.
 */
function clockPhrase(localTime: string): string {
  const [h, m] = localTime.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return localTime;
  const suffix = h < 12 ? "am" : "pm";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${suffix}`;
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/**
 * "2027-08-25" → "August 25 2027", a form the time parser can actually read.
 *
 * LOAD-BEARING, for the same reason as `clockPhrase`. Chip values are merged
 * back into the utterance and re-parsed, and an ISO date matches NO mention
 * pattern — `parseTimeSpan("2027-08-25 at 3:00 pm").date` is `undefined`. A
 * chip built that way contributes only a clock, so `provideAnswer` sees
 * clock-only input, takes its APPEND branch instead of splicing, and the
 * original date survives in the utterance. The answer then looks right for the
 * wrong reason and the merged text reads "August 25th at 3pm 3:00 pm".
 *
 * The year is always stated, so the resolver has nothing left to infer — which
 * is the whole point when the chip's LABEL is showing the user a specific date.
 */
function calendarPhrase(localDate: string): string {
  const [y, m, d] = localDate.split("-").map(Number);
  const name = MONTH_NAMES[m - 1];
  if (!name || !Number.isFinite(d) || !Number.isFinite(y)) return localDate;
  return `${name} ${d} ${y}`;
}

/** Shift a "YYYY-MM-DD" string by whole days, with month/year rollover. */
function addDaysISO(localDate: string, delta: number): string {
  const [y, m, d] = localDate.split("-").map(Number);
  const shifted = new Date(Date.UTC(y, m - 1, d + delta));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
}

/** Curly quotes, matching `subjectOf`. */
function quote(s: string): string {
  return `“${s}”`;
}

/** "design sync", or the room, or a neutral fallback. Never empty. */
function subjectOf(draft: SessionDraft): string {
  if (draft.title) return `“${draft.title}”`;
  if (draft.resources.length > 0) return draft.resources[0].name;
  if (draft.participants.length > 0)
    return `your time with ${draft.participants[0].name}`;
  // "this", not the fallback TITLE. These words are dropped into questions —
  // "When should this be?" reads like a person; "When should New Event be?"
  // reads like the machine has already named the event on the user's behalf,
  // which is the very thing the title question exists to stop.
  return "this";
}

/** The distinct intents in the top-K neighbours, best first, `none` dropped. */
function candidateIntents(result: ClassifyResult): Intent[] {
  const seen: Intent[] = [];
  for (const n of result.neighbours) {
    if (n.intent === "none") continue;
    if (!seen.includes(n.intent)) seen.push(n.intent);
  }
  return seen;
}

/**
 * Turn a firing gate into a question.
 *
 * Only gates that routed CLARIFY get one. The three REJECT gates deliberately
 * do not: a below-floor confidence or a `none` nearest neighbour means the
 * system did not understand the utterance at all, and asking a follow-up
 * question about an utterance you have not understood produces nonsense.
 */
function buildQuestion(
  route: RouteResult,
  draft: SessionDraft,
): SessionQuestion | null {
  switch (route.gate) {
    case "gate5_missing_slot":
      return {
        slot: "when",
        gate: route.gate,
        source: "gate",
        skippable: false,
        text: `When should ${subjectOf(draft)} be?`,
        choices: WHEN_CHOICES,
      };

    case "gate3b_resource_only":
      // The "parking" case: a room was named with no time and no event noun.
      // Asking when turns it into a booking; the gate stops firing because the
      // merged text now has a time anchor.
      return {
        slot: "when",
        gate: route.gate,
        source: "gate",
        skippable: false,
        text: `When would you like ${subjectOf(draft)}?`,
        choices: WHEN_CHOICES,
      };

    case "gate4_margin": {
      const candidates = candidateIntents(route).slice(0, 3);
      if (candidates.length < 2) return null;
      return {
        slot: "intent",
        gate: route.gate,
        source: "gate",
        skippable: false,
        text: "I'm not sure what you'd like to do — which is it?",
        choices: candidates.map((intent) => ({
          id: `intent-${intent}`,
          label: INTENT_LABELS[intent],
          value: intent,
        })),
      };
    }

    case "negation":
      return {
        slot: "confirm",
        gate: route.gate,
        source: "gate",
        skippable: false,
        text: `That reads like a negative — do you want me to ${INTENT_VERB_PHRASES[draft.intent]} ${subjectOf(draft)}?`,
        choices: YES_NO_CHOICES,
      };

    default:
      return null;
  }
}

// ── host requirements ─────────────────────────────────────────────────────

const DURATION_CHOICES: SessionChoice[] = [
  { id: "dur-30m", label: "30 min", value: "for 30 minutes" },
  { id: "dur-45m", label: "45 min", value: "for 45 minutes" },
  { id: "dur-1h", label: "1 hr", value: "for 1 hour" },
  { id: "dur-1.5h", label: "1.5 hr", value: "for 1.5 hours" },
  { id: "dur-2h", label: "2 hr", value: "for 2 hours" },
];

/** Is this requirement satisfied by what has been understood so far? */
function slotIsFilled(slot: RequiredSlot, draft: SessionDraft): boolean {
  switch (slot) {
    case "when":
      return draft.time !== null && !draft.time.assumed.timeOfDay;
    case "resource":
      // People and rooms are both rows on the timeline, so either satisfies
      // it — "with Sarah" and "in Room A" are equally complete.
      return draft.resources.length > 0 || draft.participants.length > 0;
    case "title":
      return typeof draft.title === "string" && draft.title.trim().length > 0;
    case "duration":
      // The stated length counts even before there is a date to attach it to.
      // `resolveTime` returns null when nothing anchors the event in the
      // calendar, so "book ICU Bay 9 for 30 minutes" had `time === null` and
      // this reported the duration as missing — while the user was looking at
      // the words "for 30 minutes" in their own message.
      if (draft.timeSpan?.durationMinutes !== undefined) return true;
      return draft.time !== null && !draft.time.assumed.duration;
  }
}

/**
 * Offer the catalog as choices, categorized by kind.
 */
function resourceChoices(ctx: SessionContext): SessionChoice[] {
  const rooms: SessionChoice[] = (ctx.catalog?.resources ?? []).map(
    (entry) => ({
      id: `resource-${entry.id}`,
      label: entry.name,
      value: entry.name,
      kind: "place",
      group: "Rooms / Locations",
    }),
  );
  const people: SessionChoice[] = (ctx.catalog?.participants ?? []).map(
    (entry) => ({
      id: `resource-${entry.id}`,
      label: entry.name,
      value: entry.name,
      kind: "person",
      group: "People / Participants",
    }),
  );

  return [...rooms, ...people];
}

/**
 * Tappable name suggestions, built ONLY from what the user already said.
 *
 * Nothing here is invented: every suggestion names a person or room the user
 * themselves put in the utterance, and it only becomes the title if they tap
 * it. A free-text reply and a Skip chip are always available alongside.
 *
 * The deliberate omission is domain guesswork — no "Consultation", no
 * "Appointment". This package has no idea what kind of organisation it is
 * running in, and a wrong-sounding suggestion is worse than none.
 */
function titleSuggestions(draft: SessionDraft): SessionChoice[] {
  const out: SessionChoice[] = [];

  const person = draft.participants[0];
  if (person) {
    const others = draft.participants.length - 1;
    const label =
      others > 0
        ? `Meeting with ${person.name} +${others}`
        : `Meeting with ${person.name}`;
    out.push({ id: "title-with-person", label, value: label });
  }

  out.push({ id: "title-meeting", label: "Meeting", value: "Meeting" });
  return out;
}

/**
 * Ask for the first unmet host requirement.
 *
 * Runs only once every gate has passed, and only ever ADDS a question — it
 * cannot rescue a rejected utterance, and a test pins that.
 */
function requirementQuestion(
  draft: SessionDraft,
  ctx: SessionContext,
  skipped: SlotName[],
  keptTitle = false,
): SessionQuestion | null {
  const required = ctx.requires?.[draft.intent] ?? [];

  // Every requirement question carries a Skip chip. The host said the field
  // matters, not that it is unobtainable — refusing to let someone past a
  // question they cannot answer turns a helper into an obstacle.
  //
  // `skippable` stays TRUE even though no Skip chip is rendered: the round-cap
  // escape still offers “Skip that and continue”, and that offer is gated on
  // this flag. What changed is only what the CARD shows.
  const asking = (
    slot: SlotName,
    text: string,
    choices: SessionChoice[],
  ): SessionQuestion => ({
    slot,
    gate: null,
    source: "requirement",
    skippable: true,
    text,
    // “Other…” belongs only where the chips are a SAMPLE of something
    // unbounded. Times and lengths are: six clock chips out of 1,440 minutes,
    // five durations out of any number, so a way to type your own is
    // essential.
    //
    // The room/person list is not a sample — it is the host's entire catalog.
    // There is no other room. Offering one invites a name the calendar does
    // not have, which only leads to “I don't have that” and back to the same
    // question. A long catalog gets a search box instead (`searchable`).
    choices: OPEN_ENDED_SLOTS.has(slot) ? [...choices, OTHER_CHOICE] : choices,
  });

  // ── a name we do not have preempts every other requirement ──────────────
  //
  // Ordering matters here, and getting it wrong was visible. With
  // `requires: ["when", "duration", "resource", "title"]`, "book MRI Scanner C"
  // asked "How long should “MRI Scanner C” be?" FIRST — quoting the user's room
  // back at them as though it were the event's name — and only admitted there
  // was no Scanner C one question later.
  //
  // An unknown name is a CORRECTION, not a slot to fill: every question after
  // it is phrased from a subject that is about to change, so asking it first is
  // the only order that reads sensibly. Still gated on the host actually
  // requiring a resource — otherwise this would interrogate about a field they
  // never asked for.
  if (
    required.includes("resource") &&
    !skipped.includes("resource") &&
    !slotIsFilled("resource", draft)
  ) {
    const unknown = keptTitle ? null : unrecognisedResourceName(draft, ctx);
    if (unknown) {
      const choices = resourceChoices(ctx);
      if (choices.length > 0) {
        return {
          ...asking(
            "resource",
            `I don't have ${quote(unknown)} in your resources. Which one did you mean?`,
            [
              ...choices,
              {
                id: "keep-title",
                label: `Use ${quote(unknown)} as the event name`,
                value: KEEP_TITLE_ANSWER,
              },
            ],
          ),
          multiselect: true,
          searchable: choices.length > 5,
          inputPlaceholder: "Type or search names…",
          replaceSpan: draft.titleSpan,
        };
      }
    }
  }

  for (const slot of required) {
    if (slotIsFilled(slot, draft) || skipped.includes(slot)) continue;

    switch (slot) {
      case "when": {
        const hasExplicitDate = draft.time !== null && !draft.time.assumed.date;
        if (hasExplicitDate) {
          const dateStr = draft.time?.localDate
            ? ` (${draft.time.localDate})`
            : "";
          return {
            ...asking(
              "when",
              `What time${dateStr} should ${subjectOf(draft)} be?`,
              TIME_OF_DAY_CHOICES,
            ),
            inputPlaceholder: "e.g. 2:30 PM, 10am…",
          };
        }
        return {
          ...asking("when", `When should ${subjectOf(draft)} be?`, [
            ...WHEN_CHOICES,
          ]),
          inputPlaceholder: "e.g. tomorrow at 2pm, Aug 18 at 10am…",
        };
      }

      case "duration":
        return {
          ...asking(
            "duration",
            `How long should ${subjectOf(draft)} be, or when should it end?`,
            DURATION_CHOICES,
          ),
          inputPlaceholder: "e.g. 45 mins, or until 6:30 PM…",
        };

      case "resource": {
        const choices = resourceChoices(ctx);
        // Nothing to offer means nothing to ask about — an empty catalog is
        // the host's problem, not something to interrogate the user over.
        if (choices.length === 0) continue;
        const isSearchable = choices.length > 5;

        // The unknown-name case is handled by the preempt above, before any
        // other requirement question, so by here the name is either recognised
        // or the user has chosen to keep it as the title.
        return {
          ...asking(
            "resource",
            `Which room or person is ${subjectOf(draft)} for?`,
            choices,
          ),
          multiselect: true,
          searchable: isSearchable,
          inputPlaceholder: "Type or search names…",
        };
      }

      case "title":
        return {
          ...asking("title", "What should I call it?", titleSuggestions(draft)),
          inputPlaceholder: "e.g. Design sync, Weekly review…",
        };
    }
  }

  return null;
}

/**
 * Would a catalog hit justify asking "when?" instead of refusing outright?
 *
 * The ONLY place this layer overrules the frozen one, and it is kept as narrow
 * as it can be:
 *
 *   - `gate3_no_anchor` only. Gates 1 and 2 mean "I did not understand this
 *     utterance", and a catalog hit says nothing about that. Gate 3 is
 *     different: it means "I understood it but saw no scheduling signal", and
 *     a name the host supplied IS a scheduling signal that the frozen 23-name
 *     research corpus simply cannot know about.
 *   - a real match required. Not "a catalog was supplied" — something in the
 *     catalog has to appear in the text.
 *   - it asks, it never proceeds. The result is always a question, so the user
 *     still confirms before anything happens.
 *
 * Returns `null` to leave the frozen REJECT standing.
 */
function catalogSoftening(
  route: RouteResult,
  draft: SessionDraft,
  ctx: SessionContext,
): { gate: FiredGate; matched: string; note: string } | null {
  if (route.gate !== "gate3_no_anchor") return null;

  const hasCatalog =
    (ctx.catalog?.resources?.length ?? 0) > 0 ||
    (ctx.catalog?.participants?.length ?? 0) > 0;
  if (!(ctx.catalogAnchor ?? hasCatalog)) return null;

  const match = draft.resources[0] ?? draft.participants[0];
  if (!match) return null;

  return {
    gate: route.gate,
    matched: match.name,
    note: `“${match.name}” is in your catalog - asking rather than refusing`,
  };
}

interface EvaluateInput {
  text: string;
  utterances: string[];
  answers: SessionAnswer[];
  satisfied: FiredGate[];
  rounds: number;
  /** Monotonic count of every answer this conversation has taken. */
  totalRounds: number;
  /** Where the current total-round budget is measured from. */
  capBaseline?: number;
  skipped: SlotName[];
  corrections: SpellingCorrection[];
  intentChoice?: Intent;
  /** The slot just answered, so `rounds` can reset when the topic moves on. */
  lastSlot?: SlotName;
  unresolved?: SlotName;
  keptTitle?: boolean;
}

/**
 * Classify, route, extract — the whole turn, for one merged utterance.
 *
 * The two suppression mechanisms are both ordinary inputs to the frozen
 * function, never edits to it:
 *   - a satisfied `gate4_margin` lowers `marginFloor` to -Infinity, which is
 *     what that parameter is for;
 *   - a satisfied `negation` routes against the cue-blanked text.
 * Everything else runs exactly as it does for a first-time utterance.
 */
function evaluate(input: EvaluateInput, ctx: SessionContext): SessionState {
  const { text, satisfied, rounds } = input;
  const maxRounds = ctx.maxRounds ?? MAX_CLARIFY_ROUNDS;

  const classifyText = rewriteForClassifier(text);
  const classified = classify(classifyText, ctx.artifacts, ctx.prototypes);
  // A disambiguated intent replaces the classifier's pick, so the gates that
  // read `intent` (gate 2, gate 5) see the user's answer rather than the
  // coin-flip that triggered the question.
  const result: ClassifyResult = input.intentChoice
    ? { ...classified, intent: input.intentChoice }
    : classified;

  // Only the GATES see the cue-free text. The classification above is always
  // of what the user actually said, cue included, and that is load-bearing:
  //
  //   "don't book Room A"  classifies as a cancellation.
  //   "book Room A"        classifies as a booking.
  //
  // The confirmation question is phrased from the draft's intent ("do you want
  // me to cancel Room A?"). If confirming re-classified the stripped sentence,
  // the user would answer a question about cancelling and get a booking. So
  // the cue is removed for exactly one purpose — stopping the negation gate
  // from firing on a question the user has already answered — and for nothing
  // else.
  const probe = satisfied.includes("negation") ? stripNegationCues(text) : text;
  const marginFloor = satisfied.includes("gate4_margin")
    ? Number.NEGATIVE_INFINITY
    : MARGIN_FLOOR;

  const route = routeFromClassification(result, probe, CONF_FLOOR, marginFloor);
  const draft = buildDraft(text, result.intent, ctx);

  const base = {
    text,
    utterances: input.utterances,
    answers: input.answers,
    route,
    rounds,
    totalRounds: input.totalRounds,
    capBaseline: input.capBaseline,
    satisfied,
    skipped: input.skipped,
    corrections: input.corrections,
    intentChoice: input.intentChoice,
    unresolved: input.unresolved,
    keptTitle: input.keptTitle,
    // Skipped slots leave the count. A skipped slot is not filled, so filtering
    // on `slotIsFilled` alone kept it outstanding for ever — the session could
    // reach `ready` still reporting two slots to go, and the "N more to go"
    // label never came down. Declining to answer is a resolution, just not the
    // one that fills the field; whatever the host substitutes is disclosed on
    // the card instead.
    outstanding: (ctx.requires?.[draft.intent] ?? []).filter(
      (slot) => !slotIsFilled(slot, draft) && !input.skipped.includes(slot),
    ),
  };

  /**
   * Park on a question, unless we have already asked this same one too often.
   *
   * The cap counts CONSECUTIVE asks of one slot, not total answers: filling
   * three empty fields is a conversation, asking "when?" three times is a loop.
   * Moving to a different slot resets the counter.
   */
  const ask = (
    question: SessionQuestion,
    reason: string,
    extra: Partial<SessionState> = {},
  ): SessionState => {
    const spent = input.lastSlot === question.slot ? rounds : 0;
    const slotCapped = spent >= maxRounds;
    const spentTotal = input.totalRounds - (input.capBaseline ?? 0);
    const totalCapped = spentTotal >= MAX_TOTAL_ROUNDS;

    if (slotCapped || totalCapped) {
      const why = slotCapped
        ? `still unclear after ${spent} question${spent === 1 ? "" : "s"} on "${question.slot}"`
        : `${spentTotal} answers in and still not resolved`;

      if (
        draft &&
        (draft.time ||
          draft.resources.length > 0 ||
          draft.participants.length > 0)
      ) {
        // Only a host requirement may be skipped. Gates are never skippable —
        // that is the invariant the whole layer rests on — so a gate-stuck
        // session is offered starting over and nothing else.
        const canSkip = question.source === "requirement" && question.skippable;

        return {
          ...base,
          status: "awaiting",
          draft,
          roundCapReached: true,
          question: {
            slot: "escape",
            gate: null,
            source: "gate",
            skippable: false,
            text: canSkip
              ? "I'm still not getting that. Want me to skip it and carry on, or start over?"
              : "I'm still not getting that. Would you like to start over?",
            choices: [
              ...(canSkip
                ? [
                    {
                      id: "skip-continue",
                      label: "Skip that and continue",
                      value: `${ESCAPE_SKIP_PREFIX}${question.slot}`,
                    },
                  ]
                : []),
              {
                id: "start-over",
                label: "Start over",
                value: ESCAPE_START_OVER,
              },
            ],
          },
          reason: why,
        };
      }

      return {
        ...base,
        status: "declined",
        draft,
        roundCapReached: true,
        question: null,
        reason: `${why} - starting over will be quicker`,
      };
    }
    return {
      ...base,
      rounds: spent,
      status: "awaiting",
      draft,
      question,
      reason,
      ...extra,
    };
  };

  if (route.route === "PROCEED") {
    if (
      draft.time?.pastRelativeWeekday &&
      (draft.intent === "add_event" || draft.intent === "modify_event") &&
      !input.skipped.includes("when") &&
      !input.answers.some((a) => a.slot === "when" && a.gate === null)
    ) {
      const weekdayCap = draft.time.weekday
        ? draft.time.weekday.charAt(0).toUpperCase() +
          draft.time.weekday.slice(1)
        : "the day";
      const timeSuffix = draft.time.assumed?.timeOfDay
        ? ""
        : ` at ${clockPhrase(draft.time.localTime)}`;
      const pastQ: SessionQuestion = {
        slot: "when",
        gate: null,
        source: "gate",
        skippable: false,
        text: `Did you mean past ${weekdayCap} (${draft.time.pastDate}) or upcoming ${weekdayCap} (${draft.time.upcomingDate})?`,
        // Values are explicit dates, derived from the SAME strings the labels
        // show. They used to be "next monday" / "last monday", and "last
        // monday" resolves to the Monday of LAST WEEK — so the button labelled
        // "Past Monday (2026-08-31)" actually booked 2026-08-24. A button that
        // names a date has to produce that date.
        choices: [
          {
            id: "choice-upcoming",
            label: `Upcoming ${weekdayCap} (${draft.time.upcomingDate})`,
            value: `${calendarPhrase(draft.time.upcomingDate ?? "")}${timeSuffix}`,
          },
          {
            id: "choice-past",
            label: `Past ${weekdayCap} (${draft.time.pastDate})`,
            value: `${calendarPhrase(draft.time.pastDate ?? "")}${timeSuffix}`,
          },
        ],
      };
      return ask(
        pastQ,
        "ambiguous whether 'this' weekday refers to past or upcoming day",
      );
    }

    // A stated calendar date that only resolved by adding a whole year.
    //
    // "August 25th" on 30 August silently became August 2027 — twelve months
    // from a date five days gone. Rolling forward is right in general and wrong
    // here, and the difference is not something to guess at, so ask. Same shape
    // as the past-weekday question above, and gated the same way: only for
    // intents that write a time, and only if the user has not already answered
    // a `when` question (or skipped it), so confirming cannot re-trigger it.
    if (
      draft.time?.staleYearRoll &&
      draft.time.statedDate &&
      (draft.intent === "add_event" || draft.intent === "modify_event") &&
      !input.skipped.includes("when") &&
      !input.answers.some((a) => a.slot === "when")
    ) {
      const rolled = draft.time.localDate;
      const stated = draft.time.statedDate;
      const timeSuffix = draft.time.assumed?.timeOfDay
        ? ""
        : ` at ${clockPhrase(draft.time.localTime)}`;
      // Carry the stated hour onto every alternative. The user said "at 9am";
      // offering bare day chips would replace the whole time span and throw
      // that away, so picking "Tomorrow" would immediately be followed by
      // "what time?" — asking again for something they had already told us.
      //
      // Part-of-day chips are dropped when there IS an explicit hour, since
      // "tomorrow morning at 09:00" is a contradiction to read back.
      const alternatives = timeSuffix
        ? WHEN_CHOICES.filter((c) => !/morning|afternoon/.test(c.value)).map(
            (c) => ({ ...c, value: `${c.value}${timeSuffix}` }),
          )
        : WHEN_CHOICES;

      const staleQ: SessionQuestion = {
        slot: "when",
        gate: null,
        source: "gate",
        skippable: false,
        text: `${stated} has already passed. Did you mean next year, or another date?`,
        choices: [
          {
            id: "choice-next-year",
            label: `${rolled} (next year)`,
            value: `${calendarPhrase(rolled)}${timeSuffix}`,
          },
          ...alternatives,
        ],
        inputPlaceholder: "e.g. 25 September, or tomorrow at 9am…",
      };
      return ask(staleQ, "stated calendar date is in the recent past");
    }

    // Landed in the past without being asked to.
    //
    // Ordered LAST of the three date questions on purpose: the past-weekday and
    // stale-year cases have their own, better-targeted wording, and both return
    // before reaching here. This is the backstop for everything else — today
    // with an hour that has gone, and any future path that resolves backwards
    // by accident.
    //
    // It never fires for "yesterday", "last friday", "last week" or a stated
    // year: `resolvedInPast` is already false for those, because asking about a
    // date the user named outright would be nagging, and rolling it forward
    // would be overriding them.
    if (
      draft.time?.resolvedInPast &&
      (draft.intent === "add_event" || draft.intent === "modify_event") &&
      !input.skipped.includes("when") &&
      !input.answers.some((a) => a.slot === "when")
    ) {
      const when = `${clockPhrase(draft.time.localTime)} on ${draft.time.localDate}`;
      const tomorrow = addDaysISO(draft.time.localDate, 1);
      const timeSuffix = ` at ${clockPhrase(draft.time.localTime)}`;
      const pastQ: SessionQuestion = {
        slot: "when",
        gate: null,
        source: "gate",
        skippable: false,
        text: `${when} has already passed. Did you mean a later date?`,
        choices: [
          {
            id: "choice-next-day",
            label: `${tomorrow} (next day)`,
            value: `${calendarPhrase(tomorrow)}${timeSuffix}`,
          },
          {
            id: "choice-keep-past",
            label: `Keep ${draft.time.localDate}`,
            value: `${calendarPhrase(draft.time.localDate)}${timeSuffix}`,
          },
        ],
        inputPlaceholder: "e.g. tomorrow at 2pm, or 25 September…",
      };
      return ask(
        pastQ,
        "resolved instant is in the past and was not asked for",
      );
    }

    // Every frozen gate is happy. Now — and ONLY now — check what the HOST
    // says a complete event needs. This can add a question; it can never
    // remove one, so the session only ever gets stricter here.
    const missing = requirementQuestion(
      draft,
      ctx,
      input.skipped,
      input.keptTitle,
    );
    if (missing) {
      return ask(missing, `${route.reason} - but ${missing.slot} is missing`);
    }

    return {
      ...base,
      status: "ready",
      draft,
      question: null,
      reason: route.reason,
    };
  }

  // A REJECT ends the conversation, with one narrow exception: gate 3 refused
  // an utterance that names something out of the caller's own catalog.
  const softened =
    route.route === "REJECT" ? catalogSoftening(route, draft, ctx) : null;

  if (route.route === "REJECT" && !softened) {
    return {
      ...base,
      status: "declined",
      draft: null,
      question: null,
      reason: route.reason,
    };
  }

  // `softened` reaches this point only for gate3_no_anchor, where what is
  // missing is a time — the same thing gate 3b asks for on the resource-only
  // path, and answering it puts a real anchor in the text so the frozen gate
  // passes on its own merits next turn.
  const reqQuestion = requirementQuestion(
    draft,
    ctx,
    input.skipped,
    input.keptTitle,
  );
  const question: SessionQuestion | null = softened
    ? (reqQuestion ?? {
        slot: "when",
        gate: softened.gate,
        source: "gate",
        skippable: false,
        text: `When would you like ${subjectOf(draft)}?`,
        choices: WHEN_CHOICES,
      })
    : buildQuestion(route, draft);

  if (!question) {
    return {
      ...base,
      status: "declined",
      draft,
      question: null,
      reason: `${route.reason} - and no follow-up question can resolve it`,
    };
  }

  return ask(
    question,
    softened ? softened.note : route.reason,
    softened ? { softened } : {},
  );
}

// ── public API ────────────────────────────────────────────────────────────

function normalizeConversationalLead(text: string): string {
  let s = text.trim();
  s = s.replace(
    /^(?:i\s+|we\s+|please\s+)?(?:need|want|would like|looking)\s+to\s+/i,
    "",
  );
  return s;
}

/**
 * Start a conversation from a user's first utterance.
 *
 * Replaces direct `routeQuery` calls in interactive hosts. Non-interactive
 * callers (batch scripts, parity suites) should continue calling `routeQuery`
 * directly.
 */
export function beginSession(
  rawText: string,
  ctx: SessionContext,
): SessionState {
  const normalized = normalizeConversationalLead(rawText);
  const fixed = correct(normalized.trim(), ctx);
  return evaluate(
    {
      text: fixed.text,
      // The corrected form, because that is what every later turn is appended
      // to and what the user is shown. `corrections` records what was changed.
      utterances: [fixed.text],
      answers: [],
      satisfied: [],
      rounds: 0,
      totalRounds: 0,
      skipped: [],
      corrections: fixed.corrections,
    },
    ctx,
  );
}

/**
 * The sentinel a UI sends when the user declines a skippable question.
 *
 * A literal string rather than a separate function so a "Skip" chip is just
 * another `SessionChoice` and travels the same path as every other answer.
 */
export const SKIP_ANSWER = "__skip__";

/**
 * The two answers the escape question accepts.
 *
 * Sentinels rather than prose so they cannot collide with something a user
 * might genuinely type — the previous version compared against the literal
 * `"start over"`, which a user could have meant as an instruction rather than
 * a button press.
 */
export const ESCAPE_START_OVER = "__start_over__";
export const ESCAPE_SKIP_PREFIX = "__skip_continue__:";

/** Answers the Edit field-picker accepts. Sentinels, for the same reason. */
export const EDIT_CANCEL = "__edit_cancel__";
export const EDIT_PREFIX = "__edit__:";

/**
 * "What would you like to change?" — offered only for fields the card shows.
 *
 * Built here rather than in the controller so the choices and the handler that
 * consumes them stay in one file. Offering a field the draft does not have
 * would park the session on a question about nothing.
 */
export function editFieldQuestion(draft: SessionDraft): SessionQuestion {
  const choices: SessionChoice[] = [];
  if (draft.time) {
    choices.push({
      id: "edit-when",
      label: "Time",
      value: `${EDIT_PREFIX}when`,
    });
    if (draft.intent !== "delete_event") {
      choices.push({
        id: "edit-duration",
        label: "Length",
        value: `${EDIT_PREFIX}duration`,
      });
    }
  }
  choices.push({
    id: "edit-resource",
    label: "Room or person",
    value: `${EDIT_PREFIX}resource`,
  });
  if (draft.intent !== "delete_event") {
    choices.push({
      id: "edit-title",
      label: "Name",
      value: `${EDIT_PREFIX}title`,
    });
  }
  choices.push({
    id: "edit-cancel",
    label: "Never mind",
    value: EDIT_CANCEL,
  });

  return {
    slot: "edit",
    gate: null,
    source: "requirement",
    skippable: false,
    text: "What would you like to change?",
    choices,
  };
}

/**
 * Which field a typed edit is about, decided by what the text demonstrably is.
 *
 * Order matters: a time phrase is checked before the catalog, because a room
 * called "3pm" would be a stranger thing than a user typing a time. Anything
 * with no time and no known name is a name for the event — the only remaining
 * field a free phrase can be.
 */
function inferEditSlot(text: string, ctx: SessionContext): RequiredSlot {
  const span = parseTimeSpan(text);
  if (span && (span.date || span.clock || span.offsetMinutes !== undefined)) {
    return "when";
  }
  if (span?.durationMinutes !== undefined) return "duration";

  const lowered = text.toLowerCase();
  const catalog = [
    ...(ctx.catalog?.resources ?? []),
    ...(ctx.catalog?.participants ?? []),
  ];
  const named = catalog.some(
    (e) =>
      lowered.includes(e.name.toLowerCase()) ||
      (e.aliases ?? []).some((a) => lowered.includes(a.toLowerCase())),
  );
  return named ? "resource" : "title";
}

/**
 * The question to park on once the user has said WHICH field they are changing.
 *
 * Each one carries a `replaceSpan` covering the value already on the card, so
 * the answer goes OVER it. That is the whole point: without it the handlers
 * append, and appending leaves the old value in the utterance where extraction
 * finds it again — first-mention-wins then keeps the ORIGINAL, so the edit
 * silently does nothing.
 *
 * `when` needs no span here: its handler already replaces the date/clock
 * mentions surgically, and it is the only one that has to preserve a duration
 * sitting inside the range it rewrites.
 */
function editQuestion(
  slot: RequiredSlot,
  draft: SessionDraft,
  ctx: SessionContext,
): SessionQuestion | null {
  const base = {
    gate: null,
    source: "requirement" as const,
    // Not skippable: the user asked to change this. Offering "Skip" here would
    // mean "change nothing", which is what Never mind already does.
    skippable: false,
  };

  switch (slot) {
    case "when":
      return {
        ...base,
        slot: "when",
        text: `What time should ${subjectOf(draft)} be instead?`,
        choices: TIME_OF_DAY_CHOICES,
        inputPlaceholder: "e.g. 5pm, tomorrow at 10am…",
        replaceSpan: draft.timeSpan,
      };

    case "duration":
      return {
        ...base,
        slot: "duration",
        text: "How long should it be instead?",
        choices: DURATION_CHOICES,
        inputPlaceholder: "e.g. 45 mins, or until 6:30 PM…",
        replaceSpan: draft.timeSpan,
      };

    case "resource": {
      const choices = resourceChoices(ctx);
      if (choices.length === 0) return null;
      const named = [...draft.resources, ...draft.participants];
      return {
        ...base,
        slot: "resource",
        text: "Which room or person instead?",
        choices,
        searchable: choices.length > 5,
        // Every claimed name, EACH as its own span. One range from the first
        // to the last would also cover the time phrase between them.
        replaceSpans:
          named.length > 0
            ? named.map((r) => ({ text: r.text, start: r.start, end: r.end }))
            : undefined,
      };
    }

    case "title":
      return {
        ...base,
        slot: "title",
        text: "What should I call it instead?",
        choices: [],
        inputPlaceholder: "e.g. Standup",
        replaceSpan: draft.titleSpan,
      };
  }
}

/** The chip a UI should render for a skippable question. */
export const SKIP_CHOICE: SessionChoice = {
  id: "skip",
  label: "Skip",
  value: SKIP_ANSWER,
};

/**
 * The sentinel for “none of these — let me type it”.
 *
 * Offered instead of Skip on any question that has concrete options. A bare
 * Skip asked the user to give up without telling them what giving up costs;
 * an explicit list plus an escape into free text lets them answer either way
 * and keeps the question honest.
 */
export const OTHER_ANSWER = "__other__";

/**
 * Slots whose chips are a SAMPLE rather than the whole set of valid answers.
 *
 * Only these get an “Other…” escape. A resource question already lists every
 * room and person the host has, so “Other…” there would offer something that
 * does not exist.
 */
const OPEN_ENDED_SLOTS: ReadonlySet<SlotName> = new Set(["when", "duration"]);

/** The chip a UI renders after the real options. */
export const OTHER_CHOICE: SessionChoice = {
  id: "other",
  label: "Other…",
  value: OTHER_ANSWER,
};

/**
 * Feed the user's answer to `state.question` back in.
 *
 * `answer` is either a `SessionChoice.value` or free text — they take the same
 * path, so a tappable chip and a typed reply behave identically.
 *
 * Calling this on a state that is not `awaiting` returns the state unchanged.
 * That is deliberate: a double-tap on a chip, or a late answer to a question
 * that has already been superseded, must not restart the machine.
 */
export function provideAnswer(
  state: SessionState,
  answer: string,
  ctx: SessionContext,
): SessionState {
  if (state.status !== "awaiting" || state.question === null) return state;

  const question = state.question;
  const rounds = state.rounds + 1;
  // Monotonic, and threaded through EVERY path out of this function — a single
  // branch that forgot to carry it would silently disable the backstop while
  // leaving it looking implemented.
  const totalRounds = state.totalRounds + 1;

  // Answers get the same treatment as the opening utterance — a typo in
  // "tommorow morning" would otherwise fail to parse as a time and be appended
  // whole, re-triggering the very question being answered.
  const fixedAnswer = correct(answer.trim(), ctx);
  const trimmed = fixedAnswer.text;
  const corrections = [...state.corrections, ...fixedAnswer.corrections];

  const record = (merged?: string, skipped?: boolean): SessionAnswer[] => [
    ...state.answers,
    {
      slot: question.slot,
      gate: question.gate,
      source: question.source,
      answer: trimmed,
      merged,
      ...(skipped ? { skipped: true } : {}),
    },
  ];

  /** Common shape for the next turn — `lastSlot` is what resets the cap. */
  const next = (over: Partial<EvaluateInput> = {}): SessionState =>
    evaluate(
      {
        ...state,
        answers: record(),
        rounds,
        totalRounds,
        corrections,
        lastSlot: question.slot,
        ...over,
      },
      ctx,
    );

  // Declining a host requirement. Never offered for a gate, so this cannot be
  // used to walk past the classifier — `skippable` is false on every gate
  // question, and a skip on one is treated as an ordinary unparseable answer.
  // “Other…” is not an answer, it is a request to type one. Re-ask the same
  // slot with the list withdrawn, and do NOT spend a round: the user is
  // engaging with the question, not failing to answer it.
  if (trimmed === OTHER_ANSWER) {
    return {
      ...state,
      answers: record(),
      corrections,
      status: "awaiting",
      question: {
        ...question,
        choices: [],
        text: otherPrompt(question.slot),
      },
      reason: "waiting for a typed answer",
    };
  }

  if (trimmed === SKIP_ANSWER) {
    if (!question.skippable) return next();
    return evaluate(
      {
        ...state,
        answers: record(undefined, true),
        rounds,
        totalRounds,
        corrections,
        lastSlot: question.slot,
        skipped: [...state.skipped, question.slot],
      },
      ctx,
    );
  }

  // An empty answer resolves nothing. Re-ask, which also spends a round, so a
  // user mashing send cannot hold the session open forever.
  if (trimmed.length === 0) return next({ unresolved: question.slot });

  switch (question.slot) {
    /**
     * The way out of a conversation that has stopped converging.
     *
     * A CLOSED choice: skip the slot we are stuck on, or start over. Anything
     * else ends the session rather than re-asking — by the time this question
     * is on screen the round cap has already proved that more questions are
     * not working, so looping here would recreate the exact bug the escape
     * exists to fix. Guessing that free text answers the original question
     * would also be a guess, which this layer does not do.
     */
    case "escape": {
      if (trimmed.startsWith(ESCAPE_SKIP_PREFIX)) {
        const stuckOn = trimmed.slice(ESCAPE_SKIP_PREFIX.length) as SlotName;
        return evaluate(
          {
            ...state,
            answers: record(undefined, true),
            rounds: 0,
            totalRounds,
            // The user has cleared the blockage themselves; the slots still to
            // come are new territory and get a fresh budget.
            capBaseline: totalRounds,
            corrections,
            // The slot we were stuck on, not "escape" — `rounds` is about the
            // question being answered, and that one is now retired.
            lastSlot: stuckOn,
            skipped: [...state.skipped, stuckOn],
          },
          ctx,
        );
      }

      return {
        ...state,
        answers: record(),
        rounds,
        totalRounds,
        corrections,
        status: "declined",
        roundCapReached: true,
        question: null,
        reason:
          trimmed === ESCAPE_START_OVER
            ? "you chose to start over"
            : "we could not get there - starting over will be quicker",
      };
    }

    case "confirm": {
      if (NEGATIVE_RE.test(trimmed)) {
        return {
          ...state,
          answers: record(),
          rounds,
          status: "declined",
          question: null,
          reason: "you asked me not to - nothing was changed",
        };
      }
      if (!AFFIRMATIVE_RE.test(trimmed)) {
        // Not a yes and not a no. Re-ask rather than guess: this gate exists
        // precisely so an ambiguous instruction is not acted on.
        return next({ unresolved: "confirm" });
      }
      return next({ satisfied: [...state.satisfied, "negation"] });
    }

    /**
     * The field picker behind Edit.
     *
     * A closed choice, like `escape`: the answer names which field is being
     * changed, and the session then parks on that field's own question so the
     * reply reaches the handler that knows how to replace it. Free text here
     * is not guessed at — "5pm" could be a time or a title, and guessing wrong
     * is how the old dummy-slot version silently did nothing.
     */
    case "edit": {
      if (trimmed === EDIT_CANCEL || NEGATIVE_RE.test(trimmed)) {
        return {
          ...state,
          answers: record(),
          status: "ready",
          question: null,
          reason: "nothing changed",
        };
      }

      if (trimmed.startsWith(EDIT_PREFIX) && state.draft) {
        const slot = trimmed.slice(EDIT_PREFIX.length) as RequiredSlot;
        const question = editQuestion(slot, state.draft, ctx);
        if (question) {
          return {
            ...state,
            answers: record(),
            corrections,
            // A fresh topic: the per-slot cap counts asks of ONE question, and
            // this is the first ask of this one.
            rounds: 0,
            totalRounds,
            status: "awaiting",
            question,
            reason: `editing ${slot}`,
          };
        }
      }

      /**
       * Typed instead of tapped. Pressing Edit and typing "5pm" is what people
       * actually do, and refusing it would make the button worse than the tap
       * it replaced.
       *
       * This is not the kind of guess the layer avoids. The field is chosen
       * from what the text demonstrably IS — a parseable time is a time, a
       * catalog name is a resource — and it is then handed to that field's own
       * handler, which replaces rather than appends. Nothing is committed
       * without the card being shown again.
       */
      if (state.draft) {
        const inferred = editQuestion(
          inferEditSlot(trimmed, ctx),
          state.draft,
          ctx,
        );
        if (inferred) {
          return provideAnswer({ ...state, question: inferred }, answer, ctx);
        }
      }

      return next({ unresolved: "edit" });
    }

    case "intent": {
      const chosen = question.choices.find(
        (c) =>
          c.value === trimmed ||
          c.label.toLowerCase() === trimmed.toLowerCase(),
      );
      if (!chosen) return next({ unresolved: "intent" });
      return next({
        satisfied: [...state.satisfied, "gate4_margin"],
        intentChoice: chosen.value as Intent,
      });
    }

    case "duration": {
      // User may provide a duration phrase ("for 45 mins", "1 hour", "30 minutes")
      // OR a clock/end-time phrase ("until 6:30pm", "to 7pm", "till 8:00").
      const span = parseTimeSpan(trimmed);
      let addition: string;
      if (span && span.durationMinutes !== undefined) {
        addition = `for ${span.durationMinutes} minutes`;
      } else if (span && span.clock && state.draft?.time) {
        const [sh, sm] = state.draft.time.localTime.split(":").map(Number);
        const startTotal = sh * 60 + sm;
        const endTotal = span.clock.hour * 60 + span.clock.minute;

        if (endTotal > startTotal) {
          addition = `for ${endTotal - startTotal} minutes`;
        } else if (endTotal < startTotal && OVERNIGHT_CUE_RE.test(trimmed)) {
          // "starts 10pm, until 2am" — a deliberate overnight booking. The
          // day-roll is only safe with an explicit cue: applied to any earlier
          // clock it turned "9am" into an 18-hour event.
          addition = `for ${endTotal + 24 * 60 - startTotal} minutes`;
        } else {
          // An end at or before the start is a contradiction, not a booking.
          // This branch used to roll a full day unconditionally, so a clock
          // equal to the start became a 24-HOUR event — and it fired on any
          // clock at all, cue or not. Re-typing "book Room A tomorrow at 3pm"
          // as the answer produced "for 1440 minutes" and reported success.
          return next({ unresolved: "duration" });
        }
      } else {
        // No second regex here on purpose. This used to carry its own, looser
        // duration pattern (`\s*` where `datetime.ts` had `\s+`), which meant
        // "45mins" was accepted as an answer, appended to the utterance, and
        // then never parsed back out — leaving `assumed.duration` true and
        // re-asking the same question until the round cap. `parseTimeSpan` is
        // the single source of truth for what counts as a duration.
        return next({ unresolved: "duration" });
      }

      // Replace a length already stated rather than adding a second one —
      // extraction is first-mention-wins, so an appended "for 30 minutes" lost
      // to the "for 1 hour" already in the sentence and the edit did nothing.
      // On the normal path there is no existing mention and this appends.
      const existingDuration = state.draft?.timeSpan?.mentions.find(
        (m) => m.kind === "duration",
      );
      const merged = existingDuration
        ? spliceSpan(state.text, existingDuration, addition)
        : `${state.text} ${addition}`.trim();

      return next({
        text: merged,
        utterances: [...state.utterances, addition],
        answers: record(addition),
      });
    }

    case "resource": {
      // "Use “Room A” as the event name" — the name really was the title after
      // all. Record the decision so the same question is not asked again on the
      // next turn, and leave the utterance exactly as the user wrote it.
      if (trimmed === KEEP_TITLE_ANSWER) {
        return next({ keptTitle: true, answers: record() });
      }

      const catalog = [
        ...(ctx.catalog?.resources ?? []),
        ...(ctx.catalog?.participants ?? []),
      ];

      const matchedEntries: CatalogEntry[] = [];
      const trimmedLower = trimmed.toLowerCase();

      for (const entry of catalog) {
        const nameLower = entry.name.toLowerCase();
        if (
          trimmedLower.includes(nameLower) ||
          (entry.aliases ?? []).some((a) =>
            trimmedLower.includes(a.toLowerCase()),
          )
        ) {
          if (!matchedEntries.some((e) => e.id === entry.id)) {
            matchedEntries.push(entry);
          }
        }
      }

      let addition: string;
      if (matchedEntries.length > 0) {
        const rooms = matchedEntries
          .filter((e) => e.type !== "person")
          .map((e) => e.name);
        const people = matchedEntries
          .filter((e) => e.type === "person")
          .map((e) => e.name);
        const parts: string[] = [];
        if (rooms.length > 0) parts.push(`in ${rooms.join(" and ")}`);
        if (people.length > 0) parts.push(`with ${people.join(" and ")}`);
        addition = parts.join(" ");
      } else {
        const entry = catalog.find(
          (e) =>
            e.name.toLowerCase() === trimmed.toLowerCase() ||
            (e.aliases ?? []).some(
              (a) => a.toLowerCase() === trimmed.toLowerCase(),
            ),
        );
        const preposition = entry?.type === "person" ? "with" : "in";
        addition = `${preposition} ${entry?.name ?? trimmed}`;
      }

      // When the question carries a `replaceSpan`, the user is correcting a
      // name they already gave rather than filling an empty slot, so the
      // answer goes OVER that span. Appending would leave "Room A" in the text
      // and it would come straight back as the title.
      const merged = question.replaceSpans
        ? spliceSpans(state.text, question.replaceSpans, addition)
        : question.replaceSpan
          ? spliceSpan(state.text, question.replaceSpan, addition)
          : `${state.text} ${addition}`.trim();

      return next({
        text: merged,
        utterances: [...state.utterances, addition],
        answers: record(addition),
      });
    }

    case "title": {
      // Appended verbatim — there is no sub-phrase to extract from a name, and
      // whatever the user typed IS the title. Re-extraction picks it up on the
      // next turn along with everything else.
      //
      // Unless the question carries a `replaceSpan`, which means the user is
      // changing a name they already gave. Appending then produced
      // "called standup planning" — both names, joined.
      const appended = `${state.text} ${trimmed}`.trim();
      const merged = question.replaceSpan
        ? spliceSpan(state.text, question.replaceSpan, trimmed)
        : appended;

      const spliced = next({
        text: merged,
        utterances: [...state.utterances, trimmed],
        answers: record(trimmed),
      });

      /**
       * An edit may never leave the user worse off than before it.
       *
       * Replacing a title removes words the user wrote, and those can be
       * load-bearing for the CLASSIFIER even when they are not part of the
       * name. “set a meeting today at 10am” had a title spanning the verb, so
       * renaming it deleted “set”, the sentence lost its only verb, and a
       * finished booking became “I didn't quite follow that”.
       *
       * That cause is fixed — verb heads are recognised now — but the SHAPE
       * can recur for any span carrying more than the name. Falling back to an
       * append keeps the old words and the new ones, which classifies at least
       * as well as the text that was already `ready`.
       */
      if (question.replaceSpan && spliced.status === "declined") {
        return next({
          text: appended,
          utterances: [...state.utterances, trimmed],
          answers: record(trimmed),
        });
      }

      return spliced;
    }

    case "when": {
      // Merge only the TIME PHRASE out of the answer, not the whole reply.
      // "make it next Tuesday at 2" would otherwise append five words of filler
      // to the utterance and shift the classification; appending
      // "next Tuesday at 2" keeps the merged sentence well formed and keeps the
      // intent the user already established.
      const span = parseTimeSpan(trimmed);
      if (!span) {
        return next({ unresolved: "when" });
      }
      const addition = trimmed.slice(span.start, span.end);
      let merged: string;

      const hasOnlyClock = span.clock && !span.date;
      const draftHasDate = state.draft?.time && !state.draft.time.assumed.date;

      /**
       * Replace the WHEN, and only the when.
       *
       * `timeSpan` covers every time mention in the sentence, durations
       * included — so replacing the whole span wiped a length the user had
       * already given. "book ICU Bay 9 for 30 minutes" answered with
       * "tomorrow" became "book ICU Bay 9 for tomorrow", and the event was
       * silently created at the 60-minute default.
       *
       * A duration is not an answer to "when?", so it survives: mentions
       * caught inside the replaced range are carried across, and a span made
       * of nothing but a duration is not replaced at all.
       */
      const whenMentions = (state.draft?.timeSpan?.mentions ?? []).filter(
        (m) => m.kind !== "duration",
      );

      /**
       * A clock-only answer keeps the date the user already gave — but it must
       * REPLACE a clock they already gave, not sit next to it.
       *
       * Appending was right for "book Room A tomorrow" → "3pm", where there is
       * no clock yet. On a draft that already says 3pm it appended a second
       * one, and extraction is first-mention-wins, so the ORIGINAL survived:
       * pressing Edit and typing "5pm" changed nothing at all.
       */
      const existingClock = state.draft?.timeSpan?.mentions.find(
        (m) =>
          m.kind === "clock" ||
          m.kind === "clockRange" ||
          m.kind === "noon" ||
          m.kind === "midnight",
      );

      if (hasOnlyClock && draftHasDate) {
        merged = existingClock
          ? spliceSpan(state.text, existingClock, addition)
          : `${state.text} ${addition}`.trim();
      } else if (state.draft?.timeSpan && whenMentions.length > 0) {
        const from = Math.min(...whenMentions.map((m) => m.start));
        const to = Math.max(...whenMentions.map((m) => m.end));
        const rescued = state.draft.timeSpan.mentions
          .filter(
            (m) => m.kind === "duration" && m.start >= from && m.end <= to,
          )
          .map((m) => ` for ${m.text}`)
          .join("");

        merged =
          `${state.text.slice(0, from)} ${addition}${rescued} ${state.text.slice(to)}`
            .replace(/\s+/g, " ")
            .trim();
      } else {
        merged = `${state.text} ${addition}`.trim();
      }

      return next({
        text: merged,
        utterances: [...state.utterances, addition],
        answers: record(addition),
      });
    }
  }
}

/** What to say once the user has asked to type their own answer. */
function otherPrompt(slot: SlotName): string {
  switch (slot) {
    case "when":
      return "Go ahead — when should it be?";
    case "duration":
      return "Go ahead — how long, or when should it end?";
    case "resource":
      return "Go ahead — which room or person?";
    case "title":
      return "Go ahead — what should I call it?";
    default:
      return "Go ahead — type your answer.";
  }
}

/**
 * Convenience for a UI: has the user been asked this exact slot already?
 *
 * Lets a caller render "I still need a time" differently the second time
 * without reaching into `answers`.
 */
export function hasAnswered(state: SessionState, slot: SlotName): boolean {
  return state.answers.some((a) => a.slot === slot);
}
