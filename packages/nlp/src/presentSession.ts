/**
 * `SessionState` → `ChatMessage`.
 *
 * The seam between the NLP classifier engine (`@janus-scheduler/nlp`) and the Chat UI (`<janus-chat>`).
 * Pure, zero-dependency data mapper for intent-aware parse cards, confidence labels, and dynamic button actions.
 */

import type { SessionState } from "./types";

export interface PresentChip {
  kind: "person" | "time" | "place";
  label: string;
  assumed?: boolean;
}

export interface PresentChoice {
  id: string;
  label: string;
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
}

export type PresentMessage =
  | {
      id: string;
      role: "assistant";
      kind: "clarify";
      question: string;
      choices: PresentChoice[];
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
  const chips: PresentChip[] = [];

  for (const person of draft.participants) {
    chips.push({ kind: "person", label: person.name });
  }

  if (draft.time) {
    const timeAssumed = draft.time.assumed.date || draft.time.assumed.timeOfDay;
    const durationAssumed = draft.time.assumed.duration;

    // For queries, only show the time chip if date was explicitly provided or relevant
    if (!isQuery || !timeAssumed) {
      chips.push({
        kind: "time",
        label: formatWhen(draft.time.localDate, draft.time.localTime),
        assumed: timeAssumed,
      });
    }

    if (!isQuery) {
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

  // Only offer fallback resource for event creation (add_event / modify_event)
  if (!isQuery && draft.intent !== "delete_event") {
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
    notes.push(...(draft.time?.assumptions ?? []));

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
  }

  return notes;
}

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

/**
 * Render one session snapshot as the assistant's reply.
 */
export function presentSession(
  state: SessionState,
  id: string,
  options: PresentOptions = {},
): PresentMessage | null {
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
      confidenceLabel: getConfidenceLabel(draft.intent),
      destructive: draft.intent === "delete_event",
      confirmLabel: getConfirmLabel(draft.intent),
      editLabel: getEditLabel(draft.intent),
      notes: assumptionNotes(state, options),
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
