/**
 * The commit path — fast unit tests against an in-memory stub.
 *
 * WHAT THIS FILE CAN AND CANNOT PROVE
 *
 * The stub below is a plain Map. It is the right tool for the routing questions
 * — which intent does what, when is a commit refused, what does the summary
 * say, does undo call the inverse operation — and those are most of the surface.
 *
 * It is the WRONG tool for anything that depends on the real store's
 * behaviour, because a stub only reproduces what its author remembered to
 * reproduce:
 *
 *   - `schedulerStore.addEvent` THROWS on invalid data (`event.isValid()`).
 *   - It is a keyed map, so a duplicate id SILENTLY OVERWRITES.
 *
 * Testing either of those here would be circular: the stub would throw because
 * we wrote it to throw. They live in
 * `packages/core/tests/nlp-commit.integration.test.ts`, against a real
 * `SchedulerManager`, alongside the assertion that `SchedulerManager` still
 * satisfies `SchedulerPort`.
 */

import {
  commitSession,
  catalogFromResources,
  type EventInput,
  type SchedulerPort,
  type StoredEvent,
  type SessionState,
} from "../src";

// ── the stub ──────────────────────────────────────────────────────────────

interface Stub extends SchedulerPort {
  events: Map<string, StoredEvent>;
}

function makeScheduler(seed: StoredEvent[] = []): Stub {
  const events = new Map<string, StoredEvent>(seed.map((e) => [e.id, e]));
  const resources = new Map<string, { name: string }>([
    ["r1", { name: "Operating Room 1" }],
    ["r2", { name: "MRI Scanner A" }],
    ["p1", { name: "Dr. Sarah Chen" }],
  ]);

  return {
    events,
    addEvent(data: EventInput) {
      events.set(data.id, {
        id: data.id,
        title: data.title,
        startTime: data.startTime,
        endTime: data.endTime,
        resourceIds: data.resourceIds ?? [],
        status: data.status,
        description: data.description,
        color: data.color,
        allDay: data.allDay,
        recurrenceRule: data.recurrenceRule,
      });
      return { id: data.id };
    },
    updateEvent(id: string, updates: Partial<EventInput>) {
      const prev = events.get(id);
      if (prev) events.set(id, { ...prev, ...updates } as StoredEvent);
      return prev;
    },
    deleteEvent(id: string) {
      return events.delete(id);
    },
    getEvent: (id: string) => events.get(id),
    getAllEvents: () => [...events.values()],
    getResource: (id: string) => resources.get(id),
  };
}

// ── draft helpers ─────────────────────────────────────────────────────────

const TIME = {
  startISO: "2026-08-20T09:30:00.000Z",
  endISO: "2026-08-20T11:00:00.000Z",
  // Real `ResolvedTime` values always carry these; the stub used to omit
  // them, which silently disabled the conflict check under test.
  startMs: Date.parse("2026-08-20T09:30:00.000Z"),
  endMs: Date.parse("2026-08-20T11:00:00.000Z"),
  localDate: "2026-08-20",
  localTime: "15:00",
};

function readyState(over: Partial<SessionState["draft"]> = {}): SessionState {
  return {
    text: "x",
    utterances: ["x"],
    answers: [],
    status: "ready",
    rounds: 0,
    satisfied: [],
    skipped: [],
    corrections: [],
    question: null,
    reason: "ok",
    route: {
      intent: "add_event",
      confidence: 0.9,
      margin: 0.5,
      neighbours: [],
      normalizedFull: "",
      idsFull: [],
      normalizedVerb: "",
      idsVerb: [],
      route: "PROCEED",
      gate: null,
      reason: "ok",
    },
    draft: {
      intent: "add_event",
      title: "Knee surgery",
      time: TIME,
      resources: [],
      participants: [],
      ...over,
    },
  } as unknown as SessionState;
}

