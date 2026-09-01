/**
 * The "act" half of verify-then-act.
 *
 * ══════════════════════════════════════════════════════════════════════════
 *  THE ONLY MODULE IN THIS PACKAGE THAT CAN CHANGE A CALENDAR.
 *
 *  Everything else here reads text and produces values. This turns a CONFIRMED
 *  `SessionState` into scheduler mutations — and it is reachable from exactly
 *  one place: a Confirm the user pressed on a parse card.
 *
 *  Two properties keep that honest, and both are structural rather than
 *  conventional:
 *
 *   1. **The scheduler arrives as an argument.** There is no import of
 *      `@janus-scheduler/core` here and no module-level handle to anything.
 *      This module cannot reach a store on its own; a host has to hand it one,
 *      per call. `session.ts`, `gates.ts` and everything frozen never see a
 *      `SchedulerPort` at all.
 *
 *   2. **`commitSession` refuses anything that is not `ready`.** A session that
 *      is still `awaiting` a question, or was `declined`, returns a failure
 *      rather than a mutation.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * ── Why a port and not `SchedulerManager` ─────────────────────────────────
 *
 * This package must not depend on `@janus-scheduler/core`. That is what keeps
 * the dependency arrow pointing one way — core knows nothing about chat, and
 * chat cannot drag the scheduler into a bundle that only wanted a classifier.
 * Importing `SchedulerManager`, EVEN AS A TYPE, would put core into this
 * package's graph. So the six methods actually used are declared structurally
 * below; `SchedulerManager` satisfies them without either package knowing about
 * the other.
 *
 * (The package README still describes this as "zero-dependency". That stopped
 * being true in b77e878, which added `chrono-node` for date parsing — see
 * `datetime.ts`. The core-independence rule above is unaffected and still
 * holds.)
 *
 * The cost of cutting that compiler link is that core could drift away from
 * this interface and nothing here would fail to build. That is bought back in
 * `packages/core/tests/nlp-commit.integration.test.ts`, which asserts
 * `SchedulerManager` still satisfies `SchedulerPort` and exercises this file
 * against a REAL manager and store — a hand-written stub cannot reproduce the
 * store's `throw` on invalid data or its silent overwrite on a duplicate id.
 */

import { zonedPartsAt } from "./datetime";
import type { SessionDraft, SessionState } from "./types";

// ── the scheduler, as this module needs it ────────────────────────────────

/** Event fields the scheduler accepts. Mirrors core's `EventData`. */
export interface EventInput {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  resourceId?: string;
  resourceIds?: string[];
  status?: "draft" | "confirmed" | "cancelled";
  description?: string;
  color?: string;
  allDay?: boolean;
  recurrenceRule?: string;
}

/**
 * An event as the scheduler returns it.
 *
 * LOAD-BEARING: every field the delete-undo snapshot restores has to be here.
 * A field missing from this interface is a field `undo` silently drops, and the
 * restored event comes back subtly different from the one that was cancelled.
 */
export interface StoredEvent {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  resourceIds: string[];
  status?: "draft" | "confirmed" | "cancelled";
  description?: string;
  color?: string;
  allDay?: boolean;
  recurrenceRule?: string;
}

/**
 * The six methods this module calls. `SchedulerManager` satisfies it.
 *
 * Deliberately the minimum: a wider port would be a wider blast radius for the
 * one module here that can write.
 */
export interface SchedulerPort {
  addEvent(data: EventInput): { id: string };
  updateEvent(id: string, updates: Partial<EventInput>): unknown;
  deleteEvent(id: string): unknown;
  getEvent(id: string): StoredEvent | undefined;
  getAllEvents(): StoredEvent[];
  getResource(id: string): { name: string } | undefined;
}

// ── catalog ───────────────────────────────────────────────────────────────

/** Anything with an `id` and a `name`, which is all we need off a Resource. */
export interface ResourceLike {
  id: string;
  name: string;
  type?: string;
}

/** Minimal shape of the catalog `extractEntities` consumes. */
interface CatalogEntryLike {
  id: string;
  name: string;
  type?: string;
  aliases?: string[];
}

