// Mock window and localStorage before importing the store so isBrowser evaluates to true
const mockStorage: Record<string, string> = {};
global.window = {} as unknown as Window & typeof globalThis;
global.localStorage = {
  getItem: (key: string) => mockStorage[key] || null,
  setItem: (key: string, value: string) => {
    mockStorage[key] = value;
  },
  removeItem: (key: string) => {
    delete mockStorage[key];
  },
  clear: () => {
    for (const key in mockStorage) {
      delete mockStorage[key];
    }
  },
  length: 0,
  key: () => null,
} as unknown as Storage;
global.window.localStorage = global.localStorage;

import { schedulerStore } from "../src/store/scheduler.store";

describe("Scheduler Store", () => {
  beforeEach(() => {
    schedulerStore.getState().clearAll();
    localStorage.clear();
    schedulerStore.getState().clearDraft();
  });

  describe("Draft Management", () => {
    it("should start a draft with default values", () => {
      const store = schedulerStore.getState();
      store.startDraft(null, { title: "draft event" });

      const state = schedulerStore.getState();
      expect(state.eventDraft).not.toBeNull();
      expect(state.eventDraft?.title).toBe("draft event");
    });

    it("should start draft from local storage when id is null", () => {
      const store = schedulerStore.getState();

      store.startDraft(null, { title: "default" });
      store.updateDraft({ title: "saved in localstorage" });

      // Start draft again, should load from localStorage
      store.clearDraft(false);
      store.startDraft(null, {});
      expect(schedulerStore.getState().eventDraft?.title).toBe(
        "saved in localstorage",
      );
    });

    it("should update and clear the draft", () => {
      const store = schedulerStore.getState();
      store.startDraft(null, { title: "draft event" });
      store.updateDraft({ title: "updated draft" });

      let state = schedulerStore.getState();
      expect(state.eventDraft?.title).toBe("updated draft");

      store.clearDraft(true);
      state = schedulerStore.getState();
      expect(state.eventDraft).toBeNull();
    });
  });

  describe("Event Management", () => {
    it("should add a valid event and throw on invalid event", () => {
      const store = schedulerStore.getState();
      const event = store.addEvent({
        id: "evt-1",
        title: "Test Event",
        startTime: "2026-06-02T10:00:00Z",
        endTime: "2026-06-02T11:00:00Z",
        resourceId: "r1",
      });
      expect(schedulerStore.getState().events["evt-1"]).toBe(event);

      expect(() => {
        store.addEvent({
          id: "",
          title: "",
          startTime: "",
          endTime: "",
          resourceId: "",
        });
      }).toThrow("Invalid event data");
    });

    it("should update event and sync resourceId/resourceIds", () => {
      const store = schedulerStore.getState();
      store.addEvent({
        id: "evt-1",
        title: "Test Event",
        startTime: "2026-06-02T10:00:00Z",
        endTime: "2026-06-02T11:00:00Z",
        resourceId: "r1",
      });

      // Update with resourceIds
      store.updateEvent("evt-1", {
        resourceIds: ["r2", "r3"],
        description: "desc",
      });
      let event = schedulerStore.getState().events["evt-1"];
      expect(event.resourceIds).toEqual(["r2", "r3"]);
      expect(event.resourceId).toBe("r2");
      expect(event.description).toBe("desc");

      // Update with single resourceId
      store.updateEvent("evt-1", { resourceId: "r4" });
      event = schedulerStore.getState().events["evt-1"];
      expect(event.resourceIds).toEqual(["r4"]);
      expect(event.resourceId).toBe("r4");

      // Test event update throw on missing event
      expect(() => {
        store.updateEvent("non-existent", { title: "New" });
      }).toThrow("Event non-existent not found");
    });

    it("should delete an event", () => {
      const store = schedulerStore.getState();
      store.addEvent({
        id: "evt-1",
        title: "Test Event",
        startTime: "2026-06-02T10:00:00Z",
        endTime: "2026-06-02T11:00:00Z",
        resourceId: "r1",
      });

      expect(store.deleteEvent("evt-1")).toBe(true);
      expect(schedulerStore.getState().events["evt-1"]).toBeUndefined();
      expect(store.deleteEvent("evt-1")).toBe(false);
    });
  });

  describe("Resource Management", () => {
    it("should add a valid resource and throw on invalid resource", () => {
      const store = schedulerStore.getState();
      const resource = store.addResource({
        id: "r1",
        name: "Resource 1",
        type: "person",
        email: "r1@test.com",
      });
      expect(schedulerStore.getState().resources["r1"]).toBe(resource);

      expect(() => {
        store.addResource({
          id: "",
          name: "",
        });
      }).toThrow("Invalid resource data");
    });

    it("should update a resource", () => {
      const store = schedulerStore.getState();
      store.addResource({
        id: "r1",
        name: "Resource 1",
        type: "person",
        email: "r1@test.com",
      });

      store.updateResource("r1", {
        name: "Updated Resource",
        email: "new@test.com",
      });
      const resource = schedulerStore.getState().resources["r1"];
      expect(resource.name).toBe("Updated Resource");
      expect(resource.email).toBe("new@test.com");

      expect(() => {
        store.updateResource("non-existent", { name: "No" });
      }).toThrow("Resource non-existent not found");
    });

    it("should throw and not mutate when an update makes a person resource invalid", () => {
      const store = schedulerStore.getState();
      store.addResource({
        id: "r1",
        name: "Resource 1",
        type: "person",
        email: "r1@test.com",
      });

      expect(() => {
        store.updateResource("r1", { email: "" });
      }).toThrow("Invalid resource data");

      const unchanged = schedulerStore.getState().resources["r1"];
      expect(unchanged.email).toBe("r1@test.com");
    });

    it("should delete a resource unless assigned to events", () => {
      const store = schedulerStore.getState();
      store.addResource({ id: "r1", name: "R1", type: "room" });

      // Can delete when unassigned
      expect(store.deleteResource("r1")).toBe(true);
      expect(schedulerStore.getState().resources["r1"]).toBeUndefined();
      expect(store.deleteResource("r1")).toBe(false);

      // Re-add resource and add event assigning it
      store.addResource({ id: "r1", name: "R1", type: "room" });
      store.addEvent({
        id: "evt-1",
        title: "Test Event",
        startTime: "2026-06-02T10:00:00Z",
        endTime: "2026-06-02T11:00:00Z",
        resourceId: "r1",
      });

      expect(() => {
        store.deleteResource("r1");
      }).toThrow("Cannot delete resource r1 - has assigned events");
    });
  });

  describe("Assignment Management", () => {
    it("should add and delete assignments", () => {
      const store = schedulerStore.getState();
      store.addResource({ id: "r1", name: "R1", type: "room" });
      store.addEvent({
        id: "evt-1",
        title: "Test Event",
        startTime: "2026-06-02T10:00:00Z",
        endTime: "2026-06-02T11:00:00Z",
        resourceId: "r1",
      });

      const assignment = store.addAssignment({
        id: "a1",
        eventId: "evt-1",
        resourceId: "r1",
      });
      expect(schedulerStore.getState().assignments["a1"]).toBe(assignment);

      // Throw if assignment invalid
      expect(() => {
        store.addAssignment({
          id: "",
          eventId: "",
          resourceId: "",
        });
      }).toThrow("Invalid assignment data");

      // Throw if event not found
      expect(() => {
        store.addAssignment({
          id: "a2",
          eventId: "non-existent",
          resourceId: "r1",
        });
      }).toThrow("Event non-existent not found");

      // Throw if resource not found
      expect(() => {
        store.addAssignment({
          id: "a2",
          eventId: "evt-1",
          resourceId: "non-existent",
        });
      }).toThrow("Resource non-existent not found");

      expect(store.deleteAssignment("a1")).toBe(true);
      expect(schedulerStore.getState().assignments["a1"]).toBeUndefined();
      expect(store.deleteAssignment("a1")).toBe(false);
    });
  });

  describe("Timezone Management", () => {
    it("should set timezone", () => {
      const store = schedulerStore.getState();
      store.setTimezone("UTC");
      expect(schedulerStore.getState().timezone).toBe("UTC");
    });

    /**
     * REGRESSION — picking a timezone in the event modal did not stick when
     * creating a new event, though it did when editing one.
     *
     * `<janus-scheduler>` subscribes to the store and resets its local
     * `_selectedTz` from `eventDraft.timezone` on EVERY store write. The
     * timezone picker only ever set the component field, never the draft — so
     * the next of the 15 `updateDraft` call sites (any keystroke in the title,
     * any date change) read back the STALE draft timezone and silently
     * reverted the user's choice. Editing an existing event appeared to work
     * only because nothing else was edited afterwards.
     *
     * The fix writes the pick into the draft. This pins the behaviour the fix
     * depends on: a timezone stored on the draft survives later edits.
     */
    it("keeps a draft timezone across subsequent draft edits", () => {
      const store = schedulerStore.getState();
      store.startDraft(null, { title: "", timezone: "UTC" });

      store.updateDraft({ timezone: "Asia/Tokyo" });
      expect(schedulerStore.getState().eventDraft?.timezone).toBe("Asia/Tokyo");

      // Simulate the keystrokes and field edits that follow, each of which is
      // a separate store write that used to clobber the picked zone.
      store.updateDraft({ title: "K" });
      store.updateDraft({ title: "Kn" });
      store.updateDraft({ title: "Knee surgery" });
      store.updateDraft({ startTime: "15:00" });
      store.updateDraft({ participants: ["r1"] });

      expect(schedulerStore.getState().eventDraft?.timezone).toBe("Asia/Tokyo");
      expect(schedulerStore.getState().eventDraft?.title).toBe("Knee surgery");
    });

    it("updates event timezone via updateEvent and leaves store timezone intact", () => {
      const store = schedulerStore.getState();
      store.setTimezone("America/New_York");

      const evt = store.addEvent({
        id: "evt-tz-1",
        title: "Conference",
        startTime: "2026-06-02T10:00:00Z",
        endTime: "2026-06-02T11:00:00Z",
        resourceId: "r1",
        timezone: "America/New_York",
      });

      expect(evt.timezone).toBe("America/New_York");
      expect(schedulerStore.getState().timezone).toBe("America/New_York");

      store.updateEvent("evt-tz-1", {
        timezone: "Asia/Colombo",
      });

      const updated = schedulerStore.getState().events["evt-tz-1"];
      expect(updated.timezone).toBe("Asia/Colombo");
      // The timeline display timezone remains unaffected
      expect(schedulerStore.getState().timezone).toBe("America/New_York");
    });
  });
});
