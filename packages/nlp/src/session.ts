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

import { CONF_FLOOR, MARGIN_FLOOR } from "./constants";
import { classify } from "./classify";
import { hasNegation, routeFromClassification } from "./gates";
import { parseTimeSpan } from "./datetime";
import { extractEntities } from "./entities";
import { correctTimeWords } from "./spelling";
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
  const entities = extractEntities(text, {
    catalog: ctx.catalog,
    now: ctx.now,
    timezone: ctx.timezone,
  });
  return {
    intent,
    title: entities.title,
    timeSpan: entities.timeSpan,
    time: entities.time,
    resources: entities.resources,
    participants: entities.participants,
  };
}

/** "design sync", or the room, or a neutral fallback. Never empty. */
function subjectOf(draft: SessionDraft): string {
  if (draft.title) return `“${draft.title}”`;
  if (draft.resources.length > 0) return draft.resources[0].name;
  if (draft.participants.length > 0)
    return `your time with ${draft.participants[0].name}`;
  return "New Event";
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
 * Ask for the first unmet host requirement.
 *
 * Runs only once every gate has passed, and only ever ADDS a question — it
 * cannot rescue a rejected utterance, and a test pins that.
 */
function requirementQuestion(
  draft: SessionDraft,
  ctx: SessionContext,
  skipped: SlotName[],
): SessionQuestion | null {
  const required = ctx.requires?.[draft.intent] ?? [];

  // Every requirement question carries a Skip chip. The host said the field
  // matters, not that it is unobtainable — refusing to let someone past a
  // question they cannot answer turns a helper into an obstacle.
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
    choices: [...choices, SKIP_CHOICE],
  });

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
        return asking("title", "What should I call it?", []);
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
  skipped: SlotName[];
  corrections: SpellingCorrection[];
  intentChoice?: Intent;
  /** The slot just answered, so `rounds` can reset when the topic moves on. */
  lastSlot?: SlotName;
  unresolved?: SlotName;
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

  const classified = classify(text, ctx.artifacts, ctx.prototypes);
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
    satisfied,
    skipped: input.skipped,
    corrections: input.corrections,
    intentChoice: input.intentChoice,
    unresolved: input.unresolved,
    outstanding: (ctx.requires?.[draft.intent] ?? []).filter(
      (slot) => !slotIsFilled(slot, draft),
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
    if (spent >= maxRounds) {
      if (
        draft &&
        (draft.time ||
          draft.resources.length > 0 ||
          draft.participants.length > 0)
      ) {
        return {
          ...base,
          status: "awaiting",
          draft,
          question: {
            slot: "confirm", // dummy slot to allow choice
            gate: null,
            source: "gate",
            skippable: false,
            text: "I'm still having trouble. Do you want to open the editor with what I have, or start over?",
            choices: [
              { id: "edit", label: "Open the editor", value: "edit" },
              { id: "start-over", label: "Start over", value: "start over" },
            ],
          },
          reason: `still unclear after ${spent} questions`,
        };
      }

      return {
        ...base,
        status: "declined",
        draft,
        question: null,
        reason: `still unclear after ${spent} question${spent === 1 ? "" : "s"} - starting over will be quicker`,
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
        : ` at ${draft.time.localTime}`;
      const pastQ: SessionQuestion = {
        slot: "when",
        gate: null,
        source: "gate",
        skippable: false,
        text: `Did you mean past ${weekdayCap} (${draft.time.pastDate}) or upcoming ${weekdayCap} (${draft.time.upcomingDate})?`,
        choices: [
          {
            id: "choice-upcoming",
            label: `Upcoming ${weekdayCap} (${draft.time.upcomingDate})`,
            value: `next ${draft.time.weekday}${timeSuffix}`,
          },
          {
            id: "choice-past",
            label: `Past ${weekdayCap} (${draft.time.pastDate})`,
            value: `last ${draft.time.weekday}${timeSuffix}`,
          },
        ],
      };
      return ask(
        pastQ,
        "ambiguous whether 'this' weekday refers to past or upcoming day",
      );
    }

    // Every frozen gate is happy. Now — and ONLY now — check what the HOST
    // says a complete event needs. This can add a question; it can never
    // remove one, so the session only ever gets stricter here.
    const missing = requirementQuestion(draft, ctx, input.skipped);
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
  const reqQuestion = requirementQuestion(draft, ctx, input.skipped);
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

/** The chip a UI should render for a skippable question. */
export const SKIP_CHOICE: SessionChoice = {
  id: "skip",
  label: "Skip",
  value: SKIP_ANSWER,
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
        corrections,
        lastSlot: question.slot,
        ...over,
      },
      ctx,
    );

  // Declining a host requirement. Never offered for a gate, so this cannot be
  // used to walk past the classifier — `skippable` is false on every gate
  // question, and a skip on one is treated as an ordinary unparseable answer.
  if (trimmed === SKIP_ANSWER) {
    if (!question.skippable) return next();
    return evaluate(
      {
        ...state,
        answers: record(undefined, true),
        rounds,
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
        let endTotal = span.clock.hour * 60 + span.clock.minute;
        if (endTotal <= startTotal) endTotal += 24 * 60;
        addition = `for ${endTotal - startTotal} minutes`;
      } else {
        const durMatch = trimmed.match(
          /\b(\d+(?:\.\d+)?)\s*(?:mins?|minutes?|hrs?|hours?)\b/i,
        );
        if (durMatch) {
          addition = `for ${trimmed}`;
        } else {
          return next({ unresolved: "duration" });
        }
      }

      const merged = `${state.text} ${addition}`.trim();
      return next({
        text: merged,
        utterances: [...state.utterances, addition],
        answers: record(addition),
      });
    }

    case "resource": {
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

      const merged = `${state.text} ${addition}`.trim();

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
      const merged = `${state.text} ${trimmed}`.trim();
      return next({
        text: merged,
        utterances: [...state.utterances, trimmed],
        answers: record(trimmed),
      });
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

      if (hasOnlyClock && draftHasDate) {
        merged = `${state.text} ${addition}`.trim();
      } else if (state.draft?.timeSpan) {
        const s = state.draft.timeSpan;
        merged =
          `${state.text.slice(0, s.start)} ${addition} ${state.text.slice(s.end)}`
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

/**
 * Convenience for a UI: has the user been asked this exact slot already?
 *
 * Lets a caller render "I still need a time" differently the second time
 * without reaching into `answers`.
 */
export function hasAnswered(state: SessionState, slot: SlotName): boolean {
  return state.answers.some((a) => a.slot === slot);
}
