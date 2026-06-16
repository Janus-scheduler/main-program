import { expandEvents } from "../src/utils/recurrence";
import { Event } from "../src/models/events/event";

describe("Recurrence Expansion", () => {
  it("should pass non-recurring events through unmodified", () => {
    const events = [
      new Event({
        id: "evt-1",
        title: "Single Event",
        startTime: "2026-06-02T10:00:00Z",
        endTime: "2026-06-02T11:00:00Z",
        resourceId: "r1",
      }),
    ];

    const expanded = expandEvents(
      events,
      new Date("2026-06-01").getTime(),
      new Date("2026-06-10").getTime(),
    );
    expect(expanded).toHaveLength(1);
    expect(expanded[0].id).toBe("evt-1");
    expect(expanded[0].recurrenceRule).toBeUndefined();
  });

  it("should expand a daily recurring event into occurrences within a range", () => {
    const events = [
      new Event({
        id: "evt-1",
        title: "Daily Event",
        startTime: "2026-06-02T10:00:00Z",
        endTime: "2026-06-02T11:00:00Z",
        resourceId: "r1",
        recurrenceRule: "FREQ=DAILY;COUNT=3",
      }),
    ];

    const expanded = expandEvents(
      events,
      new Date("2026-06-01").getTime(),
      new Date("2026-06-10").getTime(),
    );
    expect(expanded).toHaveLength(3);
    expect(expanded[0].id).toContain("evt-1_occ_");
    expect(expanded[0].title).toBe("Daily Event");

    const startTimes = expanded.map((e) => e.startTime);
    expect(startTimes[0]).toBe("2026-06-02T10:00:00.000Z");
    expect(startTimes[1]).toBe("2026-06-03T10:00:00.000Z");
    expect(startTimes[2]).toBe("2026-06-04T10:00:00.000Z");
  });

  it("should honor UNTIL in recurrence rule", () => {
    const events = [
      new Event({
        id: "evt-1",
        title: "Daily Event",
        startTime: "2026-06-02T10:00:00Z",
        endTime: "2026-06-02T11:00:00Z",
        resourceId: "r1",
        recurrenceRule: "FREQ=DAILY;UNTIL=20260604T235959Z",
      }),
    ];

    const expanded = expandEvents(
      events,
      new Date("2026-06-01").getTime(),
      new Date("2026-06-10").getTime(),
    );
    expect(expanded).toHaveLength(3);
  });

  it("should fallback to base event if recurrence rule string is invalid", () => {
    const events = [
      new Event({
        id: "evt-1",
        title: "Bad Event",
        startTime: "2026-06-02T10:00:00Z",
        endTime: "2026-06-02T11:00:00Z",
        resourceId: "r1",
        recurrenceRule: "FREQ=INVALID_RULE",
      }),
    ];

    const expanded = expandEvents(
      events,
      new Date("2026-06-01").getTime(),
      new Date("2026-06-10").getTime(),
    );
    expect(expanded).toHaveLength(1);
    expect(expanded[0].id).toBe("evt-1");
  });

  it("should calculate a single-day nominal duration for projected recurring occurrences", () => {
    const events = [
      new Event({
        id: "evt-1",
        title: "Weekly Event",
        startTime: "2026-06-04T10:00:00Z",
        endTime: "2026-06-04T11:00:00Z",
        resourceId: "r1",
        recurrenceRule: "FREQ=WEEKLY;UNTIL=20260625T235959Z",
      }),
    ];

    const expanded = expandEvents(
      events,
      new Date("2026-06-01").getTime(),
      new Date("2026-06-30").getTime(),
    );

    expect(expanded).toHaveLength(4);
    for (const occ of expanded) {
      const durationMs =
        new Date(occ.endTime).getTime() - new Date(occ.startTime).getTime();
      expect(durationMs).toBe(3600000); // 1 hour
    }
  });
});
