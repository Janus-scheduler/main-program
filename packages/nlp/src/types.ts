/**
 * Public types for @janus-scheduler/nlp.
 *
 * These describe the frozen classifier's inputs and outputs. Nothing here
 * imports from @janus-scheduler/core — the package stays standalone by design.
 */

import type { SpellingCorrection } from "./spelling";

export type { SpellingCorrection, SpellingResult } from "./spelling";

/** The closed intent set. `none` means "not a scheduling utterance". */
export type Intent =
  | "add_event"
  | "delete_event"
  | "modify_event"
  | "get_details"
  | "none";

/** What the caller should do with the utterance. */
export type Route = "PROCEED" | "CLARIFY" | "REJECT";

/**
 * Which gate fired, or `null` when none did (i.e. `PROCEED`).
 * See ALGORITHM.md §8 for the fixed evaluation order.
 */
export type Gate =
  | "negation"
  | "gate1_confidence"
  | "gate2_nearest_none"
  | "gate3_no_anchor"
  | "gate3b_resource_only"
  | "gate4_margin"
  | "gate5_missing_slot"
  | null;

/** Pooling strategy recorded in `vocab.json`. */
export type Pooling = "zipf" | "mean";

/** Decoded `vocab.json` + `vectors.bin`, ready for embedding. */
export interface Artifacts {
  /** Vocabulary in id order. */
  tokens: string[];
  /** `token -> id`, built once at parse time. */
  tokenToId: Map<string, number>;
  /** Per-row int8 dequantization scale, indexed by token id. */
  scales: number[];
  /** Zipf/SIF pooling weight, indexed by token id. */
  weights: number[];
  /** Embedding dimensionality. */
  dim: number;
  /** Token id emitted for out-of-vocabulary words. */
  unkId: number;
  pooling: Pooling;
  /** Flat int8 embedding table, `tokens.length * dim` entries. */
  table: Int8Array;
}

/** One labelled example, embedded at build time in both views. */
export interface Prototype {
  intent: Intent;
  text: string;
  /** `embed(stripSlots(text))` */
  vecFull: Float32Array;
  /** `embed(headVerbPhraseLexicon(text))` */
  vecVerb: Float32Array;
}

/** One top-K neighbour, with its blended similarity. */
export interface Neighbour {
  intent: Intent;
  text: string;
  sim: number;
}

/** Output of `embedText()` — the intermediate values parity is asserted on. */
export interface EmbedResult {
  normalized: string;
  ids: number[];
  vec: Float32Array;
}

/** Output of `classifyVectorDual()`. */
export interface ScoreResult {
  intent: Intent;
  confidence: number;
  margin: number;
  neighbours: Neighbour[];
}

/** Output of `classify()` — scoring plus both embedding views, for debugging. */
export interface ClassifyResult extends ScoreResult {
  normalizedFull: string;
  idsFull: number[];
  normalizedVerb: string;
  idsVerb: number[];
}

/** Output of `routeQuery()` — a classification plus the routing decision. */
export interface RouteResult extends ClassifyResult {
  route: Route;
  gate: Gate;
  /** Human-readable justification, safe to surface in a UI. */
  reason: string;
}

/**
 * Raw artifact bytes, as handed to the PURE `parseArtifacts()`.
 *
 * Deliberately not a file path: the root entry never touches the filesystem.
 * Callers in Node use `@janus-scheduler/nlp/node`; callers in a browser fetch
 * the files themselves and pass the buffers in.
 */
export interface ArtifactBuffers {
  /** Contents of `vocab.json` — UTF-8 text or its bytes. */
  vocab: string | Uint8Array | ArrayBuffer;
  /** Contents of `vectors.bin` — raw int8 rows. */
  vectors: Uint8Array | Int8Array | ArrayBuffer;
}

// ══════════════════════════════════════════════════════════════════════════
//  Entity extraction and time resolution.
//
//  Everything below describes NEW, additive behaviour. It is not part of the
//  frozen pipeline and never influences a routing decision — see the banner in
//  `datetime.ts`.
// ══════════════════════════════════════════════════════════════════════════

