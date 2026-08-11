import { SchedulerManager } from "../src/services/SchedulerManager.service";
import { schedulerStore } from "../src/store/scheduler.store";

describe("SchedulerManager", () => {
  beforeEach(() => {
    schedulerStore.getState().clearAll();
  });

  describe("Events", () => {
    it("should add an event and trigger the onEventAdd hook", async () => {
      const onEventAddMock = jest.fn();
      const manager = new SchedulerManager({ onEventAdd: onEventAddMock });

      const event = manager.addEvent({
        id: "evt-1",
        title: "Test Event",
        startTime: "2026-06-02T10:00:00Z",
        endTime: "2026-06-02T11:00:00Z",
        resourceId: "r1",
      });

      expect(schedulerStore.getState().events["evt-1"]).toBeDefined();
      expect(onEventAddMock).toHaveBeenCalledWith(event);
      expect(manager.getEvent("evt-1")).toBe(event);
      expect(manager.getAllEvents()).toEqual([event]);
      expect(manager.getEventCount()).toBe(1);
    });

    it("should roll back event addition if the hook throws an error", () => {
      const onErrorMock = jest.fn();
      const manager = new SchedulerManager({
        onEventAdd: () => {
          throw new Error("API Failure");
        },
        onError: onErrorMock,
      });

      manager.addEvent({
        id: "evt-1",
        title: "Test Event",
        startTime: "2026-06-02T10:00:00Z",
        endTime: "2026-06-02T11:00:00Z",
        resourceId: "r1",
      });

      expect(schedulerStore.getState().events["evt-1"]).toBeUndefined();
      expect(onErrorMock).toHaveBeenCalled();
    });

    it("should update event and rollback if update hook fails", async () => {
      const onEventUpdateMock = jest.fn();
      const onErrorMock = jest.fn();
      const manager = new SchedulerManager({
        onEventUpdate: onEventUpdateMock,
        onError: onErrorMock,
      });

      manager.addEvent({
        id: "evt-1",
        title: "Test Event",
        startTime: "2026-06-02T10:00:00Z",
        endTime: "2026-06-02T11:00:00Z",
        resourceId: "r1",
      });

      // Successful update
      manager.updateEvent("evt-1", { title: "Updated Event Title" });
      expect(schedulerStore.getState().events["evt-1"].title).toBe(
        "Updated Event Title",
      );
      expect(onEventUpdateMock).toHaveBeenCalled();

      // Failed update
      const failingManager = new SchedulerManager({
        onEventUpdate: () => {
          throw new Error("Update failed");
        },
        onError: onErrorMock,
      });

      failingManager.updateEvent("evt-1", { title: "Failing Title" });

      expect(schedulerStore.getState().events["evt-1"].title).toBe(
        "Updated Event Title",
      );
      expect(onErrorMock).toHaveBeenCalled();
    });

    it("should delete event and rollback if delete hook fails", () => {
      const onEventDeleteMock = jest.fn();
      const onErrorMock = jest.fn();
      const manager = new SchedulerManager({
        onEventDelete: onEventDeleteMock,
        onError: onErrorMock,
      });

      manager.addEvent({
        id: "evt-1",
        title: "Test Event",
        startTime: "2026-06-02T10:00:00Z",
        endTime: "2026-06-02T11:00:00Z",
        resourceId: "r1",
      });

      // Failed deletion
      const failingManager = new SchedulerManager({
        onEventDelete: () => {
          throw new Error("Delete failed");
        },
        onError: onErrorMock,
      });

      failingManager.deleteEvent("evt-1");

      expect(schedulerStore.getState().events["evt-1"]).toBeDefined();
      expect(onErrorMock).toHaveBeenCalled();

      // Successful deletion
      manager.deleteEvent("evt-1");
      expect(schedulerStore.getState().events["evt-1"]).toBeUndefined();
      expect(onEventDeleteMock).toHaveBeenCalledWith("evt-1");
    });

    it("should get events by resource and date", () => {
      const manager = new SchedulerManager();
      const e1 = manager.addEvent({
        id: "evt-1",
        title: "Event 1",
        startTime: "2026-06-02T10:00:00Z",
        endTime: "2026-06-02T11:00:00Z",
        resourceId: "r1",
      });
      const e2 = manager.addEvent({
        id: "evt-2",
        title: "Event 2",
        startTime: "2026-06-02T12:00:00Z",
        endTime: "2026-06-02T13:00:00Z",
        resourceIds: ["r1", "r2"],
      });

      expect(manager.getEventsByResource("r1")).toEqual([e1, e2]);
      expect(manager.getEventsByResource("r2")).toEqual([e2]);
      expect(manager.getEventsByDate("2026-06-02")).toEqual([e1, e2]);
      expect(manager.getEventsByDate("2026-06-03")).toEqual([]);
    });

    it("should resolve occurrence IDs and shift time on updateEvent", () => {
      const manager = new SchedulerManager();
      const parentEvent = manager.addEvent({
        id: "evt-recur",
        title: "Recurring Event",
        startTime: "2026-06-02T10:00:00Z",
        endTime: "2026-06-02T11:00:00Z",
        resourceId: "r1",
        recurrenceRule: "FREQ=WEEKLY",
      });

      // 1. Check resolving occurrence ID to its base event
      const occId = "evt-recur_occ_1773050400000"; // some timestamp
      const resolved = manager.getEvent(occId);
      expect(resolved).toBe(parentEvent);

      // 2. Check time shift logic when updating an occurrence
      const originalOccStartMs = new Date("2026-06-09T10:00:00Z").getTime(); // 1 week later
      const occShiftedStartIso = "2026-06-09T12:30:00Z"; // shifted by 2.5 hours
      const targetOccId = `evt-recur_occ_${originalOccStartMs}`;

      manager.updateEvent(targetOccId, { startTime: occShiftedStartIso });

      // Parent event should be shifted by 2.5 hours (10:00 -> 12:30)
      const updatedParent = manager.getEvent("evt-recur");
      expect(updatedParent?.startTime).toBe("2026-06-02T12:30:00.000Z");
      expect(updatedParent?.endTime).toBe("2026-06-02T13:30:00.000Z");
    });
  });

  describe("Resources", () => {
    it("should add, update, delete resources", () => {
      const onAdd = jest.fn();
      const onUpdate = jest.fn();
      const onDelete = jest.fn();
      const manager = new SchedulerManager({
        onResourceAdd: onAdd,
        onResourceUpdate: onUpdate,
        onResourceDelete: onDelete,
      });

      const res = manager.addResource({
        id: "r1",
        name: "Resource 1",
        type: "room",
      });
      expect(manager.getResource("r1")).toBe(res);
      expect(manager.getAllResources()).toEqual([res]);
      expect(manager.getResourceCount()).toBe(1);
      expect(onAdd).toHaveBeenCalledWith(res);

      manager.updateResource("r1", { name: "New Name" });
      expect(manager.getResource("r1")?.name).toBe("New Name");
      expect(onUpdate).toHaveBeenCalled();

      manager.deleteResource("r1");
      expect(manager.getResource("r1")).toBeUndefined();
      expect(onDelete).toHaveBeenCalledWith("r1");
    });

    it("should rollback resource update and delete if hooks fail", () => {
      const onError = jest.fn();
      const manager = new SchedulerManager({
        onResourceUpdate: () => {
          throw new Error("Update fail");
        },
        onResourceDelete: () => {
          throw new Error("Delete fail");
        },
        onError,
      });

      schedulerStore
        .getState()
        .addResource({ id: "r1", name: "Original Name", type: "room" });

      manager.updateResource("r1", { name: "Failed Name" });
      expect(schedulerStore.getState().resources["r1"].name).toBe(
        "Original Name",
      );
      expect(onError).toHaveBeenCalled();

      manager.deleteResource("r1");
      expect(schedulerStore.getState().resources["r1"]).toBeDefined();
    });
  });

  describe("Assignments", () => {
    it("should add and delete assignments", () => {
      const onAdd = jest.fn();
      const onDelete = jest.fn();
      const manager = new SchedulerManager({
        onAssignmentAdd: onAdd,
        onAssignmentDelete: onDelete,
      });

      manager.addResource({ id: "r1", name: "Resource 1", type: "room" });
      manager.addEvent({
        id: "evt-1",
        title: "Test Event",
        startTime: "2026-06-02T10:00:00Z",
        endTime: "2026-06-02T11:00:00Z",
        resourceId: "r1",
      });

      const assignment = manager.addAssignment({
        id: "a1",
        eventId: "evt-1",
        resourceId: "r1",
      });

      expect(manager.getAssignmentsByEvent("evt-1")).toEqual([assignment]);
      expect(manager.getAssignmentsByResource("r1")).toEqual([assignment]);
      expect(onAdd).toHaveBeenCalledWith(assignment);

      manager.deleteAssignment("a1");
      expect(manager.getAssignmentsByEvent("evt-1")).toEqual([]);
      expect(onDelete).toHaveBeenCalledWith("a1");
    });

    it("should rollback assignment add and delete if hooks fail", () => {
      const onError = jest.fn();
      const manager = new SchedulerManager({
        onAssignmentAdd: () => {
          throw new Error("Add fail");
        },
        onAssignmentDelete: () => {
          throw new Error("Delete fail");
        },
        onError,
      });

      manager.addResource({ id: "r1", name: "Resource 1", type: "room" });
      manager.addEvent({
        id: "evt-1",
        title: "Test Event",
        startTime: "2026-06-02T10:00:00Z",
        endTime: "2026-06-02T11:00:00Z",
        resourceId: "r1",
      });

      manager.addAssignment({ id: "a1", eventId: "evt-1", resourceId: "r1" });
      expect(schedulerStore.getState().assignments["a1"]).toBeUndefined();

      // Add assignment directly via store to test delete rollback
      schedulerStore
        .getState()
        .addAssignment({ id: "a1", eventId: "evt-1", resourceId: "r1" });
      manager.deleteAssignment("a1");
      expect(schedulerStore.getState().assignments["a1"]).toBeDefined();
    });
  });

  describe("Reset", () => {
    it("should clear all elements", () => {
      const manager = new SchedulerManager();
      manager.addResource({ id: "r1", name: "Resource 1", type: "room" });
      manager.clearAll();
      expect(manager.getResourceCount()).toBe(0);
    });
  });
});
