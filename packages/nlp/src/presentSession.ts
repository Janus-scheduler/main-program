/**
 * `SessionState` → `ChatMessage`.
 *
 * The seam between the NLP classifier engine (`@janus-scheduler/nlp`) and the Chat UI (`<janus-chat>`).
 * Pure, zero-dependency data mapper for intent-aware parse cards, confidence labels, and dynamic button actions.
 */

import { DURATION_ASSUMPTION, zonedPartsAt } from "./datetime";
import type { FiredGate, SessionState, SlotName } from "./types";

export interface PresentChip {
  kind: "person" | "time" | "place" | "thing";
  label: string;
  assumed?: boolean;
}

export interface PresentChoice {
  id: string;
  label: string;
  kind?: "person" | "time" | "place" | "thing";
  group?: string;
}

export interface PresentParseCard {
  lead: string;
  title?: string;
  chips: PresentChip[];
  confidence: number;
  confidenceLabel: string;
  destructive?: boolean;
  confirmLabel: string;
  editLabel: string;
  notes: string[];
  /**
   * Things the user should look at before confirming.
   *
   * Distinct from `notes`, which discloses values the SYSTEM invented. A
   * warning is about the world: the calendar is showing a timezone you are not
   * in, the room is already booked. Rendered more prominently, and never
   * disabling Confirm — the human stays the decision-maker.
   */
  warnings?: string[];
}

export type PresentMessage =
  | {
      id: string;
      role: "assistant";
      kind: "clarify";
      /** "Got it — Room A." Acknowledges the previous answer. */
      ack?: string;
      /**
       * Shown instead of `ack` when the previous answer could not be used.
       *
       * Mutually exclusive with it by construction: you either acknowledge what
       * the user said or explain why it did not land — never both, and never
       * "Got it" about something that was rejected.
       */
      lead?: string;
      /** What is understood so far, same shapes as a parse card. */
      chips?: PresentChip[];
      question: string;
      choices: PresentChoice[];
      /** "1 more to go" — remaining required slots. */
      progress?: string;
      multiselect?: boolean;
      searchable?: boolean;
      inputPlaceholder?: string;
    }
  | {
      id: string;
      role: "assistant";
      kind: "text";
      text: string;
    }
  | {
      id: string;
      role: "assistant";
      kind: "parse";
      card: PresentParseCard;
    }
  | {
      id: string;
      role: "user";
      kind: "text";
      text: string;
    }
  | {
      id: string;
      role: "assistant";
      kind: "success";
      summary: string;
      canUndo: boolean;
      title?: string;
      /**
       * Offer a “View” button.
       *
       * Defaults to FALSE, deliberately. `<janus-chat>` renders the button on
       * `canView !== false`, so leaving it undefined rendered one on every
       * success — and it emitted `chat-view`, which nothing listens for. A
       * button that visibly does nothing is worse than no button.
       *
       * A host that handles `chat-view` can set this true to opt back in.
       */
      canView?: boolean;
    };

/** "Thu 10:00 AM" — short, and unambiguous about which day. */
export function formatWhen(localDate: string, localTime: string): string {
  const [y, m, d] = localDate.split("-").map(Number);
  const [hh, mm] = localTime.split(":").map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    weekday: "short",
    timeZone: "UTC",
  });
  const suffix = hh < 12 ? "AM" : "PM";
  const hour12 = hh % 12 === 0 ? 12 : hh % 12;
  return `${weekday} ${hour12}:${String(mm).padStart(2, "0")} ${suffix}`;
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = minutes / 60;
  return Number.isInteger(hours) ? `${hours} hr` : `${hours.toFixed(1)} hr`;
}

export interface PresentOptions {
  /**
   * The row the commit will fall back to when nothing was named (for add_event).
   */
  fallbackResourceName?: string;
  /**
   * The zone the user is physically in, for the timezone warning.
   *
   * The calendar's display timezone persists — someone sets it in the event
   * modal and it stays set. The chat then resolves "3pm" in THAT zone, which is
   * correct (it is the zone on screen) but can be hours from what the user
   * pictured. When the two differ the card says so, with the local equivalent.
   *
   * Injected rather than read from `Intl` in here so the behaviour is testable
   * without touching the machine's clock settings.
   */
  deviceTimezone?: string;
}

/**
 * The chips for a draft, in reading order: who, when, how long, where.
 *
 * For read-only queries (`get_details`), assumed booking defaults are suppressed.
 */
