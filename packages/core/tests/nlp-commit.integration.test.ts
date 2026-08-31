/**
 * `@janus-scheduler/nlp`'s commit path, against a REAL manager and store.
 *
 * ── Why this file exists in core rather than in nlp ───────────────────────
 *
 * `commitSession` lives in `@janus-scheduler/nlp` and reaches a scheduler only
 * through a structural `SchedulerPort`, so that nlp keeps zero runtime
 * dependencies. The price of that indirection is two things a test inside nlp
 * cannot cover:
 *
 *  1. **Drift.** nlp type-checks against its own interface, so core could
 *     change `SchedulerManager` and nlp would still compile. The `_conformance`
 *     assertion below is the guard, and it is a COMPILE-TIME check — which is
 *     why `npm test` in this package now runs `tsc -p tsconfig.tests.json`
 *     first. `jest.config.cjs` sets `diagnostics: false`, so Jest alone would
 *     never see it.
 *
 *  2. **Real store behaviour.** `schedulerStore.addEvent` throws on invalid
 *     data and silently overwrites on a duplicate id. A stub in nlp only
 *     reproduces what its author remembered, so asserting those there would be
 *     circular — the stub would throw because we wrote it to throw.
 *
 * nlp is a devDependency of this package, used by this file only. Core's
 * runtime dependencies are unchanged.
 */

import {
  commitSession,
  type SchedulerPort,
  type SessionState,
} from "@janus-scheduler/nlp";

import { SchedulerManager } from "../src/services/SchedulerManager.service";
import { schedulerStore } from "../src/store/scheduler.store";

/**
 * THE DRIFT GUARD.
 *
 * If someone changes a signature on `SchedulerManager` that `commitSession`
 * depends on, this line stops compiling and `npm test` fails here — instead of
 * the mismatch surfacing in a demo build, or at runtime, or not at all.
 */
const _conformance: SchedulerPort = {} as SchedulerManager;
void _conformance;

const TIME = {
  startISO: "2026-08-20T09:30:00.000Z",
  endISO: "2026-08-20T11:00:00.000Z",
  localDate: "2026-08-20",
  localTime: "15:00",
};