const stored = (over: Partial<StoredEvent> = {}): StoredEvent => ({
  id: "e1",
  title: "Consultation",
  startTime: "2026-08-20T09:00:00.000Z",
  endTime: "2026-08-20T10:00:00.000Z",
  resourceIds: ["r1"],
  status: "confirmed",
  description: "notes",
  color: "primary",
  allDay: false,
  recurrenceRule: "FREQ=WEEKLY",
  ...over,
});

// ══════════════════════════════════════════════════════════════════════════

describe("commitSession — refusals", () => {
  it("refuses a session that is not ready", () => {
    const s = makeScheduler();
    const state = { ...readyState(), status: "awaiting" } as SessionState;
    const r = commitSession(s, state, "r1");
    expect(r.ok).toBe(false);
    expect(s.events.size).toBe(0);
  });

  it("refuses when there is no resolved time", () => {
    const s = makeScheduler();
    const r = commitSession(s, readyState({ time: null }), "r1");
    expect(r.ok).toBe(false);
    expect(s.events.size).toBe(0);
  });

  it("refuses when there is nothing to schedule against", () => {
    const s = makeScheduler();
    const r = commitSession(s, readyState(), undefined);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain("no resources");
    expect(s.events.size).toBe(0);
  });
});

describe("commitSession — add_event", () => {
  it("attaches every named room AND person", () => {
    const s = makeScheduler();
    const r = commitSession(
      s,
      readyState({
        resources: [
          { id: "r1", name: "Operating Room 1" },
          { id: "r2", name: "MRI Scanner A" },
        ],
        participants: [{ id: "p1", name: "Dr. Sarah Chen" }],
      } as never),
      undefined,
    );

    expect(r.ok).toBe(true);
    const created = [...s.events.values()][0];
    expect(created.resourceIds).toEqual(["r1", "r2", "p1"]);
  });

  it("writes back exactly the ISO instants it was handed", () => {
    const s = makeScheduler();
    commitSession(s, readyState(), "r1");
    const created = [...s.events.values()][0];
    expect(created.startTime).toBe(TIME.startISO);
    expect(created.endTime).toBe(TIME.endISO);
  });

  it("falls back to the given row and says which one in the summary", () => {
    const s = makeScheduler();
    const r = commitSession(s, readyState(), "r1");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.summary).toContain("Operating Room 1");
      expect(r.summary).toContain("nothing named");
    }
    expect([...s.events.values()][0].resourceIds).toEqual(["r1"]);
  });

  it("undo removes the event it created", () => {
    const s = makeScheduler();
    const r = commitSession(s, readyState(), "r1");
    expect(s.events.size).toBe(1);
    if (r.ok) r.undo?.();
    expect(s.events.size).toBe(0);
  });
});

describe("commitSession — delete_event", () => {
  const deleting = (title?: string) =>
    readyState({ intent: "delete_event", title } as never);

  it("refuses when nothing matches", () => {
    const s = makeScheduler([stored()]);
    const r = commitSession(s, deleting("Nonexistent"), "r1");
    expect(r.ok).toBe(false);
    expect(s.events.size).toBe(1);
  });

  it("refuses when more than one matches, rather than guessing", () => {
    const s = makeScheduler([
      stored({ id: "a", title: "Review meeting" }),
      stored({ id: "b", title: "Review call" }),
    ]);
    const r = commitSession(s, deleting("Review"), "r1");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain("2 events");
    expect(s.events.size).toBe(2);
  });

  it("prefers an exact title match over a substring one", () => {
    const s = makeScheduler([
      stored({ id: "a", title: "Review" }),
      stored({ id: "b", title: "Review meeting" }),
    ]);
    const r = commitSession(s, deleting("Review"), "r1");
    expect(r.ok).toBe(true);
    expect(s.events.has("a")).toBe(false);
    expect(s.events.has("b")).toBe(true);
  });

  it("undo restores EVERY field, not a reconstruction", () => {
    const original = stored();
    const s = makeScheduler([original]);
    const r = commitSession(s, deleting("Consultation"), "r1");
    expect(s.events.size).toBe(0);

    if (r.ok) r.undo?.();
    const restored = s.events.get("e1");
    expect(restored).toEqual(original);
    // Named individually so a dropped field fails loudly rather than silently.
    expect(restored?.resourceIds).toEqual(["r1"]);
    expect(restored?.color).toBe("primary");
    expect(restored?.recurrenceRule).toBe("FREQ=WEEKLY");
    expect(restored?.description).toBe("notes");
    expect(restored?.status).toBe("confirmed");
    expect(restored?.allDay).toBe(false);
  });
});

