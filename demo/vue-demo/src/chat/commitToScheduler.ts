/**
 * The "act" half of verify-then-act.
 *
 * Turns a CONFIRMED `SessionState` into a scheduler mutation. Everything goes
 * through `SchedulerManager` and never through `schedulerStore` — per
 * `CLAUDE.md`, and because the manager is what provides the optimistic-update +
 * automatic-rollback behaviour that Undo below piggybacks on.
 *
 * Nothing here runs until the user has pressed Confirm on a parse card. The
 * classifier cannot reach this file, and the session state machine has no I/O
 * at all, so there is no path from "typed a sentence" to "changed the calendar"
 * that skips the confirmation.
 */

import type { SchedulerManager } from "@janus-scheduler/core";
import type { EntityCatalog, SessionState } from "@janus-scheduler/nlp";

/** Anything with an `id` and a `name`, which is all we need off a Resource. */
interface ResourceLike {
  id: string;
  name: string;
  type?: string;
}

/**
 * Build the extraction catalog from the LIVE store.
 *
 * People become `participants` (so "Sarah" matches "Dr. Sarah Chen" — partial
 * matching defaults on for `type: "person"`), everything else becomes a
 * `resource`. Titles like "Dr." are added as aliases so both spellings match.
 */
export function catalogFromResources(resources: ResourceLike[]): EntityCatalog {
  const participants: EntityCatalog["participants"] = [];
  const rooms: EntityCatalog["resources"] = [];

  for (const r of resources) {
    if (r.type === "person") {
      // "Dr. Sarah Chen" also answers to "Sarah Chen": the honorific is not
      // part of how anyone refers to them in a sentence.
      const withoutTitle = r.name.replace(/^(dr|mr|mrs|ms|prof)\b\.?\s+/i, "");
      participants.push({
        id: r.id,
        name: r.name,
        type: "person",
        aliases: withoutTitle === r.name ? undefined : [withoutTitle],
      });
    } else {
      rooms.push({ id: r.id, name: r.name, type: r.type ?? "resource" });
    }
  }

  return { participants, resources: rooms };
}

/** What a successful commit reports back to the chat. */
export interface CommitSuccess {
  ok: true;
  summary: string;
  /** Absent when the action is not reversible. */
  undo?: () => void;
}

/** A refusal the user can read. Not an exception — this is an expected case. */
export interface CommitFailure {
  ok: false;
  message: string;
}

export type CommitResult = CommitSuccess | CommitFailure;

function shortWhen(localDate: string, localTime: string): string {
  const [y, m, d] = localDate.split("-").map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    weekday: "short",
    timeZone: "UTC",
  });
  return `${weekday} ${localTime}`;
}

/**
 * Find the one event a "cancel"/"move" utterance is talking about.
 *
 * Deliberately conservative. Deleting or moving the WRONG event is far worse
 * than asking, so anything other than exactly one match is a refusal with a
 * readable reason — never a best guess.
 */
function resolveTarget(
  manager: SchedulerManager,
  title: string | undefined,
): { ok: true; id: string } | CommitFailure {
  if (!title) {
    return {
      ok: false,
      message: "I need to know which event you mean — try naming it.",
    };
  }

  const needle = title.toLowerCase();
  const events = manager.getAllEvents();
  const exact = events.filter((e) => e.title.toLowerCase() === needle);
  const matches =
    exact.length > 0
      ? exact
      : events.filter((e) => e.title.toLowerCase().includes(needle));

  if (matches.length === 0) {
    return {
      ok: false,
      message: `I couldn't find an event called “${title}”.`,
    };
  }
  if (matches.length > 1) {
    const names = matches.map((e) => `“${e.title}”`).join(", ");
    return {
      ok: false,
      message: `There are ${matches.length} events matching “${title}” (${names}). Open the one you mean on the timeline.`,
    };
  }
  return { ok: true, id: matches[0].id };
}