/**
 * Build the extraction catalog from the host's LIVE resource list.
 *
 * People become `participants` (so "Sarah" matches "Dr. Sarah Chen" — partial
 * matching defaults on for `type: "person"`), everything else becomes a
 * `resource`. Honorifics are added as aliases so both spellings match.
 */
export function catalogFromResources(resources: ResourceLike[]): {
  participants: CatalogEntryLike[];
  resources: CatalogEntryLike[];
} {
  const participants: CatalogEntryLike[] = [];
  const rooms: CatalogEntryLike[] = [];

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

// ── results ───────────────────────────────────────────────────────────────

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

// ── writing safely ────────────────────────────────────────────────────────

/** Monotonic tail for the fallback id, so two calls in one tick still differ. */
let idCounter = 0;

/**
 * A genuinely unique event id.
 *
 * The previous `nlp_${Date.now()}` was not unique: `Date.now()` has
 * millisecond resolution, and the store keys events by id
 * (`events: { ...state.events, [event.id]: event }`), so a second commit inside
 * the same millisecond REPLACED the first one. Silent data loss, and a real
 * integration test in core pins that store behaviour.
 *
 * `globalThis.crypto` rather than `node:crypto`: this file is reachable from
 * the package's PURE entry, which must stay free of Node builtins or the
 * browser build breaks. The fallback covers older runtimes and non-secure
 * contexts, where `randomUUID` is absent.
 */
function newEventId(): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return `nlp_${uuid}`;
  idCounter = (idCounter + 1) % Number.MAX_SAFE_INTEGER;
  if (typeof globalThis.crypto?.getRandomValues === "function") {
    const bytes = new Uint8Array(6);
    globalThis.crypto.getRandomValues(bytes);
    const rand = Array.from(bytes, (b) => b.toString(36))
      .join("")
      .slice(0, 8);
    return `nlp_${Date.now()}_${idCounter}_${rand}`;
  }
  return `nlp_${Date.now()}_${idCounter}`;
}

/** How many times to re-roll an id before giving up. */
const MAX_ID_ATTEMPTS = 5;

/**
 * An id no event currently holds.
 *
 * Belt and braces behind `newEventId`. The store overwrites rather than
 * erroring on a duplicate, so "probably unique" is not good enough for the one
 * code path that can destroy an existing booking.
 */
function freeEventId(scheduler: SchedulerPort): string | null {
  for (let attempt = 0; attempt < MAX_ID_ATTEMPTS; attempt++) {
    const id = newEventId();
    if (!scheduler.getEvent(id)) return id;
  }
  return null;
}

/**
 * Run a scheduler mutation, turning a throw into a readable refusal.
 *
 * `schedulerStore.addEvent` THROWS on `!event.isValid()` — no resource, no
 * title, no id. `ChatController.confirm()` has no try/catch, so before this the
 * throw escaped the whole feature and landed in React's error boundary. A
 * rejected commit is an expected outcome, not an exceptional one, and the user
 * deserves a sentence rather than a blank screen.
 */
function attempt<T>(
  action: () => T,
  message: string,
): { ok: true; value: T } | CommitFailure {
  try {
    return { ok: true, value: action() };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return { ok: false, message: `${message} (${detail})` };
  }
}

/**
 * Wrap an undo so it can never throw into the host.
 *
 * `ChatController.undo()` calls these unguarded, so a failure here would crash
 * the app from a button press. Undo returns nothing, so a failure is swallowed
 * — the UI's unconditional "Undone" label is a separate issue, tracked in the
 * checklist, not something this wrapper can fix.
 */