/** A span of the input text, as character offsets. */
export interface TextSpan {
  /** The matched surface text, exactly as the user typed it. */
  text: string;
  /** Inclusive start offset into the original string. */
  start: number;
  /** Exclusive end offset. */
  end: number;
}

export type PartOfDay = "morning" | "afternoon" | "evening" | "night";

/** A time of day on a 24-hour clock. */
export interface ClockTime {
  hour: number;
  minute: number;
}

/** Which calendar day a phrase points at, before it is resolved. */
export type DateAnchor =
  | { kind: "today" }
  | { kind: "tomorrow" }
  | { kind: "yesterday" }
  /** A bare weekday: "friday". */
  | { kind: "weekday"; weekday: number }
  /** A qualified weekday: "next friday". */
  | {
      kind: "relativeWeekday";
      weekday: number;
      direction: "next" | "this" | "last";
    }
  /** A qualified period: "next week", "last quarter". */
  | {
      kind: "relativeUnit";
      unit: "week" | "month" | "quarter" | "year" | "sprint";
      direction: "next" | "this" | "last";
    }
  /**
   * A bare day of the month with no month named: "the 25th", "on the 3rd".
   *
   * Resolved to the NEXT occurrence of that day — this month if it has not
   * passed, otherwise next month. Distinct from `monthDate`, which knows its
   * month; before this existed, "on the 25th at 9am" silently dropped the day
   * entirely and booked whatever date the rest of the sentence defaulted to.
   */
  | { kind: "dayOfMonth"; day: number }
  /** An explicit calendar date: "August 18", "18th of August", "Aug 18, 2026". */
  | {
      kind: "monthDate";
      month: number;
      day: number;
      year?: number;
    };

/** One time phrase found in the text, with everything parsed out of it. */
export interface TimeMention extends TextSpan {
  kind:
    | "clock"
    | "clockRange"
    | "noon"
    | "midnight"
    | "today"
    | "tomorrow"
    | "yesterday"
    | "tonight"
    | "weekday"
    | "relativeWeekday"
    | "relativeUnit"
    | "monthDate"
    | "dayOfMonth"
    | "partOfDay"
    | "duration"
    /**
     * "in 2 hours" — an instant measured from now, not a length.
     *
     * Distinct from `duration` because the two are opposites that share a
     * surface form: "for 2 hours" says how long, "in 2 hours" says when. The
     * duration pattern claimed both, so "book Room A in 30 minutes" produced a
     * 30-minute event with no start time at all.
     */
    | "relativeOffset"
    /**
     * A named timezone: "EST", "New York time", "UTC".
     *
     * Matched so it can be HONOURED, and so it stops being unclaimed text.
     * Before this, "3pm EST" resolved as plain 3pm in the calendar’s zone AND
     * left "EST" to fall through and become the event’s name.
     */
    | "zone";
  clock?: ClockTime;
  endClock?: ClockTime;
  /** 0 = Sunday. */
  weekday?: number;
  direction?: "next" | "this" | "last";
  unit?: "week" | "month" | "quarter" | "year" | "sprint";
  month?: number;
  day?: number;
  year?: number;
  partOfDay?: PartOfDay;
  durationMinutes?: number;
  /** Minutes from now, for `relativeOffset`. */
  offsetMinutes?: number;
  /** IANA name for a `zone` mention; absent when the word is ambiguous. */
  zone?: string;
  /** True when the word was recognised but could mean several zones. */
  zoneAmbiguous?: boolean;
  /**
   * The hour was inferred, because the phrase named no meridiem.
   *
   * "half past two" states the minutes exactly and the half of the day not at
   * all. Resolving it means guessing, and a guess this layer makes has to be
   * disclosed rather than presented as what the user said.
   */
  meridiemAssumed?: boolean;
}

