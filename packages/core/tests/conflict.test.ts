import {
  checkSlotConflict,
  checkDraftConflict,
  computeTimelineConflicts,
  type ConflictResource,
  type ConflictEvent,
} from "../src/utils/conflict";
import { type EventDraft, Event } from "../src/index";

describe("Conflict Utilities", () => {
  describe("checkSlotConflict", () => {
    const events: ConflictEvent[] = [
      {
        id: "e1",
        title: "Event 1",
        startMs: 1000,
        endMs: 2000,
        startTime: "10:00",
        endTime: "11:00",
      },
      {
        id: "e2",
        title: "Event 2",
        startMs: 3000,
        endMs: 4000,
        startTime: "12:00",
        endTime: "13:00",
      },
    ];

    it("should return false when there are no events in the slot", () => {
      expect(checkSlotConflict(events, 0, 500)).toBe(false);
    });

    it("should return false when checking an occupied slot but ignoring its own event ID", () => {
      expect(checkSlotConflict(events, 1200, 1800, "e1")).toBe(false);
    });

    it("should return true when a slot overlaps with an existing event", () => {
      expect(checkSlotConflict(events, 1500, 2500)).toBe(true);
      expect(checkSlotConflict(events, 500, 1500)).toBe(true);
      expect(checkSlotConflict(events, 1200, 1800)).toBe(true);
    });

    it("should return false when events just touch but do not overlap", () => {
      expect(checkSlotConflict(events, 2000, 3000)).toBe(false);
    });
  });

  describe("checkDraftConflict", () => {
    const existingEvents: Event[] = [
      new Event({
        id: "existing_1",
        title: "Team Meeting",
        startTime: "2026-06-02T10:00:00Z",
        endTime: "2026-06-02T11:00:00Z",
        resourceIds: ["res_1"],
        status: "confirmed",
        description: "",
        allDay: false,
      }),
    ];

    it("should return no conflict for empty/incomplete draft properties", () => {
      const draft: Partial<EventDraft> = {
        title: "",
        participants: [],
      };
      expect(checkDraftConflict(draft as EventDraft, [], "UTC")).toEqual({
        hasConflict: false,
        message: "",
        resourceIds: [],
      });
    });

    it("should detect conflict when a draft overlaps with an existing event for a shared participant", () => {
      const draft: EventDraft = {
        id: null,
        title: "1-on-1 Review",
        startDate: "2026-06-02",
        startTime: "10:15",
        endDate: "2026-06-02",
        endTime: "10:45",
        participants: ["res_1"],
        description: "",
        activeColor: "blue",
        timezone: "UTC",
        allDay: false,
        recurrenceRule: "",
      };

      const result = checkDraftConflict(draft, existingEvents, "UTC");
      expect(result.hasConflict).toBe(true);
      expect(result.resourceIds).toContain("res_1");
      expect(result.message).toContain("Team Meeting");
    });

    it("should not detect conflict if participants do not overlap", () => {
      const draft: EventDraft = {
        id: null,
        title: "1-on-1 Review",
        startDate: "2026-06-02",
        startTime: "10:15",
        endDate: "2026-06-02",
        endTime: "10:45",
        participants: ["res_2"],
        description: "",
        activeColor: "blue",
        timezone: "UTC",
        allDay: false,
        recurrenceRule: "",
      };

      const result = checkDraftConflict(draft, existingEvents, "UTC");
      expect(result.hasConflict).toBe(false);
    });

    it("should handle error gracefully and return no conflicts if zoning conversions throw errors", () => {
      const draft: EventDraft = {
        id: null,
        title: "Invalid Zone Test",
        startDate: "2026-06-02",
        startTime: "10:00",
        endDate: "2026-06-02",
        endTime: "11:00",
        participants: ["res_1"],
        description: "",
        activeColor: "blue",
        timezone: "UTC",
        allDay: false,
        recurrenceRule: "",
      };
      // Forcing error via invalid timezone
      const result = checkDraftConflict(
        draft,
        existingEvents,
        "Invalid/TimeZone",
      );
      expect(result.hasConflict).toBe(false);
    });
  });

  describe("computeTimelineConflicts", () => {
    it("should return no conflicts for an empty resources list", () => {
      expect(computeTimelineConflicts([], "UTC")).toEqual({
        hasConflict: false,
        messages: [],
        conflictingEventIds: new Set(),
      });
    });

    it("should find and group overlaps timezone-awarely", () => {
      const resources: ConflictResource[] = [
        {
          id: "res_1",
          name: "Conference Room A",
          events: [
            {
              id: "ev_1",
              title: "Scrum Daily",
              startMs: Date.UTC(2026, 5, 2, 9, 0, 0),
              endMs: Date.UTC(2026, 5, 2, 10, 0, 0),
              startTime: "09:00:00",
              endTime: "10:00:00",
            },
            {
              id: "ev_2",
              title: "Product Sync",
              startMs: Date.UTC(2026, 5, 2, 9, 30, 0),
              endMs: Date.UTC(2026, 5, 2, 10, 30, 0),
              startTime: "09:30:00",
              endTime: "10:30:00",
            },
          ],
        },
      ];

      const result = computeTimelineConflicts(resources, "UTC");
      expect(result.hasConflict).toBe(true);
      expect(result.conflictingEventIds.has("ev_1")).toBe(true);
      expect(result.conflictingEventIds.has("ev_2")).toBe(true);
      expect(result.messages[0]).toContain("Conference Room A");
      expect(result.messages[0]).toContain("Scrum Daily");
      expect(result.messages[0]).toContain("Product Sync");
      expect(result.messages[0]).toContain("9:30 AM");
    });

    it("should break inner loop early when events are non-overlapping in sorted order", () => {
      const resources: ConflictResource[] = [
        {
          id: "res_1",
          name: "Room 1",
          events: [
            {
              id: "ev_1",
              title: "Early Event",
              startMs: 1000,
              endMs: 2000,
              startTime: "01:00:00",
              endTime: "02:00:00",
            },
            {
              id: "ev_2",
              title: "Late Event",
              startMs: 3000,
              endMs: 4000,
              startTime: "03:00:00",
              endTime: "04:00:00",
            },
          ],
        },
      ];

      const result = computeTimelineConflicts(resources, "UTC");
      expect(result.hasConflict).toBe(false);
      expect(result.messages).toHaveLength(0);
      expect(result.conflictingEventIds.size).toBe(0);
    });
  });

  describe("checkDraftConflict recurrence and boundary cases", () => {
    const existingEvents: Event[] = [
      new Event({
        id: "existing_weekly",
        title: "Weekly Standup",
        startTime: "2026-06-02T10:00:00Z",
        endTime: "2026-06-02T11:00:00Z",
        resourceIds: ["res_1"],
        status: "confirmed",
        recurrenceRule: "FREQ=WEEKLY;INTERVAL=1",
      }),
    ];

    it("should detect conflict with recurring draft having UNTIL rule", () => {
      const draft: EventDraft = {
        id: null,
        title: "Client Meeting",
        startDate: "2026-06-02",
        startTime: "10:30",
        endDate: "2026-06-02",
        endTime: "11:30",
        participants: ["res_1"],
        description: "",
        activeColor: "blue",
        timezone: "UTC",
        allDay: false,
        recurrenceRule: "FREQ=DAILY;UNTIL=20260610T235959Z",
      };

      const result = checkDraftConflict(draft, existingEvents, "UTC");
      expect(result.hasConflict).toBe(true);
      expect(result.resourceIds).toContain("res_1");
    });

    it("should detect conflict with recurring draft without UNTIL rule", () => {
      const draft: EventDraft = {
        id: null,
        title: "Recurring 1-on-1",
        startDate: "2026-06-02",
        startTime: "10:15",
        endDate: "2026-06-02",
        endTime: "10:45",
        participants: ["res_1"],
        description: "",
        activeColor: "blue",
        timezone: "UTC",
        allDay: false,
        recurrenceRule: "FREQ=WEEKLY",
      };

      const result = checkDraftConflict(draft, existingEvents, "UTC");
      expect(result.hasConflict).toBe(true);
    });

    it("should ignore existing occurrences when updating the same event with matching base ID", () => {
      const draft: EventDraft = {
        id: "existing_weekly_occ_0",
        title: "Weekly Standup Updated",
        startDate: "2026-06-02",
        startTime: "10:00",
        endDate: "2026-06-02",
        endTime: "11:00",
        participants: ["res_1"],
        description: "",
        activeColor: "blue",
        timezone: "UTC",
        allDay: false,
        recurrenceRule: "FREQ=WEEKLY;INTERVAL=1",
      };

      const result = checkDraftConflict(draft, existingEvents, "UTC");
      expect(result.hasConflict).toBe(false);
    });
  });
});