export function draftChips(
  state: SessionState,
  options: PresentOptions = {},
): PresentChip[] {
  const draft = state.draft;
  if (!draft) return [];

  const isQuery = draft.intent === "get_details";
  const isAwaiting = state.status === "awaiting";
  const chips: PresentChip[] = [];

  for (const person of draft.participants) {
    chips.push({ kind: "person", label: person.name });
  }

  if (draft.time) {
    const timeAssumed = draft.time.assumed.date || draft.time.assumed.timeOfDay;
    const durationAssumed = draft.time.assumed.duration;

    // In awaiting/clarify mode, only show time chip if explicitly confirmed by user
    if (!isAwaiting || !timeAssumed) {
      if (!isQuery || !timeAssumed) {
        chips.push({
          kind: "time",
          label: formatWhen(draft.time.localDate, draft.time.localTime),
          assumed: timeAssumed,
        });
      }
    }

    // A cancellation has no length of its own — the event being removed
    // already has one, and showing an invented "1 hr" next to a "Cancel event"
    // button reads as though something is about to be created.
    const isCancellation = draft.intent === "delete_event";

    // In awaiting/clarify mode, only show duration chip if explicitly confirmed by user
    if (!isQuery && !isCancellation && (!isAwaiting || !durationAssumed)) {
      chips.push({
        kind: "time",
        label: formatDuration(draft.time.durationMinutes),
        assumed: durationAssumed,
      });
    }
  }

  for (const resource of draft.resources) {
    chips.push({ kind: "place", label: resource.name });
  }

  // Only offer fallback resource for final event creation cards, never on clarification questions
  if (!isQuery && !isAwaiting && draft.intent !== "delete_event") {
    const named = draft.resources.length + draft.participants.length;
    if (named === 0 && options.fallbackResourceName) {
      chips.push({
        kind: "place",
        label: options.fallbackResourceName,
        assumed: true,
      });
    }
  }

  return chips;
}

/** Every value the user did not state, in plain English. */
export function assumptionNotes(
  state: SessionState,
  options: PresentOptions,
): string[] {
  const draft = state.draft;
  if (!draft) return [];

  const isQuery = draft.intent === "get_details";
  const notes = state.corrections.map((c) => `read “${c.from}” as “${c.to}”`);

  // Suppress booking assumptions for read-only lookup queries
  if (!isQuery) {
    // The date and time still matter for a cancellation — they are how the
    // event is identified. The invented DURATION does not: the event already
    // has one. Dropped by identity against the exported constant rather than
    // by matching its wording.
    notes.push(
      ...(draft.time?.assumptions ?? []).filter(
        (a) => draft.intent !== "delete_event" || a !== DURATION_ASSUMPTION,
      ),
    );

    if (draft.intent !== "delete_event") {
      const named = draft.resources.length + draft.participants.length;
      if (named === 0 && options.fallbackResourceName) {
        notes.push(
          state.skipped.includes("resource")
            ? `you skipped the room — it will go to ${options.fallbackResourceName}`
            : `no room or person named — it will go to ${options.fallbackResourceName}`,
        );
      }
    }

    // The card falls back to "New Event" when nothing named the event. That is
    // a guess like any other and has to be visible: a verification surface
    // that hides its own defaults is not a verification surface. Same treatment
    // as the resource fallback above.
    if (draft.intent === "add_event" && !draft.title) {
      notes.push(
        state.skipped.includes("title")
          ? `you skipped the name — it will be saved as “${FALLBACK_TITLE}”`
          : `no name given — it will be saved as “${FALLBACK_TITLE}”`,
      );
    }
  }

  return notes;
}

/**
 * What an unnamed event is called.
 *
 * Exported so the host's commit path uses the same string the card showed —
 * `commitToScheduler.ts` had its own copy of this literal, which is how a card
 * and the event it creates drift apart.
 */
export const FALLBACK_TITLE = "New Event";

/** "Asia/Tokyo" → "Tokyo"; "UTC" stays "UTC". */
function zoneLabel(zone: string): string {
  const tail = zone.split("/").pop();
  return (tail ?? zone).replace(/_/g, " ");
}

/** 15 → "3:00 PM" */
function clockLabel(hour: number, minute: number): string {
  const suffix = hour < 12 ? "AM" : "PM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${String(minute).padStart(2, "0")} ${suffix}`;
}

/**
 * Warn when the calendar is showing a timezone the user is not in.
 *
 * The display zone persists once set in the event modal, so a booking can land
 * hours from where the user pictured it while every number on screen looks
 * right. Resolving in the DISPLAYED zone is the correct behaviour — it is what
 * "3pm" means when 3pm is what you are looking at — so this discloses rather
 * than blocks, and Confirm stays enabled.
 *
 * Returns `null` when the zones match, when either is unknown, or when the
 * wall-clock time happens to be identical anyway (Europe/London vs UTC in
 * winter) — a warning nobody can act on is noise.
 */