/** All the time phrases in one utterance, folded into a single intent. */
export interface TimeSpan extends TextSpan {
  /** Every contributing mention, in document order. */
  mentions: TimeMention[];
  date?: DateAnchor;
  clock?: ClockTime;
  endClock?: ClockTime;
  partOfDay?: PartOfDay;
  durationMinutes?: number;
  /** Minutes from now, when the utterance said "in 2 hours". */
  offsetMinutes?: number;
  /** The zone the user named, if any. Wall-clock times resolve in THIS. */
  zone?: string;
  /** The words they used, for the disclosure line. */
  zonePhrase?: string;
  /** They named a zone this module cannot pin down. */
  zoneAmbiguous?: boolean;
  /** `clock`'s hour was inferred — see `TimeMention.meridiemAssumed`. */
  meridiemAssumed?: boolean;
  /** The phrase that produced an inferred hour, for the disclosure line. */
  meridiemPhrase?: string;
}

/** What `resolveTime()` needs in order to turn a span into an instant. */
export interface ResolveContext {
  /** "Now", as a Date or epoch ms. Injected so tests are deterministic. */
  now: Date | number;
  /** IANA timezone the user is thinking in, e.g. "Asia/Colombo". */
  timezone: string;
}

/** A concrete interval, plus a record of everything that was assumed. */
export interface ResolvedTime {
  startISO: string;
  endISO: string;
  startMs: number;
  endMs: number;
  durationMinutes: number;
  timezone: string;
  /**
   * Human-readable notes for every value the user did NOT state — e.g. "no
   * duration given — assumed 60 minutes". The parse card must show these: it
   * is a verification surface, so invented values cannot be hidden.
   */
  assumptions: string[];
  /**
   * The same information as `assumptions`, but machine-readable.
   *
   * A UI has to know WHICH value was invented in order to mark that chip.
   * Matching on the prose above is fragile and was wrong once already:
   * `"morning" taken as 09:00` and `no time of day given — assumed 09:00` are
   * the same fact in two wordings, and a regex written for one missed the
   * other — so a 09:00 the system had chosen was rendered as if the user had
   * stated it.
   */
  assumed: {
    /** The calendar day was chosen, not stated. */
    date: boolean;
    /** The hour was chosen — either a part-of-day default or the 09:00 one. */
    timeOfDay: boolean;
    /** The length was chosen. */
    duration: boolean;
    /**
     * Only which HALF OF THE DAY was chosen — "half past two" → 14:30.
     *
     * Deliberately not `timeOfDay`. The user did state a time of day, minutes
     * and all; nothing but the meridiem was invented. Folding the two together
     * made `slotIsFilled("when")` treat the whole time as missing, so a booking
     * that had said "half past two" was asked what time it should be.
     *
     * Still an assumption, so it is still disclosed — it just does not mean
     * the question is unanswered.
     */
    meridiem: boolean;
    /**
     * A zone the user NAMED could not be pinned down, so the calendar's own
     * zone was used instead. Distinct from the other flags: the user did
     * state something, it just was not usable.
     */
    timeZone: boolean;
  };
  /** Wall-clock date in `timezone`, "YYYY-MM-DD". */
  localDate: string;
  /** Wall-clock start time in `timezone`, "HH:MM". */
  localTime: string;
  /** Weekday name of `localDate`, lowercase. */
  weekday: string;
  /** True when a 'this <weekday>' phrase resolved to a day strictly before now in the current week. */
  pastRelativeWeekday?: boolean;
  /** Candidate past date YYYY-MM-DD when pastRelativeWeekday is true. */
  pastDate?: string;
  /** Candidate upcoming date YYYY-MM-DD when pastRelativeWeekday is true. */
  upcomingDate?: string;
  /**
   * True when an explicit calendar date ("August 25th") could only be honoured
   * by rolling forward a WHOLE YEAR, and the date named is in the RECENT past.
   *
   * Rolling forward is right in general — "January 5th" said in December means
   * next January. It is almost certainly wrong five days after the fact: nobody
   * saying "August 25th" on 30 August means 2027. They have misremembered the
   * date or meant a different month, and a silent twelve-month jump hides that.
   *
   * Only set inside a bounded window (`RECENT_PAST_DAYS`); beyond it the
   * rolled-forward reading is the honest one and nothing is flagged.
   */
  staleYearRoll?: boolean;
  /** The date as literally stated, YYYY-MM-DD, when `staleYearRoll` is true. */
  statedDate?: string;
  /**
   * The resolved instant is BEFORE `now`, and nothing in the utterance asked
   * for a past date.
   *
   * Most paths already roll forward on their own — a bare clock goes to
   * tomorrow, a bare weekday to the next one, a day-of-month to its next
   * occurrence. The gap is a phrase that names a day explicitly and a time that
   * has already been and gone: "today at 9am", said at 2pm.
   *
   * Deliberately NOT set for `yesterday`, `last <weekday>` or `last week` —
   * those state a past date outright, and asking about them would be nagging.
   * Rolling them forward would be worse: it would override what the user said.
   */
  resolvedInPast?: boolean;
}