describe("commitSession — modify_event", () => {
  const moving = (over: Record<string, unknown> = {}) =>
    readyState({
      intent: "modify_event",
      title: "Consultation",
      ...over,
    } as never);

  it("moves the event to the new instants", () => {
    const s = makeScheduler([stored()]);
    const r = commitSession(s, moving(), "r1");
    expect(r.ok).toBe(true);
    expect(s.events.get("e1")?.startTime).toBe(TIME.startISO);
  });

  it("leaves resources alone when the utterance named none", () => {
    const s = makeScheduler([stored()]);
    commitSession(s, moving(), "r1");
    expect(s.events.get("e1")?.resourceIds).toEqual(["r1"]);
  });

  it("undo puts the original times back", () => {
    const original = stored();
    const s = makeScheduler([original]);
    const r = commitSession(s, moving(), "r1");
    if (r.ok) r.undo?.();
    expect(s.events.get("e1")?.startTime).toBe(original.startTime);
    expect(s.events.get("e1")?.endTime).toBe(original.endTime);
  });
});

describe("commitSession — get_details writes nothing", () => {
  it("reports the day's events without touching the store", () => {
    const s = makeScheduler([
      stored({ id: "a", title: "Ward round" }),
      stored({ id: "b", title: "Consultation" }),
    ]);
    const before = new Map(s.events);

    const r = commitSession(
      s,
      readyState({ intent: "get_details", title: undefined } as never),
      "r1",
    );

    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.summary).toContain("2 event(s)");
      // A read is not reversible because it changed nothing.
      expect(r.undo).toBeUndefined();
    }
    expect(s.events).toEqual(before);
  });

  it("says so when the day is empty", () => {
    const s = makeScheduler();
    const r = commitSession(
      s,
      readyState({ intent: "get_details", title: undefined } as never),
      "r1",
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.summary).toContain("no events");
  });
});

describe("catalogFromResources", () => {
  it("splits people from rooms", () => {
    const c = catalogFromResources([
      { id: "r1", name: "Operating Room 1", type: "room" },
      { id: "p1", name: "Dr. Sarah Chen", type: "person" },
    ]);
    expect(c.resources.map((r) => r.id)).toEqual(["r1"]);
    expect(c.participants.map((p) => p.id)).toEqual(["p1"]);
  });

  it("adds the honorific-free form as an alias", () => {
    const c = catalogFromResources([
      { id: "p1", name: "Dr. Sarah Chen", type: "person" },
    ]);
    expect(c.participants[0].aliases).toEqual(["Sarah Chen"]);
  });

  it("adds no alias when there is no honorific to strip", () => {
    const c = catalogFromResources([
      { id: "p1", name: "Sarah Chen", type: "person" },
    ]);
    expect(c.participants[0].aliases).toBeUndefined();
  });
});

// ══════════════════════════════════════════════════════════════════════════
//  Identifying the target without a name
//
//  "cancel Operating Room 1 tomorrow at 2pm" names one room and one instant,
//  which identifies an event exactly as well as a title does. `resolveTarget`
//  looked only at the title, so it refused — and advised naming the event,
//  advice that did not work, because a bare event name does not classify as a
//  scheduling request. The user was left with no way forward at all.
// ══════════════════════════════════════════════════════════════════════════