function timezoneWarning(
  state: SessionState,
  options: PresentOptions,
): string | null {
  const time = state.draft?.time;
  const device = options.deviceTimezone;
  if (!time || !device || !time.timezone) return null;
  if (time.timezone === device) return null;

  const here = zonedPartsAt(time.startMs, device);
  const there = zonedPartsAt(time.startMs, time.timezone);
  if (here.hour === there.hour && here.minute === there.minute) return null;

  return (
    `scheduling in ${zoneLabel(time.timezone)}, but your device is on ` +
    `${zoneLabel(device)} — ${clockLabel(there.hour, there.minute)} there is ` +
    `${clockLabel(here.hour, here.minute)} your time`
  );
}

/** Everything worth a second look before confirming. */
export function cardWarnings(
  state: SessionState,
  options: PresentOptions = {},
): string[] {
  const warnings: string[] = [];
  const tz = timezoneWarning(state, options);
  if (tz) warnings.push(tz);
  return warnings;
}

/**
 * What to say when the user's answer could not be used.
 *
 * `provideAnswer` sets `state.unresolved` and re-asks the SAME question. Without
 * a lead the user sees their reply acknowledged with "Got it — sometime soon."
 * and then the identical question again, with nothing to indicate what went
 * wrong or what would work. That reads as a broken loop rather than a
 * conversation, and it was the single most broken-feeling path in the product.
 *
 * Each line does two jobs: say what was not understood, and show a shape that
 * will be.
 */
const RECOVERY_LEAD: Partial<Record<SlotName, string>> = {
  when: "I didn't catch a time in that — try “tomorrow at 2pm”, or pick one below.",
  duration:
    "I didn't catch a length — try “45 mins”, or “until 4pm”, or pick one below.",
  resource:
    "I don't have anyone or anywhere by that name — pick one from the list.",
  title: "I need a name for it — anything you'll recognise later.",
  intent: "Pick one of these so I know what to do.",
  confirm: "A yes or a no is all I need.",
};

const INTENT_LEAD: Record<string, string> = {
  add_event: "Here's what I understood —",
  modify_event: "Reschedule —",
  delete_event: "Cancel this event —",
  get_details: "Looking up schedule —",
  none: "Here's what I understood —",
};

export function getConfidenceLabel(intent: string): string {
  switch (intent) {
    case "delete_event":
      return "sure this is a cancellation";
    case "get_details":
      return "sure this is a schedule lookup";
    case "modify_event":
      return "sure this is a reschedule";
    case "add_event":
    default:
      return "sure this is a booking";
  }
}

export function getConfirmLabel(intent: string): string {
  switch (intent) {
    case "delete_event":
      return "Cancel event";
    case "get_details":
      return "View schedule";
    case "modify_event":
      return "Confirm reschedule";
    case "add_event":
    default:
      return "Confirm & schedule";
  }
}

export function getEditLabel(intent: string): string {
  return intent === "delete_event" ? "Keep it" : "Edit";
}

const GATE_COPY: Partial<Record<FiredGate, string>> = {
  gate1_confidence:
    "I didn't quite follow that. Try something like: book Room A tomorrow at 10am",
  gate2_nearest_none:
    "That doesn't look like a scheduling request. I can add, move, cancel or look up events.",
  gate3_no_anchor: "I need something to go on — a time, a room, or a person.",
  gate3b_resource_only: "I've got the room, but not when. Try adding a time.",
  gate4_margin:
    "I couldn't tell whether you wanted to book, move or cancel that. Try naming the action.",
  gate5_missing_slot: "I need a time for that — try 'tomorrow at 2pm'.",
  negation: "Nothing was changed.",
};

/**
 * Render one session snapshot as the assistant's reply.
 */