/** One entry in the caller-supplied catalog. */
export interface CatalogEntry {
  id: string;
  name: string;
  /** Extra surface forms — nicknames, short codes, room numbers. */
  aliases?: string[];
  /** Free-form, echoed back on a match. `"person"` is significant — see below. */
  type?: string;
  /**
   * May a single token of `name` match on its own — "Alex" for "Alex Rivera"?
   *
   * Defaults to `type === "person"`, which is almost always what you want.
   * Turning it on for a group or a room is usually a mistake: a team called
   * "Design Team" would then match the word "design" in "schedule a design
   * sync", inventing a participant and swallowing the title.
   */
  matchPartial?: boolean;
}

/**
 * The resources and people the HOST APPLICATION knows about.
 *
 * Supplied by the caller rather than read from a store — that is what keeps
 * this package free of any `@janus-scheduler/core` import. It is also why real
 * data works: the frozen `PARTICIPANT_NAMES` list is a 23-name research corpus
 * ("sarah", "alice", "marketing") and would make a parse card look broken
 * against a real directory.
 */
export interface EntityCatalog {
  resources?: CatalogEntry[];
  participants?: CatalogEntry[];
}

/** A catalog entry matched against a span of the input. */
export interface EntityMatch extends TextSpan {
  id: string;
  /** The catalog's canonical name, which may differ from `text`. */
  name: string;
  type?: string;
  /** `true` for a full-name/alias hit, `false` for a partial (first-name) hit. */
  exact: boolean;
}

/** Options for `extractEntities()`. */
export interface ExtractOptions extends ResolveContext {
  catalog?: EntityCatalog;
}

/** Everything `extractEntities()` could find in one utterance. */
export interface ExtractedEntities {
  /** The parsed time phrase, before resolution. */
  timeSpan?: TimeSpan;
  /** The resolved interval, or `null` when the phrase could not be resolved. */
  time: ResolvedTime | null;
  resources: EntityMatch[];
  participants: EntityMatch[];
  /**
   * What is left of the utterance once the verb, the time and every matched
   * entity are removed — the event's title. `undefined` when nothing remains.
   */
  title?: string;
  /** The span of the original utterance that became the title. */
  titleSpan?: TextSpan;
}

// ══════════════════════════════════════════════════════════════════════════
//  Dialogue manager.
//
//  Also additive. It sits ON TOP of the frozen gates rather than inside them:
//  a CLARIFY route is a question the gate wants asked, and this layer asks it,
//  merges the answer, and re-runs the same frozen routing. It never softens a
//  gate — see the banner in `session.ts`.
// ══════════════════════════════════════════════════════════════════════════

/** A gate that actually fired — `Gate` minus the `null` PROCEED case. */
export type FiredGate = Exclude<Gate, null>;

/**
 * What a clarification question is asking for.
 *
 * Two sources, and the distinction matters:
 *
 * **Gate-driven** — the frozen layer decides something is missing, this layer
 * only decides how to phrase it:
 *   `when`    ← gate5_missing_slot, gate3b_resource_only
 *   `intent`  ← gate4_margin
 *   `confirm` ← negation
 *
 * **Requirement-driven** — the HOST decides what a complete event needs, via
 * `SessionContext.requires`. These are asked only AFTER the gates are happy,
 * so they can make a session stricter but never looser:
 *   `when` · `resource` · `title`
 */