describe("commitSession — target by room and time", () => {
  /** A resolved time with every field `resolveTarget` reads. */
  const at = (
    startISO: string,
    endISO: string,
    localDate: string,
    localTime: string,
    timeOfDayAssumed = false,
  ) => ({
    startISO,
    endISO,
    startMs: Date.parse(startISO),
    endMs: Date.parse(endISO),
    timezone: "UTC",
    localDate,
    localTime,
    weekday: "thursday",
    durationMinutes: 60,
    assumed: {
      date: false,
      timeOfDay: timeOfDayAssumed,
      duration: true,
      meridiem: false,
    },
    assumptions: [],
  });

  const cancelling = (time: ReturnType<typeof at>): SessionState =>
    readyState({
      intent: "delete_event",
      title: undefined,
      time,
      resources: [{ id: "r1", name: "Operating Room 1" }],
      participants: [],
    } as unknown as Partial<SessionState["draft"]>);

  const maintenance = stored({
    id: "e9",
    title: "Routine Maintenance #1261",
    startTime: "2026-08-20T14:00:00.000Z",
    endTime: "2026-08-20T15:00:00.000Z",
    resourceIds: ["r1"],
  });

  it("cancels the event covering the stated instant", () => {
    const scheduler = makeScheduler([maintenance]);
    const result = commitSession(
      scheduler,
      cancelling(
        at(
          "2026-08-20T14:00:00.000Z",
          "2026-08-20T15:00:00.000Z",
          "2026-08-20",
          "14:00",
        ),
      ),
      undefined,
    );
    expect(result.ok).toBe(true);
    expect(scheduler.events.has("e9")).toBe(false);
  });

  it("matches an instant INSIDE the event, not only its start", () => {
    const scheduler = makeScheduler([maintenance]);
    const result = commitSession(
      scheduler,
      cancelling(
        at(
          "2026-08-20T14:30:00.000Z",
          "2026-08-20T15:30:00.000Z",
          "2026-08-20",
          "14:30",
        ),
      ),
      undefined,
    );
    expect(result.ok).toBe(true);
  });

  it("refuses when nothing is booked then, and says so", () => {
    const scheduler = makeScheduler([maintenance]);
    const result = commitSession(
      scheduler,
      cancelling(
        at(
          "2026-08-20T20:00:00.000Z",
          "2026-08-20T21:00:00.000Z",
          "2026-08-20",
          "20:00",
        ),
      ),
      undefined,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain("Operating Room 1");
      expect(scheduler.events.size).toBe(1);
    }
  });

  it("ignores events on a DIFFERENT resource", () => {
    const elsewhere = stored({
      id: "e8",
      title: "Scan",
      startTime: "2026-08-20T14:00:00.000Z",
      endTime: "2026-08-20T15:00:00.000Z",
      resourceIds: ["r2"],
    });
    const scheduler = makeScheduler([elsewhere]);
    const result = commitSession(
      scheduler,
      cancelling(
        at(
          "2026-08-20T14:00:00.000Z",
          "2026-08-20T15:00:00.000Z",
          "2026-08-20",
          "14:00",
        ),
      ),
      undefined,
    );
    expect(result.ok).toBe(false);
    expect(scheduler.events.has("e8")).toBe(true);
  });

  it("falls back to the whole day when no time of day was stated", () => {
    // The 09:00 default is this layer's invention and must not be used to pick
    // an event. A day with exactly one booking is still unambiguous.
    const scheduler = makeScheduler([maintenance]);
    const result = commitSession(
      scheduler,
      cancelling(
        at(
          "2026-08-20T09:00:00.000Z",
          "2026-08-20T10:00:00.000Z",
          "2026-08-20",
          "09:00",
          true,
        ),
      ),
      undefined,
    );
    expect(result.ok).toBe(true);
    expect(scheduler.events.has("e9")).toBe(false);
  });

  it("refuses rather than guessing when the day holds several", () => {
    const scheduler = makeScheduler([
      maintenance,
      stored({
        id: "e10",
        title: "Deep Clean",
        startTime: "2026-08-20T17:00:00.000Z",
        endTime: "2026-08-20T18:00:00.000Z",
        resourceIds: ["r1"],
      }),
    ]);
    const result = commitSession(
      scheduler,
      cancelling(
        at(
          "2026-08-20T09:00:00.000Z",
          "2026-08-20T10:00:00.000Z",
          "2026-08-20",
          "09:00",
          true,
        ),
      ),
      undefined,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain("Routine Maintenance #1261");
      expect(result.message).toContain("Deep Clean");
    }
    expect(scheduler.events.size).toBe(2);
  });

  it("still prefers an explicit title over room and time", () => {
    const scheduler = makeScheduler([
      maintenance,
      stored({
        id: "e11",
        title: "Deep Clean",
        startTime: "2026-08-20T14:00:00.000Z",
        endTime: "2026-08-20T15:00:00.000Z",
        resourceIds: ["r1"],
      }),
    ]);
    const state = readyState({
      intent: "delete_event",
      title: "Deep Clean",
      time: at(
        "2026-08-20T14:00:00.000Z",
        "2026-08-20T15:00:00.000Z",
        "2026-08-20",
        "14:00",
      ),
      resources: [{ id: "r1", name: "Operating Room 1" }],
      participants: [],
    } as unknown as Partial<SessionState["draft"]>);

    const result = commitSession(scheduler, state, undefined);
    expect(result.ok).toBe(true);
    expect(scheduler.events.has("e11")).toBe(false);
    expect(scheduler.events.has("e9")).toBe(true);
  });

  it("refuses with usable advice when it has neither name nor room", () => {
    const scheduler = makeScheduler([maintenance]);
    const state = readyState({
      intent: "delete_event",
      title: undefined,
      time: at(
        "2026-08-20T14:00:00.000Z",
        "2026-08-20T15:00:00.000Z",
        "2026-08-20",
        "14:00",
      ),
      resources: [],
      participants: [],
    } as unknown as Partial<SessionState["draft"]>);

    const result = commitSession(scheduler, state, undefined);
    expect(result.ok).toBe(false);
    // The advice has to be a phrasing that actually works when typed back.
    if (!result.ok) expect(result.message).toMatch(/cancel .* at /i);
    expect(scheduler.events.size).toBe(1);
  });
});