function readyState(over: Record<string, unknown> = {}): SessionState {
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
    route: { route: "PROCEED", gate: null, confidence: 0.9, margin: 0.5 },
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

let manager: SchedulerManager;

beforeEach(() => {
  schedulerStore.getState().clearAll();
  manager = new SchedulerManager();
  manager.addResource({ id: "r1", name: "Operating Room 1", type: "room" });
  manager.addResource({ id: "r2", name: "MRI Scanner A", type: "equipment" });
  manager.addResource({ id: "p1", name: "Dr. Sarah Chen", type: "person" });
});

// ══════════════════════════════════════════════════════════════════════════
//  Facts about the real store that a stub cannot reproduce.
//
//  These document WHY `commitSession` needs the guards Step K1 adds. They stay
//  true after K1 — the store still throws, K1 just stops the throw escaping.
// ══════════════════════════════════════════════════════════════════════════

describe("the real store, as commitSession finds it", () => {
  it("THROWS on an event with no resource, rather than returning an error", () => {
    expect(() =>
      manager.addEvent({
        id: "bad",
        title: "No resource",
        startTime: TIME.startISO,
        endTime: TIME.endISO,
        resourceIds: [],
      }),
    ).toThrow(/Invalid event data/);
  });

  it("THROWS on an event with no title", () => {
    expect(() =>
      manager.addEvent({
        id: "bad",
        title: "",
        startTime: TIME.startISO,
        endTime: TIME.endISO,
        resourceIds: ["r1"],
      }),
    ).toThrow(/Invalid event data/);
  });

  it("THROWS when the event ends before it starts", () => {
    // The half of the K1 proof that lives in the store: this is the exact
    // payload the "converts the store's throw" test drives through
    // `commitSession`. If this stops throwing, that test stops proving
    // anything, and this one fails first to say so.
    expect(() =>
      manager.addEvent({
        id: "inverted",
        title: "Backwards",
        startTime: "2026-08-20T11:00:00.000Z",
        endTime: "2026-08-20T09:30:00.000Z",
        resourceIds: ["r1"],
      }),
    ).toThrow(/Invalid event data/);
  });

  it("SILENTLY OVERWRITES a duplicate id instead of erroring", () => {
    const base = {
      startTime: TIME.startISO,
      endTime: TIME.endISO,
      resourceIds: ["r1"],
    };
    manager.addEvent({ id: "same", title: "First", ...base });
    manager.addEvent({ id: "same", title: "Second", ...base });

    // One event, and the first one is gone. This is why Step K1 replaces
    // `nlp_${Date.now()}` — two commits inside one millisecond destroy data.
    expect(manager.getAllEvents()).toHaveLength(1);
    expect(manager.getEvent("same")?.title).toBe("Second");
  });
});

// ══════════════════════════════════════════════════════════════════════════
//  Step K1 — commitSession survives what the store does above.
//
//  These are the tests that could not live in nlp: each one depends on the
//  REAL store throwing, or the real store overwriting. A stub would only
//  reproduce what its author remembered to reproduce.
// ══════════════════════════════════════════════════════════════════════════

describe("K1 — a failed commit is a message, not a crash", () => {
  /**
   * THE test for the guard.
   *
   * `Event.isValid()` also rejects `start >= end`, and `commitSession` does not
   * check that itself — so an inverted draft reaches `store.addEvent` and the
   * store throws. That is a genuine path through the real code, no stub and no
   * spy: before K1 this throw escaped `commitSession`, escaped
   * `ChatController.confirm()`, and landed in the host framework.
   */
  it("converts the store's throw into a readable refusal", () => {
    const inverted = readyState({
      time: {
        ...TIME,
        startISO: "2026-08-20T11:00:00.000Z",
        endISO: "2026-08-20T09:30:00.000Z", // ends before it starts
      },
    });

    let result: ReturnType<typeof commitSession> | undefined;
    expect(() => {
      result = commitSession(manager, inverted, "r1");
    }).not.toThrow();

    expect(result?.ok).toBe(false);
    if (result && !result.ok) {
      expect(result.message).toMatch(/couldn't add/i);
      // The store's own words are kept, so a bug report has something to go on.
      expect(result.message).toMatch(/Invalid event data/i);
    }
    expect(manager.getAllEvents()).toHaveLength(0);
  });

  it("refuses before reaching the store when there is nothing to book against", () => {
    // The early guard, not the wrapper — `resourceIds` would be empty.
    const result = commitSession(manager, readyState(), undefined);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/resources/i);
    expect(manager.getAllEvents()).toHaveLength(0);
  });

  it("never lets an undo throw into the host", () => {
    const result = commitSession(manager, readyState(), "r1");
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    result.undo?.();
    // Second undo has nothing left to remove. It must be inert, not explosive —
    // `ChatController.undo()` calls these with no try/catch.
    expect(() => result.undo?.()).not.toThrow();
    expect(manager.getAllEvents()).toHaveLength(0);
  });
});

describe("K1 — ids are unique, and never overwrite", () => {
  it("two commits in the same millisecond produce two events", () => {
    const before = Date.now();
    const a = commitSession(manager, readyState(), "r1");
    const b = commitSession(manager, readyState(), "r1");
    const elapsed = Date.now() - before;

    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    // The point of the test only holds if they really were close together.
    expect(elapsed).toBeLessThan(50);
    expect(manager.getAllEvents()).toHaveLength(2);
  });

  it("many rapid commits never lose one", () => {
    for (let i = 0; i < 25; i++) commitSession(manager, readyState(), "r1");
    expect(manager.getAllEvents()).toHaveLength(25);

    const ids = new Set(manager.getAllEvents().map((e) => e.id));
    expect(ids.size).toBe(25);
  });

  it("does not overwrite an event that already holds the generated id", () => {
    const first = commitSession(manager, readyState(), "r1");
    expect(first.ok).toBe(true);
    const existingId = manager.getAllEvents()[0].id;

    const second = commitSession(manager, readyState(), "r1");
    expect(second.ok).toBe(true);

    // Both survive, and the original is untouched.
    expect(manager.getAllEvents()).toHaveLength(2);
    expect(manager.getEvent(existingId)).toBeDefined();
  });
});

// ══════════════════════════════════════════════════════════════════════════
//  commitSession against the real manager
// ══════════════════════════════════════════════════════════════════════════

describe("commitSession — add_event", () => {
  it("attaches every named room AND person, first as the primary", () => {
    const result = commitSession(
      manager,
      readyState({
        resources: [
          { id: "r1", name: "Operating Room 1" },
          { id: "r2", name: "MRI Scanner A" },
        ],
        participants: [{ id: "p1", name: "Dr. Sarah Chen" }],
      }),
      undefined,
    );

    expect(result.ok).toBe(true);
    const [created] = manager.getAllEvents();
    expect(created.resourceIds).toEqual(["r1", "r2", "p1"]);
    // `Event` derives `resourceId` from the array — pinned so a change there
    // cannot silently reassign chat-created events to a different row.
    expect(created.resourceId).toBe("r1");
  });

  it("stores exactly the instants it was handed", () => {
    commitSession(manager, readyState(), "r1");
    const [created] = manager.getAllEvents();
    expect(created.startTime).toBe(TIME.startISO);
    expect(created.endTime).toBe(TIME.endISO);
  });

  it("uses the fallback row and names it in the summary", () => {
    const result = commitSession(manager, readyState(), "r1");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.summary).toContain("Operating Room 1");
      expect(result.summary).toContain("nothing named");
    }
    expect(manager.getAllEvents()[0].resourceIds).toEqual(["r1"]);
  });

  it("undo removes it from the real store", () => {
    const result = commitSession(manager, readyState(), "r1");
    expect(manager.getAllEvents()).toHaveLength(1);
    if (result.ok) result.undo?.();
    expect(manager.getAllEvents()).toHaveLength(0);
  });
});