function safely(action: () => unknown): () => void {
  return () => {
    try {
      action();
    } catch {
      /* deliberately swallowed — see above */
    }
  };
}

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
  scheduler: SchedulerPort,
  draft: SessionDraft,
): { ok: true; id: string } | CommitFailure {
  const events = scheduler.getAllEvents();
  const title = draft.title?.trim();

  if (title) {
    const needle = title.toLowerCase();
    const exact = events.filter((e) => e.title.toLowerCase() === needle);
    const matches =
      exact.length > 0
        ? exact
        : events.filter((e) => e.title.toLowerCase().includes(needle));

    if (matches.length === 1) return { ok: true, id: matches[0].id };
    if (matches.length > 1) {
      const names = matches.map((e) => `“${e.title}”`).join(", ");
      return {
        ok: false,
        message: `There are ${matches.length} events matching “${title}” (${names}). Open the one you mean on the timeline.`,
      };
    }
    // Nothing by that name. Do NOT give up here: the utterance may also have
    // named a room, a person and a time, which identify the event perfectly
    // well. “cancel the Dr. Michael Ross event today at 1pm” used to fail on
    // a title of “event” while holding everything needed to find it.
  }

  /**
   * No name — but "cancel Operating Room 1 tomorrow at 2pm" identifies an
   * event exactly as well as a title does, and it is how people actually
   * speak. Matching only on the title meant this refused an utterance that
   * named one room and one instant, then advised naming the event — advice
   * that did not work, because a bare event name does not classify as a
   * scheduling request. That was a dead end with no way out of it.
   *
   * Still conservative: exactly one match commits, anything else refuses and
   * says what it saw. Deleting the wrong event stays far worse than asking.
   */
  const targeted = [...draft.resources, ...draft.participants].map((r) => r.id);
  const time = draft.time;
  if (targeted.length === 0 || !time) {
    return {
      ok: false,
      message: title
        ? `I couldn't find an event called “${title}”. Try the room and time, like “cancel Room A tomorrow at 3pm”.`
        : "I need to know which event you mean — say the room and time, like “cancel Room A tomorrow at 3pm”.",
    };
  }

  const onResource = events.filter((e) =>
    (e.resourceIds ?? []).some((id) => targeted.includes(id)),
  );

  // A stated time picks the event covering that instant. A time this layer
  // INVENTED (the 09:00 default) must not be used to pick anything, so an
  // utterance that named only a day considers the whole of that day instead.
  const stated = !time.assumed.timeOfDay;
  const matches = stated
    ? onResource.filter((e) => {
        const from = Date.parse(e.startTime);
        const to = Date.parse(e.endTime);
        return (
          Number.isFinite(from) && time.startMs >= from && time.startMs < to
        );
      })
    : onResource.filter(
        (e) =>
          zonedPartsAtLocalDate(e.startTime, time.timezone) === time.localDate,
      );

  const where = [...draft.resources, ...draft.participants]
    .map((r) => r.name)
    .join(", ");

  if (matches.length === 1) return { ok: true, id: matches[0].id };
  if (matches.length > 1) {
    const names = matches.map((e) => `“${e.title}”`).join(", ");
    return {
      ok: false,
      message: `There are ${matches.length} events on ${where} then (${names}). Open the one you mean on the timeline.`,
    };
  }
  const named = title ? ` called “${title}”` : "";
  return {
    ok: false,
    message: stated
      ? `I couldn't find anything${named} on ${where} at ${shortWhen(time.localDate, time.localTime)}.`
      : `I couldn't find anything${named} on ${where} that day.`,
  };
}