export type SlotName =
  | "when"
  | "intent"
  | "confirm"
  | "resource"
  | "title"
  | "duration"
  /**
   * The way out, offered once a conversation has provably stopped converging.
   *
   * Its own slot rather than a reused `confirm`, because the answers are
   * neither yes nor no: `confirm`'s handler tests only `AFFIRMATIVE_RE` /
   * `NEGATIVE_RE`, so "start over" matched neither and fell through to a
   * re-ask — the escape hatch's own buttons did nothing.
   */
  | "escape"
  /**
   * "What would you like to change?" — the field picker behind Edit.
   *
   * Its own slot for the same reason as `escape`. Edit used to borrow `title`
   * as a dummy slot, so everything typed after pressing it went to the title
   * handler: a time was swallowed whole (first-mention-wins kept the original),
   * and a room or a name was APPENDED rather than replacing. Editing a 3pm
   * booking to 5pm changed nothing at all.
   */
  | "edit";

/**
 * A field the host app considers mandatory before an event is worth creating.
 *
 * The frozen gates only ever require a TIME (gate 5), because that is all the
 * classifier needs to be sure of the intent. But an event with no resource
 * cannot exist — `Event.isValid()` rejects it — and one with no title is not
 * worth much. Those are PRODUCT rules, not classifier rules, so the host
 * states them rather than this package assuming them.
 *
 *   `when`     — a resolved time
 *   `resource` — at least one catalog match, person or room. Both map onto
 *                `resourceIds`, so "who" and "where" are one requirement.
 *   `title`    — a non-empty title
 *   `duration` — an explicitly stated or confirmed duration
 */
export type RequiredSlot = "when" | "resource" | "title" | "duration";

/** Per-intent completeness rules. Anything omitted is not required. */
export type SessionRequirements = Partial<Record<Intent, RequiredSlot[]>>;

/** One tappable answer. `value` is what gets fed back in, `label` is prose. */
export interface SessionChoice {
  id: string;
  label: string;
  value: string;
  kind?: "place" | "person" | "thing";
  group?: string;
}

/** A question the session is waiting on. */
export interface SessionQuestion {
  slot: SlotName;
  /** The gate that asked for it, or `null` for a host requirement. */
  gate: FiredGate | null;
  /** `"gate"` = the frozen layer asked. `"requirement"` = the host did. */
  source: "gate" | "requirement";
  /** Ready to render verbatim. */
  text: string;
  choices: SessionChoice[];
  /**
   * May the user decline to answer?
   *
   * True for host requirements: the caller said the field matters, not that it
   * is unobtainable, and forcing an answer traps someone who genuinely does
   * not care. Never true for a gate — those exist because the system does not
   * understand the utterance well enough to proceed.
   */
  skippable: boolean;
  multiselect?: boolean;
  searchable?: boolean;
  inputPlaceholder?: string;
  /**
   * Splice the answer OVER this span of the utterance instead of appending it.
   *
   * Appending is the default and is right for a slot the user never filled.
   * It is wrong whenever the user already said something in that slot and is
   * now correcting it: the accumulated text would end up holding both values,
   * and `toTimeSpan`/`extractEntities` resolve first-wins, so the correction
   * would be silently ignored (or, for two clock times, read as a range).
   */
  replaceSpan?: TextSpan;
  /**
   * Several disjoint spans to replace, when one range would be too greedy.
   *
   * A single `replaceSpan` covering the first named entity to the last also
   * covers everything BETWEEN them. “book Operating Room 1 tomorrow at 3pm
   * with Dr. Sarah Chen” put the time inside that range, so changing the room
   * silently deleted the date and time as well.
   *
   * Each span is blanked individually and the answer is inserted where the
   * first one began; anything in the gaps is left exactly where it was.
   */
  replaceSpans?: TextSpan[];
}

/** One answered question, kept so a UI can replay the conversation. */
export interface SessionAnswer {
  slot: SlotName;
  gate: FiredGate | null;
  source: "gate" | "requirement";
  /** Exactly what the user supplied. */
  answer: string;
  /** What was appended to the utterance, when the answer was merged as text. */
  merged?: string;
  /** The user declined to answer a skippable question. */
  skipped?: boolean;
}

