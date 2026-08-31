/**
 * @janus-scheduler/nlp — PURE entry point.
 *
 * A frozen, zero-dependency intent classifier. Given an utterance and the
 * decoded artifacts it returns `{intent, confidence, margin, route, gate,
 * reason}` — no model, no network, no inference at runtime.
 *
 * ── Two hard rules ────────────────────────────────────────────────────────
 *
 * 1. This module and everything it imports stays free of `fs`, `fetch`, and
 *    every other I/O primitive. Artifacts are handed in by the caller as
 *    buffers and decoded through `parseArtifacts()`. The filesystem loader
 *    lives behind `@janus-scheduler/nlp/node`.
 *
 * 2. Never `import` the JSON artifacts from here. They total ~6 MB and a
 *    bundler would inline every byte into the consumer's application bundle.
 *
 * ── Usage (Node) ──────────────────────────────────────────────────────────
 *
 *     import { loadArtifacts, loadPrototypes } from "@janus-scheduler/nlp/node";
 *     import { routeQuery } from "@janus-scheduler/nlp";
 *
 *     const artifacts  = loadArtifacts();
 *     const prototypes = loadPrototypes();
 *     routeQuery("book the demo room tomorrow at 10am", artifacts, prototypes);
 *     // → { intent: "add_event", route: "PROCEED", gate: null, ... }
 *
 * ── Usage (browser) ───────────────────────────────────────────────────────
 *
 *     const [vocab, vectors, protos] = await Promise.all([
 *       fetch(vocabUrl).then(r => r.text()),
 *       fetch(vectorsUrl).then(r => r.arrayBuffer()),
 *       fetch(protoUrl).then(r => r.text()),
 *     ]);
 *     const artifacts  = parseArtifacts({ vocab, vectors });
 *     const prototypes = parsePrototypes(protos);
 *
 * ── The algorithm is FROZEN ───────────────────────────────────────────────
 *
 * `docs/ALGORITHM.md` is normative. Several decisions in here look like bugs
 * and are load-bearing — `none` scored on a different α/β blend, `margin`
 * skipping `none` even when `none` wins, `lunch` left in `EVENT_NOUNS`. Each
 * is commented at its site with the section that justifies it. The 3 known
 * false accepts are reproduced deliberately, not fixed.
 */

/** Package version, useful for pinning a parity run to a build. */
export const NLP_VERSION = "0.1.0";

// ── the pipeline, in the order data flows ─────────────────────────────────
export { normalize, escapeRe, alternation } from "./normalize";
export { wordpiece } from "./wordpiece";
export { embedText, cosine } from "./embed";
export {
  stripSlots,
  headVerbPhraseLexicon,
  TIME_RE_SOURCE,
} from "./preprocess";
export { classify } from "./classify";
export { classifySmalltalk, type SmalltalkKind } from "./smalltalk";
export {
  routeQuery,
  routeFromClassification,
  hasTimeAnchor,
  hasResourceAnchor,
  hasParticipantAnchor,
  hasEventNoun,
  hasDomainAnchor,
  hasNegation,
} from "./gates";

// ── artifact decoding (pure — buffers in, no I/O) ─────────────────────────
export { parseArtifacts, parsePrototypes } from "./artifacts";

// ── entity extraction + time resolution ───────────────────────────────────
//
// ADDITIVE, and NOT part of the frozen pipeline. The frozen classifier detects
// times and names only in order to delete them; it never reports who, what or
// when. These functions capture what it throws away, so a parse card can show
// the user what was understood before anything is committed. Nothing here runs
// inside `classify()` or any gate, and nothing here can change a routing
// decision.
export { extractEntities, leadingVerbPrefixLength } from "./entities";

