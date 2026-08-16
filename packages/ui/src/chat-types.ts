/**
 * View-model types for `<janus-chat>`.
 *
 * These describe what the component RENDERS, not what the NLP layer produces.
 * The separation is deliberate: the component takes plain data and knows
 * nothing about intents, gates or confidence floors, so it can be driven from
 * static fixtures (Step 4), from a live classifier (Step 6), or from a test.
 *
 * Mapping from `@janus-scheduler/nlp`'s `RouteResult` + `ExtractedEntities`
 * onto these shapes happens in the dialogue manager, not here.
 */

/** Which side of the conversation a message came from. */
export type ChatRole = "user" | "assistant";

/**
 * The chip colours in the design are semantic, not decorative — a reader scans
 * for "who / when / where" by hue. Keep the mapping stable:
 *   person → AI violet · time → info blue · place → primary orange
 *   thing  → neutral surface (equipment, and anything uncategorised)
 */
export type ChatChipKind = "person" | "time" | "place" | "thing";

/** One entity chip on a parse card. */
export interface ChatChip {
  kind: ChatChipKind;
  label: string;
  /**
   * `true` when the value was inferred rather than stated by the user (a
   * defaulted duration, an assumed 09:00). Rendered with a dashed border so
   * the user can see what to check before confirming.
   */
  assumed?: boolean;
}

/** A before → after pair, for a reschedule. */
export interface ChatChange {
  /** e.g. "3:00 PM" — rendered struck through. */
  from: string;
  /** e.g. "4:30 PM" */
  to: string;
}

/** The "here's what I understood" card the user confirms or edits. */
export interface ChatParseCard {
  /** Lead-in line. Defaults to "Here's what I understood:". */
  lead?: string;
  /** Event title, emphasised inside the lead-in when present. */
  title?: string;
  chips: ChatChip[];
  /**
   * 0–1. Rendered as "96% sure what you meant".
   *
   * This is the classifier's certainty about the INTENT, not about the chips
   * beside it — the label says so deliberately. A bare "96% confident" on a
   * card that is missing a room reads as a guarantee about the whole card.
   */
  confidence?: number;
  /** Overrides the words after the percentage. Keep it about the intent. */
  confidenceLabel?: string;
  /** Shown instead of chips for a reschedule. */
  change?: ChatChange;
  /** Defaults to "Confirm & schedule". */
  confirmLabel?: string;
  /** Defaults to "Edit". Set to `null` to hide the secondary action. */
  editLabel?: string | null;
  /**
   * Destructive framing for `delete_event` — red confirm button, matching the
   * design's "Cancel this event?" treatment.
   */
  destructive?: boolean;
  /**
   * Plain-English notes about values the system assumed, straight from
   * `ResolvedTime.assumptions`. Shown under the chips. A verification surface
   * that hides its own guesses is not a verification surface.
   */
  notes?: string[];
}

/** One tappable answer to a clarification question. */
export interface ChatChoice {
  id: string;
  label: string;
  kind?: ChatChipKind;
  group?: string;
}

/** One row in the typing-suggestion dropdown. */
export interface ChatSuggestion {
  id: string;
  label: string;
  /** Group heading, e.g. "PEOPLE". Consecutive rows sharing one are grouped. */
  group?: string;
  /** Right-aligned status, e.g. "Free". */
  badge?: string;
  kind?: ChatChipKind;
}

interface ChatMessageBase {
  /** Stable across re-renders — used for keyed rendering and event payloads. */
  id: string;
  role: ChatRole;
  /** Optional ISO timestamp. Not rendered yet; kept so history can be grouped. */
  at?: string;
}

/** Plain prose, from either side. Used for REJECT replies too. */
export interface ChatTextMessage extends ChatMessageBase {
  kind: "text";
  text: string;
}

/** The three animated dots, while classification is in flight. */
export interface ChatThinkingMessage extends ChatMessageBase {
  kind: "thinking";
  role: "assistant";
}

/** A PROCEED result: what was understood, awaiting confirmation. */
export interface ChatParseMessage extends ChatMessageBase {
  kind: "parse";
  role: "assistant";
  card: ChatParseCard;
  finalized?: boolean;
}

/** A CLARIFY result: one question, optional tappable answers. */
export interface ChatClarifyMessage extends ChatMessageBase {
  kind: "clarify";
  role: "assistant";
  /** "Got it — Room A." Acknowledges the previous answer. */
  ack?: string;
  /** What is understood so far, same shapes as a parse card. */
  chips?: ChatChip[];
  question: string;
  choices?: ChatChoice[];
  /** "1 more to go" — remaining required slots. */
  progress?: string;
  multiselect?: boolean;
  searchable?: boolean;
  inputPlaceholder?: string;
  hint?: string;
  answeredChoiceId?: string;
  answeredChoiceIds?: string[];
  answered?: boolean;
}

/** Committed. Offers View and Undo. */
export interface ChatSuccessMessage extends ChatMessageBase {
  kind: "success";
  role: "assistant";
  /** Defaults to "Scheduled". */
  title?: string;
  /** Monospaced detail line, e.g. "Design sync · Wed 10:00 · Room A". */
  summary: string;
  /** Undo is offered only while the action is still reversible. */
  canUndo?: boolean;
  canView?: boolean;
}

/** A centred divider in the thread, e.g. "Today". */
export interface ChatDividerMessage extends ChatMessageBase {
  kind: "divider";
  text: string;
}

export type ChatMessage =
  | ChatTextMessage
  | ChatThinkingMessage
  | ChatParseMessage
  | ChatClarifyMessage
  | ChatSuccessMessage
  | ChatDividerMessage;

/** Payload of the `chat-submit` event. */
export interface ChatSubmitDetail {
  prompt: string;
}

/** Payload of `chat-confirm`, `chat-edit`, `chat-undo` and `chat-view`. */
export interface ChatActionDetail {
  messageId: string;
}

/** Payload of `chat-clarify-response`. */
export interface ChatClarifyResponseDetail {
  messageId: string;
  choiceId: string;
  label: string;
  choiceIds?: string[];
  labels?: string[];
}

/** Payload of `chat-suggestion-select`. */
export interface ChatSuggestionDetail {
  id: string;
  label: string;
}
