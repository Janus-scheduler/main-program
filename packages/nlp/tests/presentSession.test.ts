import {
  presentSession,
  assumptionNotes,
  cardWarnings,
  getConfidenceLabel,
  getConfirmLabel,
  getEditLabel,
} from "../src/presentSession";
import type { SessionState } from "../src/types";

describe("presentSession intent-aware formatting in @janus-scheduler/nlp", () => {
  const baseSessionState: SessionState = {
    text: "what about today schedule",
    utterances: ["what about today schedule"],
    answers: [],
    status: "ready",
    rounds: 0,
    totalRounds: 0,
    satisfied: [],
    skipped: [],
    corrections: [],
    question: null,
    reason: "confident, unambiguous",
    route: {
      intent: "get_details",
      confidence: 0.924,
      margin: 0.924,
      route: "PROCEED",
      gate: null,
      reason: "confident, unambiguous",
      normalizedFull: "what about schedule",
      idsFull: [1060, 1061, 5140],
      normalizedVerb: "what",
      idsVerb: [1060],
      neighbours: [],
    },
    draft: {
      intent: "get_details",
      title: "schedule",
      timeSpan: {
        text: "today",
        start: 0,
        end: 5,
        mentions: [
          {
            text: "today",
            start: 0,
            end: 5,
            kind: "today",
          },
        ],
        date: { kind: "today" },
      },
      time: {
        startISO: "2026-08-10T09:00:00.000Z",
        endISO: "2026-08-10T10:00:00.000Z",
        startMs: new Date("2026-08-10T09:00:00.000Z").getTime(),
        endMs: new Date("2026-08-10T10:00:00.000Z").getTime(),
        timezone: "UTC",
        localDate: "2026-08-10",
        localTime: "09:00",
        weekday: "monday",
        durationMinutes: 60,
        assumed: {
          date: false,
          timeOfDay: true,
          duration: true,
          meridiem: false,
        },
        assumptions: [
          "no time of day given — assumed 09:00",
          "no duration given — assumed 60 minutes",
        ],
      },
      resources: [],
      participants: [],
    },
  };

  test("correctly formats get_details query card", () => {
    const msg = presentSession(baseSessionState, "m1", {
      fallbackResourceName: "Dr. Sarah Chen",
    });

    expect(msg).not.toBeNull();
    expect(msg?.kind).toBe("parse");
    if (msg?.kind === "parse") {
      expect(msg.card.lead).toBe("Looking up schedule —");
      expect(msg.card.confidenceLabel).toBe("sure this is a schedule lookup");
      expect(msg.card.confirmLabel).toBe("View schedule");
      expect(msg.card.editLabel).toBe("Edit");

      // Verify dummy booking assumptions are suppressed for get_details
      expect(msg.card.notes).toHaveLength(0);

      // Verify no fallback resource chip is forced for get_details
      const placeChips = msg.card.chips.filter((c) => c.kind === "place");
      expect(placeChips).toHaveLength(0);
    }
  });

  test("correctly formats add_event booking card", () => {
    const addState: SessionState = {
      ...baseSessionState,
      route: { ...baseSessionState.route, intent: "add_event" },
      draft: { ...baseSessionState.draft!, intent: "add_event" },
    };

    const msg = presentSession(addState, "m2", {
      fallbackResourceName: "Dr. Sarah Chen",
    });

    expect(msg?.kind).toBe("parse");
    if (msg?.kind === "parse") {
      expect(msg.card.lead).toBe("Here's what I understood —");
      expect(msg.card.confidenceLabel).toBe("sure this is a booking");
      expect(msg.card.confirmLabel).toBe("Confirm & schedule");

      // Verify booking assumptions ARE present for add_event
      expect(msg.card.notes).toContain("no time of day given — assumed 09:00");
      expect(msg.card.notes).toContain(
        "no room or person named — it will go to Dr. Sarah Chen",
      );

      // Verify fallback resource chip is present for add_event
      const placeChips = msg.card.chips.filter((c) => c.kind === "place");
      expect(placeChips).toHaveLength(1);
      expect(placeChips[0].label).toBe("Dr. Sarah Chen");
    }
  });

  test("correctly formats delete_event card", () => {
    const deleteState: SessionState = {
      ...baseSessionState,
      route: { ...baseSessionState.route, intent: "delete_event" },
      draft: { ...baseSessionState.draft!, intent: "delete_event" },
    };

    const msg = presentSession(deleteState, "m3");

    expect(msg?.kind).toBe("parse");
    if (msg?.kind === "parse") {
      expect(msg.card.lead).toBe("Cancel this event —");
      expect(msg.card.confidenceLabel).toBe("sure this is a cancellation");
      expect(msg.card.confirmLabel).toBe("Cancel event");
      expect(msg.card.editLabel).toBe("Keep it");
      expect(msg.card.destructive).toBe(true);
    }
  });

  test("label helper utility functions", () => {
    expect(getConfidenceLabel("add_event")).toBe("sure this is a booking");
    expect(getConfidenceLabel("delete_event")).toBe(
      "sure this is a cancellation",
    );
    expect(getConfidenceLabel("get_details")).toBe(
      "sure this is a schedule lookup",
    );

    expect(getConfirmLabel("add_event")).toBe("Confirm & schedule");
    expect(getConfirmLabel("delete_event")).toBe("Cancel event");
    expect(getConfirmLabel("get_details")).toBe("View schedule");

    expect(getEditLabel("delete_event")).toBe("Keep it");
    expect(getEditLabel("add_event")).toBe("Edit");
  });

  test("clarify cards (awaiting) show ONLY confirmed user chips", () => {
    const clarifyState: SessionState = {
      ...baseSessionState,
      status: "awaiting",
      question: {
        slot: "when",
        gate: null,
        source: "requirement",
        skippable: true,
        text: "When should MRI Scanner A be?",
        choices: [{ id: "c1", label: "Today", value: "today" }],
      },
      draft: {
        intent: "add_event",
        title: undefined,
        time: {
          startISO: "2026-08-10T09:00:00.000Z",
          endISO: "2026-08-10T10:00:00.000Z",
          startMs: 12345,
          endMs: 23456,
          durationMinutes: 60,
          timezone: "UTC",
          localDate: "2026-08-10",
          localTime: "09:00",
          weekday: "monday",
          assumed: {
            date: false,
            timeOfDay: true, // assumed!
            duration: true, // assumed!
            meridiem: false,
          },
          assumptions: ["assumed 09:00"],
        },
        resources: [
          {
            id: "mri-a",
            name: "MRI Scanner A",
            type: "room",
            exact: true,
            start: 0,
            end: 13,
            text: "MRI Scanner A",
          },
        ],
        participants: [],
      },
    };

    const msg = presentSession(clarifyState, "c1", {
      fallbackResourceName: "Dr. Sarah Chen",
    });
    expect(msg?.kind).toBe("clarify");
    if (msg?.kind === "clarify") {
      // Only the confirmed resource chip is present
      expect(msg.chips).toEqual([
        {
          kind: "place",
          label: "MRI Scanner A",
        },
      ]);
    }
  });

  test("defaults untitled add_event parse card title to 'New Event'", () => {
    const untitledState: SessionState = {
      ...baseSessionState,
      status: "ready",
      draft: {
        ...baseSessionState.draft!,
        intent: "add_event",
        title: undefined,
      },
    };
    const msg = presentSession(untitledState, "c2");
    expect(msg?.kind).toBe("parse");
    if (msg?.kind === "parse") {
      expect(msg.card.title).toBe("New Event");
    }
  });

  /**
   * Step K2b — the calendar's display timezone persists once someone sets it
   * in the event modal. The chat then resolves "3pm" in THAT zone, which is
   * right (it is the zone on screen) but can be hours from what the user
   * pictured. The card says so rather than letting it pass silently.
   */
  /**
   * REGRESSION — the assistant said "Got it" about an answer it had rejected,
   * then asked the identical question again with no explanation.
   *
   * `provideAnswer` has always set `state.unresolved` on the five paths where a
   * reply cannot be used, but `presentSession` read it in the `declined`
   * branch — a state it is never set on — so the recovery lead was dead code
   * and the acknowledgement fired unconditionally.
   */
  describe("an answer that could not be used", () => {
    const reAsking = (slot: string, unresolved?: string): SessionState =>
      ({
        ...baseSessionState,
        status: "awaiting",
        unresolved,
        answers: [
          { slot, gate: null, source: "requirement", answer: "sometime soon" },
        ],
        question: {
          slot,
          gate: null,
          source: "requirement",
          skippable: true,
          text: "When would you like that?",
          choices: [],
        },
      }) as unknown as SessionState;

    it("does not say 'Got it' about an answer it rejected", () => {
      const msg = presentSession(reAsking("when", "when"), "r1");
      expect(msg?.kind).toBe("clarify");
      if (msg?.kind === "clarify") {
        expect(msg.ack).toBeUndefined();
        expect(msg.lead).toBeDefined();
        expect(msg.lead).toContain("didn't catch a time");
      }
    });

    it("still acknowledges an answer that WAS used", () => {
      const msg = presentSession(reAsking("when"), "r2");
      if (msg?.kind === "clarify") {
        expect(msg.ack).toContain("Got it");
        expect(msg.lead).toBeUndefined();
      }
    });

    it("acknowledges normally when a DIFFERENT slot failed earlier", () => {
      // `unresolved` is about the slot being asked now. A stale value from an
      // earlier slot must not suppress a legitimate acknowledgement.
      const msg = presentSession(reAsking("resource", "when"), "r3");
      if (msg?.kind === "clarify") {
        expect(msg.ack).toContain("Got it");
        expect(msg.lead).toBeUndefined();
      }
    });

    it.each([
      ["when", "didn't catch a time"],
      ["duration", "didn't catch a length"],
      ["resource", "anyone or anywhere"],
      ["title", "need a name"],
      ["intent", "Pick one"],
      ["confirm", "yes or a no"],
    ])("explains itself for the %s slot", (slot, fragment) => {
      const msg = presentSession(reAsking(slot, slot), "r4");
      if (msg?.kind === "clarify") {
        expect(msg.ack).toBeUndefined();
        expect(msg.lead).toContain(fragment);
      }
    });

    it("never shows both an ack and a lead", () => {
      for (const slot of ["when", "duration", "resource", "title"]) {
        for (const unresolved of [undefined, slot, "confirm"]) {
          const msg = presentSession(reAsking(slot, unresolved), "r5");
          if (msg?.kind === "clarify") {
            expect(Boolean(msg.ack) && Boolean(msg.lead)).toBe(false);
          }
        }
      }
    });
  });

  describe("timezone warning", () => {
    // 2026-08-20T06:00:00Z — 15:00 in Tokyo, 11:30 in Colombo, 06:00 UTC.
    const startMs = Date.parse("2026-08-20T06:00:00.000Z");

    const inZone = (timezone: string): SessionState =>
      ({
        ...baseSessionState,
        draft: {
          ...baseSessionState.draft!,
          intent: "add_event",
          title: "Knee surgery",
          time: {
            ...baseSessionState.draft!.time!,
            timezone,
            startMs,
          },
        },
      }) as SessionState;

    it("warns when the display zone is not the device zone", () => {
      const warnings = cardWarnings(inZone("Asia/Tokyo"), {
        deviceTimezone: "Asia/Colombo",
      });
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain("Tokyo");
      expect(warnings[0]).toContain("Colombo");
      // The whole point is the conversion, so both clock times must appear.
      expect(warnings[0]).toContain("3:00 PM");
      expect(warnings[0]).toContain("11:30 AM");
    });

    it("says nothing when the zones match", () => {
      expect(
        cardWarnings(inZone("Asia/Tokyo"), { deviceTimezone: "Asia/Tokyo" }),
      ).toEqual([]);
    });

    it("says nothing when the wall-clock time is the same anyway", () => {
      // Different zone names, identical offset in August — a warning nobody
      // could act on is noise.
      const warnings = cardWarnings(inZone("Europe/Lisbon"), {
        deviceTimezone: "Europe/London",
      });
      expect(warnings).toEqual([]);
    });

    it("says nothing when the host did not supply a device zone", () => {
      expect(cardWarnings(inZone("Asia/Tokyo"), {})).toEqual([]);
    });

    it("reaches the rendered card", () => {
      const msg = presentSession(inZone("Asia/Tokyo"), "w1", {
        deviceTimezone: "Asia/Colombo",
      });
      expect(msg?.kind).toBe("parse");
      if (msg?.kind === "parse") {
        expect(msg.card.warnings).toHaveLength(1);
        // Confirm is never taken away — the user still decides.
        expect(msg.card.confirmLabel).toBeTruthy();
      }
    });
  });

  /**
   * The fallback title is a guess like any other, so it has to be visible.
   * It used to be printed as though the user had supplied it.
   */
  describe("the fallback title is disclosed", () => {
    const untitled = (skipped: string[] = []): SessionState => ({
      ...baseSessionState,
      skipped: skipped as SessionState["skipped"],
      draft: {
        ...baseSessionState.draft!,
        intent: "add_event",
        title: undefined,
      },
    });

    it("says so when no name was given", () => {
      const notes = assumptionNotes(untitled(), {});
      expect(notes.join(" ")).toContain("New Event");
      expect(notes.join(" ")).toContain("no name given");
    });

    it("says so differently when the user skipped the question", () => {
      const notes = assumptionNotes(untitled(["title"]), {});
      expect(notes.join(" ")).toContain("you skipped the name");
    });

    it("says nothing when the event has a real name", () => {
      const notes = assumptionNotes(baseSessionState, {});
      expect(notes.join(" ")).not.toContain("New Event");
    });
  });

  describe("declined state formatting", () => {
    const ALL_FIRED_GATES = [
      "gate1_confidence",
      "gate2_nearest_none",
      "gate3_no_anchor",
      "gate3b_resource_only",
      "gate4_margin",
      "gate5_missing_slot",
      "negation",
    ] as const;

    const declinedState = (
      gate: (typeof ALL_FIRED_GATES)[number],
    ): SessionState => ({
      ...baseSessionState,
      status: "declined",
      reason: "confidence 0.32 below floor 0.45", // realistic old reason
      route: {
        ...baseSessionState.route,
        gate,
      },
    });

    const FORBIDDEN =
      /\*\*|gate\d|floor|margin |confidence 0\.|below floor|nearest neighbour|predicted with/i;

    it.each(ALL_FIRED_GATES)("%s produces no diagnostics", (gate) => {
      const msg = presentSession(declinedState(gate), "m");
      expect(msg?.kind).toBe("text");
      if (msg?.kind === "text") {
        expect(msg.text).not.toMatch(FORBIDDEN);
        expect(msg.text.length).toBeGreaterThan(10);
      }
    });

    /**
     * The round-cap copy is chosen by a STRUCTURAL marker, never by matching
     * the wording of `reason`.
     *
     * It used to be picked with `reason.includes("starting over will be
     * quicker")`. `reason` is a diagnostic that changes freely — and did, in
     * this very commit — so that coupling silently reverted the copy to the
     * generic fallback with no test failing. These two tests are what make
     * that impossible to reintroduce.
     */
    it("uses the round-cap copy whatever the reason says", () => {
      const state: SessionState = {
        ...baseSessionState,
        status: "declined",
        roundCapReached: true,
        // Deliberately shares no wording with any reason session.ts produces.
        reason: "wording nobody is allowed to depend on",
        route: { ...baseSessionState.route, gate: "gate1_confidence" },
      };
      const msg = presentSession(state, "m");
      expect(msg?.kind).toBe("text");
      if (msg?.kind === "text") {
        expect(msg.text).toContain("start over");
        expect(msg.text).not.toMatch(FORBIDDEN);
      }
    });

    it("does not use the round-cap copy when the marker is absent", () => {
      // The mirror image: the old wording alone must no longer trigger it,
      // or the string coupling would still be live by accident.
      const state: SessionState = {
        ...baseSessionState,
        status: "declined",
        reason: "still unclear - starting over will be quicker",
        route: { ...baseSessionState.route, gate: "gate2_nearest_none" },
      };
      const msg = presentSession(state, "m");
      expect(msg?.kind).toBe("text");
      if (msg?.kind === "text") {
        expect(msg.text).not.toContain("start over");
        expect(msg.text).not.toMatch(FORBIDDEN);
      }
    });

    it("has a generic fallback for a decline without a matching gate", () => {
      // A round-cap decline still carries whatever gate fired last, and that
      // gate does not describe why the conversation ended — so the marker has
      // to win over the gate copy.
      const state: SessionState = {
        ...baseSessionState,
        status: "declined",
        roundCapReached: true,
        reason:
          "still unclear after 2 questions - starting over will be quicker",
        route: {
          ...baseSessionState.route,
          gate: "gate1_confidence", // irrelevant; the marker takes precedence
        },
      };
      const msg = presentSession(state, "m");
      expect(msg?.kind).toBe("text");
      if (msg?.kind === "text") {
        expect(msg.text).toBe("Let's start over — what would you like to do?");
      }
    });

    it("has a generic fallback for unknown gate", () => {
      const state: SessionState = {
        ...baseSessionState,
        status: "declined",
        reason: "something weird happened",
        route: {
          ...baseSessionState.route,
          gate: null,
        },
      };
      const msg = presentSession(state, "m");
      expect(msg?.kind).toBe("text");
      if (msg?.kind === "text") {
        expect(msg.text).not.toMatch(FORBIDDEN);
        expect(msg.text).toContain("I couldn't quite understand that.");
      }
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  //  A cancellation card invents no duration
  //
  //  The event being removed already has a length; this layer's 60-minute
  //  default is meaningless for it. Shown anyway, "1 hr" and "no duration given
  //  — assumed 60 minutes" sat directly above a red "Cancel event" button and
  //  read as though something were about to be created.
  // ══════════════════════════════════════════════════════════════════════════

  describe("delete_event cards", () => {
    const cancelState: SessionState = {
      ...baseSessionState,
      route: { ...baseSessionState.route, intent: "delete_event" },
      draft: {
        ...baseSessionState.draft!,
        intent: "delete_event",
        title: undefined,
        resources: [
          {
            id: "r1",
            name: "Operating Room 1",
            type: "room",
            exact: true,
            start: 0,
            end: 16,
            text: "Operating Room 1",
          },
        ],
      },
    };

    it("shows no duration chip", () => {
      const msg = presentSession(cancelState, "d1");
      expect(msg?.kind).toBe("parse");
      if (msg?.kind === "parse") {
        expect(msg.card.chips.map((c) => c.label)).not.toContain("1 hr");
      }
    });

    it("discloses no invented duration", () => {
      const msg = presentSession(cancelState, "d2");
      if (msg?.kind === "parse") {
        expect(msg.card.notes.join(" ")).not.toMatch(/duration/i);
      }
    });

    it("still discloses an invented TIME, which identifies the event", () => {
      const msg = presentSession(cancelState, "d3");
      if (msg?.kind === "parse") {
        expect(msg.card.notes.join(" ")).toContain("09:00");
      }
    });

    it("leaves a booking card's duration alone", () => {
      const booking: SessionState = {
        ...baseSessionState,
        route: { ...baseSessionState.route, intent: "add_event" },
        draft: { ...baseSessionState.draft!, intent: "add_event" },
      };
      const msg = presentSession(booking, "d4");
      if (msg?.kind === "parse") {
        expect(msg.card.chips.map((c) => c.label)).toContain("1 hr");
        expect(msg.card.notes.join(" ")).toMatch(/duration/i);
      }
    });
  });
});