// ══════════════════════════════════════════════════════════════════════════
//  A title that matches nothing must not end the search
//
//  "cancel the Dr. Michael Ross event today at 1pm" produced a title of
//  "event", and `resolveTarget` gave up on it — while holding the person and
//  the time that identify the event exactly. Found in the Phase K browser run.
// ══════════════════════════════════════════════════════════════════════════

describe("commitSession — a useless title falls back to room and time", () => {
  const at = (startISO: string, endISO: string) => ({
    startISO,
    endISO,
    startMs: Date.parse(startISO),
    endMs: Date.parse(endISO),
    timezone: "UTC",
    localDate: "2026-08-20",
    localTime: "14:00",
    weekday: "thursday",
    durationMinutes: 60,
    assumed: { date: false, timeOfDay: false, duration: true, meridiem: false },
    assumptions: [],
  });
  const time = at("2026-08-20T14:00:00.000Z", "2026-08-20T15:00:00.000Z");
  const target = stored({
    id: "e9",
    title: "Pre-op Assessment",
    startTime: "2026-08-20T14:00:00.000Z",
    endTime: "2026-08-20T15:00:00.000Z",
    resourceIds: ["r1"],
  });
  const cancelling = (title: string | undefined): SessionState =>
    readyState({
      intent: "delete_event",
      title,
      time,
      resources: [{ id: "r1", name: "Operating Room 1" }],
      participants: [],
    } as unknown as Partial<SessionState["draft"]>);

  it("finds the event when the title matches nothing", () => {
    const scheduler = makeScheduler([target]);
    const result = commitSession(scheduler, cancelling("event"), undefined);
    expect(result.ok).toBe(true);
    expect(scheduler.events.has("e9")).toBe(false);
  });

  it("still prefers a title that DOES match", () => {
    const other = stored({
      id: "e8",
      title: "Deep Clean",
      startTime: "2026-08-20T14:00:00.000Z",
      endTime: "2026-08-20T15:00:00.000Z",
      resourceIds: ["r1"],
    });
    const scheduler = makeScheduler([target, other]);
    const result = commitSession(
      scheduler,
      cancelling("Deep Clean"),
      undefined,
    );
    expect(result.ok).toBe(true);
    expect(scheduler.events.has("e8")).toBe(false);
    expect(scheduler.events.has("e9")).toBe(true);
  });

  it("names the title it could not find when nothing else matches either", () => {
    const scheduler = makeScheduler([]);
    const result = commitSession(scheduler, cancelling("Nonesuch"), undefined);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("Nonesuch");
  });
});