// Typo tolerance for time words. OPT-IN, and it runs BEFORE the pipeline so
// the frozen gate and the extractor never see different text — see the banner
// in `spelling.ts`.
export { correctTimeWords, TIME_VOCABULARY } from "./spelling";
export {
  parseTimeSpan,
  extractTimeMentions,
  toTimeSpan,
  resolveTime,
  zonedToUtcMs,
  zonedPartsAt,
  PART_OF_DAY_HOURS,
  DEFAULT_HOUR,
  DEFAULT_DURATION_MINUTES,
} from "./datetime";

// ── dialogue manager ──────────────────────────────────────────────────────
//
// Also ADDITIVE, and layered ON TOP of the gates rather than inside them. A
// CLARIFY route is the frozen layer asking for something; this turns that into
// a question, merges the answer, and re-runs the SAME routing. Answering one
// gate never lets an utterance past the others.
export {
  beginSession,
  provideAnswer,
  hasAnswered,
  stripNegationCues,
  MAX_CLARIFY_ROUNDS,
  MAX_TOTAL_ROUNDS,
  SKIP_ANSWER,
  SKIP_CHOICE,
  ESCAPE_START_OVER,
  ESCAPE_SKIP_PREFIX,
  EDIT_CANCEL,
  EDIT_PREFIX,
  editFieldQuestion,
  KEEP_TITLE_ANSWER,
} from "./session";
export { reviseSlot } from "./revise";

// ── frozen constants, re-exported for callers that need to reason about them
export {
  TOP_K,
  ALPHA,
  BETA,
  NONE_ALPHA,
  NONE_BETA,
  CONF_FLOOR,
  MARGIN_FLOOR,
  MAX_WORD_CHARS,
  EVENT_NOUNS,
  RESOURCE_NAMES,
  PARTICIPANT_NAMES,
  INTENT_VERBS,
  TIME_PATTERNS,
  LEAD,
} from "./constants";

// ── types ─────────────────────────────────────────────────────────────────
export type {
  Intent,
  Route,
  Gate,
  Pooling,
  Artifacts,
  ArtifactBuffers,
  Prototype,
  Neighbour,
  EmbedResult,
  ScoreResult,
  ClassifyResult,
  RouteResult,
  TextSpan,
  PartOfDay,
  ClockTime,
  DateAnchor,
  TimeMention,
  TimeSpan,
  ResolveContext,
  ResolvedTime,
  CatalogEntry,
  EntityCatalog,
  EntityMatch,
  ExtractOptions,
  ExtractedEntities,
  FiredGate,
  SlotName,
  RequiredSlot,
  SessionRequirements,
  SpellingCorrection,
  SpellingResult,
  SessionChoice,
  SessionQuestion,
  SessionAnswer,
  SessionDraft,
  SessionStatus,
  SessionState,
  SessionContext,
} from "./types";

// ── presentation mapper (SessionState -> ChatMessage) ────────────────────
export {
  presentSession,
  summarise,
  formatWhen,
  formatDuration,
  getConfidenceLabel,
  getConfirmLabel,
  getEditLabel,
  draftChips,
  FALLBACK_TITLE,
  assumptionNotes,
  cardWarnings,
} from "./presentSession";
export type {
  PresentOptions,
  PresentChip,
  PresentChoice,
  PresentParseCard,
  PresentMessage,
} from "./presentSession";

// ── dialogue state controller (framework-agnostic state machine) ──────────
export { ChatController, DEFAULT_INTRO } from "./controller";
export type { JanusChatOptions, ConfirmOutcome, NlpEngine } from "./controller";

// ── the commit path ───────────────────────────────────────────────────────
//
// The ONLY thing in this package that can change a calendar, and it reaches
// one only through the `SchedulerPort` a host hands it per call. Nothing here
// is imported by `session.ts`, by any gate, or by anything frozen — see the
// banner in `commit.ts`.
export { commitSession, catalogFromResources } from "./commit";
export type {
  SchedulerPort,
  EventInput,
  StoredEvent,
  ResourceLike,
  CommitResult,
  CommitSuccess,
  CommitFailure,
} from "./commit";