/**
 * Everything understood so far — the parse card's data.
 *
 * Present even while the session is still `awaiting`, so a UI can show partial
 * understanding alongside the question rather than a blank panel.
 */
export interface SessionDraft {
  intent: Intent;
  title?: string;
  /**
   * Where `title` sits in the utterance.
   *
   * `extractEntities` has always computed this — the title IS a span, the one
   * left over once the verb, the time and every matched entity are blanked —
   * but it used to stop at the package boundary. It is carried here so a
   * correction can splice over the title rather than appending beside it.
   */
  titleSpan?: TextSpan;
  timeSpan?: TimeSpan;
  /** `null` until a time is known — which is exactly what gate 5 asks about. */
  time: ResolvedTime | null;
  resources: EntityMatch[];
  participants: EntityMatch[];
}

/**
 * `ready` — PROCEED. Show the parse card; nothing is committed yet.
 * `awaiting` — CLARIFY. `question` is populated.
 * `declined` — REJECT, or a conversation that ran out of road.
 */
export type SessionStatus = "ready" | "awaiting" | "declined";

/** Immutable snapshot of one conversation. */
export interface SessionState {
  status: SessionStatus;
  /** The merged utterance every decision in this state was made against. */
  text: string;
  /** Original utterance first, then each merged answer. */
  utterances: string[];
  answers: SessionAnswer[];
  /** The frozen layer's verdict on `text`. */
  route: RouteResult;
  /** `null` only when the utterance was rejected outright. */
  draft: SessionDraft | null;
  /** Populated iff `status === "awaiting"`. */
  question: SessionQuestion | null;
  /**
   * How many times the CURRENT question's slot has been asked in a row.
   *
   * Consecutive, not cumulative: the cap exists to stop the same question
   * repeating forever, so moving on to a different slot resets it. Filling
   * three empty fields is a conversation; asking "when?" three times is a loop.
   */
  rounds: number;
  /**
   * How many answers this conversation has taken in total, ever.
   *
   * Monotonic — it is never reset, by anything. `rounds` deliberately resets
   * when the topic moves on, which is right for "stop repeating yourself" but
   * means a session alternating between two slots (`when` → `resource` →
   * `when` → …) never reaches the per-slot cap on either and loops forever.
   * This is the backstop that catches that shape, and the only reason it can
   * work is that nothing is allowed to zero it.
   */
  totalRounds: number;
  /**
   * The `totalRounds` value the current budget is measured from.
   *
   * Only an explicit escape choice moves it, and only ever forward. Without
   * it, tapping "skip that and continue" would land straight back on the
   * escape prompt — the total cap is still exceeded — offering to skip a
   * question the user was never asked.
   *
   * This cannot be farmed into an endless conversation: the only thing that
   * advances it also retires a requirement slot permanently, and there are
   * finitely many of those.
   */
  capBaseline?: number;
  /**
   * The conversation hit a round cap — per-slot or total — and gave up.
   *
   * A structural marker, deliberately, because the presentation layer used to
   * identify this state by string-matching the `reason` diagnostic. That
   * coupling broke silently the moment the wording changed. `reason` is for
   * humans and logs; this is what code branches on.
   */
  roundCapReached?: boolean;
  /**
   * Requirement slots the user explicitly declined.
   *
   * They are not asked again, and the caller is expected to disclose whatever
   * it substitutes — a skipped question is still an unanswered one.
   */
  skipped: SlotName[];
  /**
   * Words this layer read as something else, across every turn.
   *
   * Must be surfaced. Silently rewriting what someone typed is a guess, and
   * this design does not hide guesses.
   */
  corrections: SpellingCorrection[];
  /**
   * Gates the user has explicitly answered. They are not re-asked — but every
   * OTHER gate still runs, so answering one cannot smuggle an utterance past
   * the rest.
   */
  satisfied: FiredGate[];
  /** Set once the user has picked between ambiguous intents. */
  intentChoice?: Intent;
  /**
   * Set when the session asked a question the FROZEN layer would have
   * rejected outright.
   *
   * There is exactly one such case, and it is deliberately narrow: gate 3
   * decides "is this about scheduling?" from a 23-name research corpus, so a
   * name out of the host's own catalog does not count. See `catalogAnchor` on
   * `SessionContext`.
   *
   * `route` is NOT rewritten when this happens — it still reports the frozen
   * verdict, so a UI or a log can always see what the gates actually said.
   */
  softened?: {
    gate: FiredGate;
    /** The catalog entry whose presence justified asking instead of refusing. */
    matched: string;
    note: string;
  };
  /** Plain-English justification, safe to show. */
  reason: string;
  /** Slots still required to fulfill the host requirements. */
  outstanding?: RequiredSlot[];
  /** Slot that was asked but the answer was unresolved/unusable. */
  unresolved?: SlotName;
  /**
   * The user was told a name they used is not in the catalog, and chose to keep
   * it as the event's title anyway.
   *
   * Without this the session would notice the same unmatched name on the next
   * turn and ask the same question again, for ever.
   */
  keptTitle?: boolean;
}

