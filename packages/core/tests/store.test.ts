import { schedulerStore } from "../src/store/scheduler.store";

describe("Scheduler Store", () => {
  beforeEach(() => {
    schedulerStore.getState().clearAll();
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
  describe("Event updates with multiple resources", () => {
    it("should sync resourceIds and resourceId on event updates", () => {
      const store = schedulerStore.getState();
      const event = store.addEvent({
        id: "evt-1",
        title: "Test Event",
        startTime: "2026-06-02T10:00:00Z",
        endTime: "2026-06-02T11:00:00Z",
        resourceId: "r1",
      });
      store.updateEvent("evt-1", { resourceIds: ["r1", "r2"] });
      const updatedEvent = schedulerStore.getState().events["evt-1"];
      expect(updatedEvent.resourceIds).toEqual(["r1", "r2"]);
      expect(updatedEvent.resourceId).toBe("r1");
    });
  });
});