/**
 * Commit a `ready` session.
 *
 * `fallbackResourceId` is used when the utterance named no resource and no
 * person — an event with no resource fails `Event.isValid()` and would never
 * appear on the timeline. The caller is told, in the returned summary, which
 * row it landed on; a silently misplaced event would be worse than a refusal.
 */
export function commitSession(
  manager: SchedulerManager,
  state: SessionState,
  fallbackResourceId: string | undefined,
): CommitResult {
  const draft = state.draft;
  if (state.status !== "ready" || !draft) {
    return { ok: false, message: "There's nothing confirmed to act on." };
  }

  switch (draft.intent) {
    case "add_event": {
      if (!draft.time) {
        return { ok: false, message: "I still don't have a time for that." };
      }

      const named = [...draft.resources, ...draft.participants].map(
        (m) => m.id,
      );
      const resourceIds =
        named.length > 0
          ? named
          : fallbackResourceId
            ? [fallbackResourceId]
            : [];
      if (resourceIds.length === 0) {
        return {
          ok: false,
          message: "There are no resources to schedule against yet.",
        };
      }

      const id = `nlp_${Date.now()}`;
      const title = draft.title ?? "New event";
      manager.addEvent({
        id,
        title,
        startTime: draft.time.startISO,
        endTime: draft.time.endISO,
        resourceIds,
        status: "confirmed",
        color: "primary",
      });

      const where =
        named.length > 0
          ? [...draft.resources, ...draft.participants]
              .map((m) => m.name)
              .join(", ")
          : `${manager.getResource(resourceIds[0])?.name ?? "the first row"} (nothing named, so I used the first row)`;

      return {
        ok: true,
        summary: `${title} · ${shortWhen(draft.time.localDate, draft.time.localTime)} · ${where}`,
        undo: () => manager.deleteEvent(id),
      };
    }

    case "delete_event": {
      const target = resolveTarget(manager, draft.title);
      if (!target.ok) return target;

      // Snapshot BEFORE deleting — Undo has to put back exactly what was there,
      // including its resources and colour, not a reconstruction.
      const previous = manager.getEvent(target.id);
      if (!previous) {
        return { ok: false, message: "That event has already gone." };
      }
      const snapshot = {
        id: previous.id,
        title: previous.title,
        startTime: previous.startTime,
        endTime: previous.endTime,
        resourceIds: [...previous.resourceIds],
        status: previous.status,
        description: previous.description,
        color: previous.color,
        allDay: previous.allDay,
        recurrenceRule: previous.recurrenceRule,
      };

      manager.deleteEvent(target.id);
      return {
        ok: true,
        summary: `Cancelled “${snapshot.title}”`,
        undo: () => manager.addEvent(snapshot),
      };
    }

    case "modify_event": {
      if (!draft.time) {
        return { ok: false, message: "I don't have a new time to move it to." };
      }
      const target = resolveTarget(manager, draft.title);
      if (!target.ok) return target;

      const previous = manager.getEvent(target.id);
      if (!previous) {
        return { ok: false, message: "That event no longer exists." };
      }
      const before = {
        startTime: previous.startTime,
        endTime: previous.endTime,
      };

      manager.updateEvent(target.id, {
        startTime: draft.time.startISO,
        endTime: draft.time.endISO,
      });

      return {
        ok: true,
        summary: `Moved “${previous.title}” to ${shortWhen(draft.time.localDate, draft.time.localTime)}`,
        undo: () => manager.updateEvent(target.id, before),
      };
    }

    case "get_details": {
      // A question, not a mutation. Nothing to undo.
      const target = resolveTarget(manager, draft.title);
      if (!target.ok) return target;
      const event = manager.getEvent(target.id);
      if (!event) return { ok: false, message: "I couldn't find that event." };
      const start = new Date(event.startTime);
      return {
        ok: true,
        summary: `${event.title} · ${start.toLocaleString()} · ${event.resourceIds.length} resource(s)`,
      };
    }

    default:
      return { ok: false, message: "I can't do that one yet." };
  }
}