// ══════════════════════════════════════════════════════════════════════════
//  Conflict prevention  (Phase K · K3)
//
//  Found in the Phase K browser run: with `preventConflicts` ON the timeline
//  refused a double-booking and the CHAT created it anyway. `commitSession`
//  had no conflict check at all — the word did not appear in the file.
// ══════════════════════════════════════════════════════════════════════════

describe("commitSession — preventConflicts", () => {
  const occupant = stored({
    id: "busy",
    title: "Ward Round",
    // TIME is 09:30–11:00 UTC, so this overlaps it.
    startTime: "2026-08-20T10:00:00.000Z",
    endTime: "2026-08-20T10:30:00.000Z",
    resourceIds: ["r1"],
  });
  const booking = () =>
    readyState({
      resources: [{ id: "r1", name: "Operating Room 1" }],
    } as never);

  it("refuses a clashing booking when the host says to", () => {
    const scheduler = makeScheduler([occupant]);
    const result = commitSession(scheduler, booking(), undefined, {
      preventConflicts: true,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain("Ward Round");
      expect(result.message).toContain("Operating Room 1");
    }
    // and nothing was written
    expect(scheduler.events.size).toBe(1);
  });

  it("allows it when the host has not asked for prevention", () => {
    // The default posture is warn-not-block, matching `preventConflicts=false`
    // on the timeline.
    const scheduler = makeScheduler([occupant]);
    expect(commitSession(scheduler, booking(), undefined).ok).toBe(true);
    expect(scheduler.events.size).toBe(2);
  });

  it("ignores an event on a DIFFERENT row", () => {
    const elsewhere = stored({ ...occupant, id: "other", resourceIds: ["r2"] });
    const scheduler = makeScheduler([elsewhere]);
    const result = commitSession(scheduler, booking(), undefined, {
      preventConflicts: true,
    });
    expect(result.ok).toBe(true);
  });

  it("ignores one that merely touches the edge", () => {
    // Half-open overlap, same as core's `checkSlotConflict`: back-to-back
    // bookings do not clash.
    const abutting = stored({
      id: "abut",
      title: "Earlier",
      startTime: "2026-08-20T08:00:00.000Z",
      endTime: "2026-08-20T09:30:00.000Z",
      resourceIds: ["r1"],
    });
    const scheduler = makeScheduler([abutting]);
    const result = commitSession(scheduler, booking(), undefined, {
      preventConflicts: true,
    });
    expect(result.ok).toBe(true);
  });

  it("ignores a cancelled event", () => {
    const gone = stored({ ...occupant, id: "gone", status: "cancelled" });
    const scheduler = makeScheduler([gone]);
    const result = commitSession(scheduler, booking(), undefined, {
      preventConflicts: true,
    });
    expect(result.ok).toBe(true);
  });
});