describe("commitSession — delete_event", () => {
  beforeEach(() => {
    manager.addEvent({
      id: "e1",
      title: "Consultation",
      startTime: "2026-08-20T09:00:00.000Z",
      endTime: "2026-08-20T10:00:00.000Z",
      resourceIds: ["r1", "p1"],
      status: "confirmed",
      description: "pre-op notes",
      color: "primary",
      recurrenceRule: "FREQ=WEEKLY",
    });
  });

  it("refuses when two events match, rather than deleting the wrong one", () => {
    manager.addEvent({
      id: "e2",
      title: "Consultation follow-up",
      startTime: "2026-08-21T09:00:00.000Z",
      endTime: "2026-08-21T10:00:00.000Z",
      resourceIds: ["r1"],
    });

    const result = commitSession(
      manager,
      readyState({ intent: "delete_event", title: "Consult" }),
      "r1",
    );

    expect(result.ok).toBe(false);
    expect(manager.getAllEvents()).toHaveLength(2);
  });

  it("undo restores every field through the real store", () => {
    const before = manager.getEvent("e1")!;
    const snapshot = {
      resourceIds: [...before.resourceIds],
      description: before.description,
      color: before.color,
      recurrenceRule: before.recurrenceRule,
      status: before.status,
    };

    const result = commitSession(
      manager,
      readyState({ intent: "delete_event", title: "Consultation" }),
      "r1",
    );
    expect(result.ok).toBe(true);
    expect(manager.getEvent("e1")).toBeUndefined();

    if (result.ok) result.undo?.();

    const after = manager.getEvent("e1");
    expect(after).toBeDefined();
    expect(after!.resourceIds).toEqual(snapshot.resourceIds);
    expect(after!.description).toBe(snapshot.description);
    expect(after!.color).toBe(snapshot.color);
    expect(after!.recurrenceRule).toBe(snapshot.recurrenceRule);
    expect(after!.status).toBe(snapshot.status);
  });
});

describe("commitSession — modify_event", () => {
  beforeEach(() => {
    manager.addEvent({
      id: "e1",
      title: "Consultation",
      startTime: "2026-08-20T06:00:00.000Z",
      endTime: "2026-08-20T07:00:00.000Z",
      resourceIds: ["r1"],
    });
  });

  it("moves it and undo puts the original times back", () => {
    const before = manager.getEvent("e1")!;
    const originalStart = before.startTime;
    const originalEnd = before.endTime;

    const result = commitSession(
      manager,
      readyState({ intent: "modify_event", title: "Consultation" }),
      "r1",
    );

    expect(result.ok).toBe(true);
    expect(manager.getEvent("e1")!.startTime).toBe(TIME.startISO);

    if (result.ok) result.undo?.();
    expect(manager.getEvent("e1")!.startTime).toBe(originalStart);
    expect(manager.getEvent("e1")!.endTime).toBe(originalEnd);
  });
});

describe("commitSession — get_details never writes", () => {
  it("reports without changing the store", () => {
    manager.addEvent({
      id: "e1",
      title: "Ward round",
      startTime: "2026-08-20T09:00:00.000Z",
      endTime: "2026-08-20T10:00:00.000Z",
      resourceIds: ["r1"],
    });
    const before = manager.getAllEvents().length;

    const result = commitSession(
      manager,
      readyState({ intent: "get_details", title: undefined }),
      "r1",
    );

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.undo).toBeUndefined();
    expect(manager.getAllEvents()).toHaveLength(before);
  });
});
