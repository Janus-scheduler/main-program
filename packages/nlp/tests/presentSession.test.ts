import {
  presentSession,
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
});