/** Everything the session needs. All injected — the module reads no globals. */
export interface SessionContext extends ResolveContext {
  artifacts: Artifacts;
  prototypes: Prototype[];
  catalog?: EntityCatalog;
  /**
   * How many times the same question may be asked before the session gives up.
   * Defaults to `MAX_CLARIFY_ROUNDS`. A conversation that cannot converge must
   * end, not loop.
   */
  maxRounds?: number;
  /**
   * May a name from `catalog` rescue an utterance from `gate3_no_anchor`?
   *
   * Gate 3 asks "is there any sign this is about scheduling?" and answers it
   * from the FROZEN 23-name research corpus — `sarah`, `team`, `room`,
   * `projector`. A real directory is not in that list, which produces a split
   * that makes no sense to a user:
   *
   *     "book Operating Room 1"   → CLARIFY   ("room" is in the corpus)
   *     "book MRI Scanner A"      → REJECT    (nothing in the corpus)
   *
   * With this on, the SECOND case asks "when?" instead of refusing — but only
   * when the text actually matches something the caller supplied, and only for
   * `gate3_no_anchor`. Every other gate, and the whole of `classify()`, is
   * untouched; `state.route` still reports the frozen verdict verbatim.
   *
   * Defaults to ON whenever a non-empty catalog is supplied, on the reasoning
   * that handing over a catalog is itself the statement "these are the things
   * my users talk about". Set `false` for strictly frozen behaviour.
   */
  catalogAnchor?: boolean;
  /**
   * What the HOST considers a complete event, per intent.
   *
   * Checked only after every frozen gate has passed, so a requirement can turn
   * a `ready` session into `awaiting` but can never turn a `declined` one into
   * `ready`. This layer gets stricter, never looser.
   *
   * Defaults to `{}` — no requirements, purely gate-driven, exactly the
   * behaviour of every earlier version. The default is empty on purpose: what
   * counts as "complete" is a product decision, and this package guessing it
   * would be the same mistake as the frozen 23-name corpus guessing who your
   * users are.
   *
   *     requires: { add_event: ["when", "resource"] }
   */
  requires?: SessionRequirements;
  /**
   * Fix misspelled time words before anything else runs?
   *
   * "schedule a meeting tommorow" otherwise has no time anchor, so gate 5 asks
   * "when?" about a sentence that plainly said when — and the unrecognised
   * word survives into the event's title as "meeting tommorow".
   *
   * The correction is applied to the raw utterance BEFORE routing and
   * extraction, so both see identical text and the gate/extractor agreement
   * holds. It is disclosed in `SessionState.corrections` and must be shown to
   * the user: reading a word as something else is exactly the kind of guess
   * this design refuses to hide.
   *
   * Defaults to `false` — strictly frozen behaviour, like `requires`. What
   * counts as a typo is a product judgement, so the host opts in.
   */
  correctSpelling?: boolean;
}