export function presentSession(
  state: SessionState,
  id: string,
  options: PresentOptions = {},
): PresentMessage | null {
  if (state.status === "awaiting" && state.question) {
    // Was the answer we are about to re-ask about the one that failed?
    //
    // `unresolved` is set by `provideAnswer` when a reply could not be used, and
    // the session then re-asks the SAME slot. In that case an acknowledgement
    // is a lie — "Got it — sometime soon." followed by "When would you like
    // that?" tells the user their answer landed when it did not. The lead
    // replaces it and explains what would work instead.
    const rejected =
      state.unresolved !== undefined &&
      state.unresolved === state.question.slot;
    const lead = rejected ? RECOVERY_LEAD[state.question.slot] : undefined;

    // The escape question is only ever reached because answers stopped working,
    // and its own text says exactly that. Acknowledging the reply that caused
    // it — "Got it — dunno." directly above "I'm still not getting that" — is
    // the same contradiction `lead` exists to prevent. It needs no lead of its
    // own: the question text already does that job.
    const stuck = state.question.slot === "escape";

    const lastAnswer = state.answers[state.answers.length - 1];
    /**
     * Navigation is not content, and must never be read back.
     *
     * `edit` and `escape` carry SENTINELS as their answer — `__edit__:title`,
     * `__start_over__` — because a closed choice needs values a user cannot
     * accidentally type. Acknowledging one printed the sentinel verbatim:
     *
     *     Got it — __edit__:title.
     *
     * There is nothing to acknowledge anyway: the question that follows
     * (“What should I call it instead?”) already says what was chosen.
     */
    const isNavigation =
      lastAnswer !== undefined &&
      (lastAnswer.slot === "edit" || lastAnswer.slot === "escape");

    const ack =
      rejected || stuck || !lastAnswer || isNavigation
        ? undefined
        : lastAnswer.skipped
          ? "No problem, skipping that."
          : `Got it — ${lastAnswer.merged || lastAnswer.answer}.`;

    /**
     * "N more to go" counts what is left AFTER the question on screen.
     *
     * `outstanding` is the truthful data — every required slot not yet filled
     * or skipped, including the one being asked. Rendering that number counted
     * the question the user is looking at, so the final one read "1 more to go"
     * and then the conversation ended.
     *
     * Subtracting only when the current slot is actually outstanding matters:
     * a gate, confirm or escape question is not a requirement, and there the
     * whole count really is still to come.
     */
    const askedSlot = state.question.slot;
    const outstanding = state.outstanding ?? [];
    const remaining = outstanding.filter((slot) => slot !== askedSlot);
    const askingOne = remaining.length < outstanding.length;
    const progress =
      remaining.length > 0
        ? `${remaining.length} more to go`
        : askingOne
          ? "last one"
          : undefined;

    return {
      id,
      role: "assistant",
      kind: "clarify",
      ack,
      lead,
      chips: draftChips(state, options),
      question: state.question.text,
      choices: state.question.choices.map((c) => ({
        id: c.id,
        label: c.label,
        kind: c.kind,
        group: c.group,
      })),
      progress,
      multiselect: state.question.multiselect,
      searchable: state.question.searchable,
      inputPlaceholder: state.question.inputPlaceholder,
    };
  }

  if (state.status === "declined") {
    let copy =
      "I couldn't quite understand that. Try something like “book Room A tomorrow at 10am”.";
    // A round-cap decline carries whatever gate was last evaluated, which does
    // not describe why the conversation actually ended — so the gate copy would
    // be misleading here. Branch on the structural marker, never on `reason`:
    // that is a diagnostic for humans and logs, and matching its wording made
    // this copy revert silently the moment the wording changed.
    if (state.roundCapReached) {
      copy = "Let's start over — what would you like to do?";
    } else if (state.route.gate && GATE_COPY[state.route.gate]) {
      copy = GATE_COPY[state.route.gate]!;
    }

    // No `unresolved` handling here on purpose. It is only ever set alongside a
    // re-ask, which is an `awaiting` state — so this branch could never see it,
    // and the recovery lead that used to live here was dead code. It now runs
    // in the `awaiting` branch above, where the re-ask actually happens.

    return {
      id,
      role: "assistant",
      kind: "text",
      text: copy,
    };
  }

  const draft = state.draft;
  if (!draft) return null;

  return {
    id,
    role: "assistant",
    kind: "parse",
    card: {
      lead: INTENT_LEAD[draft.intent] ?? INTENT_LEAD.add_event,
      title:
        draft.title ||
        (draft.intent === "add_event" ? FALLBACK_TITLE : undefined),
      chips: draftChips(state, options),
      confidence: state.route.confidence,
      confidenceLabel: getConfidenceLabel(draft.intent),
      destructive: draft.intent === "delete_event",
      confirmLabel: getConfirmLabel(draft.intent),
      editLabel: getEditLabel(draft.intent),
      notes: assumptionNotes(state, options),
      warnings: cardWarnings(state, options),
    },
  };
}

/** One-line summary for the success bubble. */
export function summarise(state: SessionState): string {
  const draft = state.draft;
  if (!draft) return "Done";

  if (draft.intent === "get_details") {
    return `Looked up schedule for ${draft.time ? formatWhen(draft.time.localDate, draft.time.localTime) : "today"}`;
  }

  const parts = [draft.title ?? "Event"];
  if (draft.time) {
    parts.push(formatWhen(draft.time.localDate, draft.time.localTime));
  }
  for (const r of draft.resources) parts.push(r.name);
  for (const p of draft.participants) parts.push(p.name);
  return parts.join(" · ");
}