/** The wall-clock date, "YYYY-MM-DD", of an ISO instant in `timezone`. */
function zonedPartsAtLocalDate(iso: string, timezone: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "";
  const p = zonedPartsAt(ms, timezone);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/** Host policy this module needs to honour. */
export interface CommitOptions {
  /**
   * Refuse a booking that overlaps an existing one on the same row.
   *
   * Mirrors the `preventConflicts` prop on `<janus-timeline>`. It has to be
   * passed in: the chat commits through the same manager as a drag does, but
   * `SchedulerManager.addEvent` runs no conflict check of its own — so with
   * the setting ON, the timeline blocked a double-booking and the chat
   * created it anyway.
   */
  preventConflicts?: boolean;
}

/**
 * Events on any of `resourceIds` that overlap [startMs, endMs).
 *
 * The predicate is `core`'s `checkSlotConflict`, restated rather than
 * imported — this package must not depend on `@janus-scheduler/core`. Keep
 * the two in step: half-open overlap, and an `_occ_` recurrence suffix
 * stripped before comparing ids so an occurrence never clashes with its own
 * parent.
 */
function overlappingEvents(
  scheduler: SchedulerPort,
  resourceIds: string[],
  startMs: number,
  endMs: number,
  ignoreEventId?: string,
): StoredEvent[] {
  const ignoreBaseId = ignoreEventId
    ? ignoreEventId.replace(/_occ_\d+$/, "")
    : null;

  return scheduler.getAllEvents().filter((ev) => {
    if (ignoreBaseId && ev.id.replace(/_occ_\d+$/, "") === ignoreBaseId) {
      return false;
    }
    if (ev.status === "cancelled") return false;
    if (!(ev.resourceIds ?? []).some((id) => resourceIds.includes(id))) {
      return false;
    }
    const from = Date.parse(ev.startTime);
    const to = Date.parse(ev.endTime);
    if (!Number.isFinite(from) || !Number.isFinite(to)) return false;
    return startMs < to && endMs > from;
  });
}

/** “Operating Room 1 already has “Ward Round” then.” */
function clashMessage(
  scheduler: SchedulerPort,
  clashes: StoredEvent[],
): string {
  const names = clashes.map((e) => `“${e.title}”`).join(", ");
  const rows = [
    ...new Set(
      clashes.flatMap((e) =>
        (e.resourceIds ?? []).map(
          (id) => scheduler.getResource(id)?.name ?? "that row",
        ),
      ),
    ),
  ].join(", ");
  return `That clashes with ${names} on ${rows}. Nothing was scheduled.`;
}

/**
 * Commit a `ready` session.
 *
 * `fallbackResourceId` is used when the utterance named no resource and no
 * person — an event with no resource fails validation and would never appear on
 * the timeline. The caller is told, in the returned summary, which row it landed
 * on; a silently misplaced event would be worse than a refusal.
 */
export function commitSession(
  scheduler: SchedulerPort,
  state: SessionState,
  fallbackResourceId: string | undefined,
  options: CommitOptions = {},
): CommitResult {
  const draft = state.draft;
  if (state.status !== "ready" || !draft) {
    return { ok: false, message: "There's nothing confirmed to act on." };
  }

  switch (draft.intent) {
    case "add_event": {
      // Bound to a local so the narrowing survives into the closure below —
      // TypeScript cannot keep `draft.time` narrowed across a function
      // boundary, and a `!` assertion here would be exactly the kind of
      // "trust me" this step exists to remove.
      const time = draft.time;
      if (!time) {
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

      // The chat must not be able to do what the timeline forbids.
      if (options.preventConflicts) {
        // Fall back to the ISO strings rather than comparing `undefined`:
        // a silently skipped check is worse than no check, because it looks
        // like protection.
        const from = Number.isFinite(time.startMs)
          ? time.startMs
          : Date.parse(time.startISO);
        const to = Number.isFinite(time.endMs)
          ? time.endMs
          : Date.parse(time.endISO);
        const clashes = overlappingEvents(scheduler, resourceIds, from, to);
        if (clashes.length > 0) {
          return { ok: false, message: clashMessage(scheduler, clashes) };
        }
      }

      const id = freeEventId(scheduler);
      if (id === null) {
        return {
          ok: false,
          message:
            "I couldn't create that without overwriting an existing event.",
        };
      }

      const title = draft.title?.trim() || "New Event";
      const written = attempt(
        () =>
          scheduler.addEvent({
            id,
            title,
            startTime: time.startISO,
            endTime: time.endISO,
            resourceIds,
            status: "confirmed",
            color: "primary",
          }),
        "I couldn't add that to the calendar.",
      );
      if (!written.ok) return written;

      const where =
        named.length > 0
          ? [...draft.resources, ...draft.participants]
              .map((m) => m.name)
              .join(", ")
          : `${scheduler.getResource(resourceIds[0])?.name ?? "the first row"} (nothing named, so I used the first row)`;

      return {
        ok: true,
        summary: `${title} · ${shortWhen(time.localDate, time.localTime)} · ${where}`,
        undo: safely(() => scheduler.deleteEvent(id)),
      };
    }

    case "delete_event": {
      const target = resolveTarget(scheduler, draft);
      if (!target.ok) return target;

      // Snapshot BEFORE deleting — Undo has to put back exactly what was there,
      // including its resources and colour, not a reconstruction.
      const previous = scheduler.getEvent(target.id);
      if (!previous) {
        return { ok: false, message: "That event has already gone." };
      }
      const snapshot: EventInput = {
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

      const removed = attempt(
        () => scheduler.deleteEvent(target.id),
        "I couldn't cancel that.",
      );
      if (!removed.ok) return removed;

      return {
        ok: true,
        summary: `Cancelled “${snapshot.title}”`,
        // Restores under the ORIGINAL id, which is the point — it is the same
        // event coming back, not a copy.
        undo: safely(() => scheduler.addEvent(snapshot)),
      };
    }

    case "modify_event": {
      if (!draft.time) {
        return { ok: false, message: "I don't have a new time to move it to." };
      }
      const target = resolveTarget(scheduler, draft);
      if (!target.ok) return target;

      const previous = scheduler.getEvent(target.id);
      if (!previous) {
        return { ok: false, message: "That event no longer exists." };
      }
      const before = {
        startTime: previous.startTime,
        endTime: previous.endTime,
        resourceIds: [...previous.resourceIds],
      };

      const named = [...draft.resources, ...draft.participants].map(
        (m) => m.id,
      );
      const updates: Partial<EventInput> = {
        startTime: draft.time.startISO,
        endTime: draft.time.endISO,
      };
      if (named.length > 0) {
        updates.resourceIds = named;
      }

      // Moving an event INTO an occupied slot is the same hazard as booking
      // one there. `target.id` is excluded, or an event would clash with the
      // place it already occupies.
      if (options.preventConflicts) {
        const clashes = overlappingEvents(
          scheduler,
          named.length > 0 ? named : previous.resourceIds,
          draft.time.startMs,
          draft.time.endMs,
          target.id,
        );
        if (clashes.length > 0) {
          return { ok: false, message: clashMessage(scheduler, clashes) };
        }
      }

      const moved = attempt(
        () => scheduler.updateEvent(target.id, updates),
        "I couldn't move that event.",
      );
      if (!moved.ok) return moved;

      const where =
        named.length > 0
          ? ` in ${[...draft.resources, ...draft.participants].map((m) => m.name).join(", ")}`
          : "";

      return {
        ok: true,
        summary: `Moved “${previous.title}” to ${shortWhen(draft.time.localDate, draft.time.localTime)}${where}`,
        undo: safely(() => scheduler.updateEvent(target.id, before)),
      };
    }

    case "get_details": {
      // If a specific event title was matched, show that event.
      if (draft.title) {
        const target = resolveTarget(scheduler, draft);
        if (target.ok) {
          const event = scheduler.getEvent(target.id);
          if (event) {
            const start = new Date(event.startTime);
            return {
              ok: true,
              summary: `${event.title} · ${start.toLocaleString()} · ${event.resourceIds.length} resource(s)`,
            };
          }
        }
      }

      // Otherwise summarise every event on the requested day.
      const targetDate =
        draft.time?.localDate ?? new Date().toISOString().slice(0, 10);
      const events = scheduler
        .getAllEvents()
        .filter((e) => e.startTime.slice(0, 10) === targetDate);

      const dayLabel = draft.time
        ? shortWhen(draft.time.localDate, "")
        : "today";
      if (events.length === 0) {
        return {
          ok: true,
          summary: `You have no events scheduled for ${dayLabel}.`,
        };
      }

      const list = events
        .map((e) => {
          const time = e.startTime.includes("T")
            ? e.startTime.split("T")[1].slice(0, 5)
            : "";
          return `${time ? time + " " : ""}“${e.title}”`;
        })
        .join(", ");

      return {
        ok: true,
        summary: `${events.length} event(s) on ${dayLabel}: ${list}`,
      };
    }

    default:
      return { ok: false, message: "I can't do that one yet." };
  }
}
