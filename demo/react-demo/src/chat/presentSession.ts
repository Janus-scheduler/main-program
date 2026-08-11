/**
 * `SessionState` → `ChatMessage[]`.
 *
 * The seam between the two halves of the feature. `@janus-scheduler/nlp`
 * produces intents, gates and resolved instants; `<janus-chat>` renders chips,
 * cards and questions; neither knows about the other, and this maps between
 * them.
 *
 * STEP 5 NOTE ON WHERE THIS LIVES. It is in the demo for now, deliberately.
 * It cannot go in `@janus-scheduler/nlp` (that package must not know what a
 * chat bubble is) and putting it in `@janus-scheduler/ui` would make a
 * render-only package depend on the classifier. Step 6 decides its permanent
 * home once the live wiring shows what the other frameworks actually need.
 */

import type { SessionState } from "@janus-scheduler/nlp";
import type { ChatChip, ChatMessage } from "@janus-scheduler/react";

/** "Thu 10:00 AM" — short, and unambiguous about which day. */
function formatWhen(localDate: string, localTime: string): string {
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

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = minutes / 60;
  return Number.isInteger(hours) ? `${hours} hr` : `${hours.toFixed(1)} hr`;
}

/**
 * The chips for a draft, in reading order: who, when, how long, where.
 *
 * `assumed` is set from the resolver's own `assumptions` list rather than
 * guessed here — a value the system invented has to look different from one
 * the user supplied, or the card is not a verification surface.
 */
export interface PresentOptions {
  /**
   * The row the commit will fall back to when nothing was named.
   *
   * Passing it is what turns a hidden guess into a visible one. Without it the
   * card simply shows no location, the user confirms, and the event lands
   * somewhere they were never told about.
   */
  fallbackResourceName?: string;
}

export function draftChips(
  state: SessionState,
  options: PresentOptions = {},
): ChatChip[] {
  const draft = state.draft;
  if (!draft) return [];

  const chips: ChatChip[] = [];

  for (const person of draft.participants) {
    chips.push({ kind: "person", label: person.name });
  }

  if (draft.time) {
    // Read the structured flags, never the prose. An earlier version regexed
    // `assumptions` and matched only one of the two wordings the resolver
    // uses for an invented hour, so "9:00 AM" chosen from the word "morning"
    // rendered as though the user had said it.
    chips.push(
      {
        kind: "time",
        label: formatWhen(draft.time.localDate, draft.time.localTime),
        assumed: draft.time.assumed.date || draft.time.assumed.timeOfDay,
      },
      {
        kind: "time",
        label: formatDuration(draft.time.durationMinutes),
        assumed: draft.time.assumed.duration,
      },
    );
  }

  for (const resource of draft.resources) {
    chips.push({ kind: "place", label: resource.name });
  }

  // Nothing was named, so the commit will pick a row. Show WHICH one, dashed
  // like every other assumed value. Everything on this card has to be
  // something the user can check before pressing Confirm.
  const named = draft.resources.length + draft.participants.length;
  if (named === 0 && options.fallbackResourceName) {
    chips.push({
      kind: "place",
      label: options.fallbackResourceName,
      assumed: true,
    });
  }

  return chips;
}

/** Every value the user did not state, in plain English. */
function assumptionNotes(
  state: SessionState,
  options: PresentOptions,
): string[] {
  const draft = state.draft;
  if (!draft) return [];

  // Rewriting what somebody typed is a guess like any other, so it is listed
  // first — before the user reads the chips it produced.
  const notes = state.corrections.map((c) => `read “${c.from}” as “${c.to}”`);
  notes.push(...(draft.time?.assumptions ?? []));

  const named = draft.resources.length + draft.participants.length;
  if (named === 0 && options.fallbackResourceName) {
    notes.push(
      state.skipped.includes("resource")
        ? `you skipped the room — it will go to ${options.fallbackResourceName}`
        : `no room or person named — it will go to ${options.fallbackResourceName}`,
    );
  }

  return notes;
}

const INTENT_LEAD: Record<string, string> = {
  add_event: "Here's what I understood —",
  modify_event: "Reschedule",
  delete_event: "Cancel this event —",
  get_details: "Looking up —",
  none: "Here's what I understood —",
};

/**
 * Render one session snapshot as the assistant's reply.
 *
 * Returns `null` while the session has produced nothing to say, so a caller
 * can keep the thinking indicator up.
 */
export function presentSession(
  state: SessionState,
  id: string,
  options: PresentOptions = {},
): ChatMessage | null {
  if (state.status === "awaiting" && state.question) {
    return {
      id,
      role: "assistant",
      kind: "clarify",
      question: state.question.text,
      choices: state.question.choices.map((c) => ({
        id: c.id,
        label: c.label,
      })),
    };
  }

  if (state.status === "declined") {
    return {
      id,
      role: "assistant",
      kind: "text",
      // REJECT gets a plain message and no card — the correct reading of
      // gates 1-3, and what the design shows.
      text: `I can't act on that — ${state.reason}. Try something like “book Room A tomorrow at 10am”.`,
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
      title: draft.title,
      chips: draftChips(state, options),
      confidence: state.route.confidence,
      // The number is the classifier's certainty about the INTENT. Saying so
      // stops "100% confident" from reading as a guarantee about the chips.
      confidenceLabel: "sure this is a booking",
      destructive: draft.intent === "delete_event",
      confirmLabel:
        draft.intent === "delete_event" ? "Cancel event" : "Confirm & schedule",
      editLabel: draft.intent === "delete_event" ? "Keep it" : "Edit",
      notes: assumptionNotes(state, options),
    },
  };
}

/** One-line summary for the success bubble. */
export function summarise(state: SessionState): string {
  const draft = state.draft;
  if (!draft) return "Done";

  const parts = [draft.title ?? "Event"];
  if (draft.time) {
    parts.push(formatWhen(draft.time.localDate, draft.time.localTime));
  }
  for (const r of draft.resources) parts.push(r.name);
  for (const p of draft.participants) parts.push(p.name);
  return parts.join(" · ");
}
