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

      const res = manager.addResource({ id: "r1", name: "Resource 1" });
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
        .addResource({ id: "r1", name: "Original Name" });

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

      manager.addResource({ id: "r1", name: "Resource 1" });
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

      manager.addResource({ id: "r1", name: "Resource 1" });
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
      manager.addResource({ id: "r1", name: "Resource 1" });
      manager.clearAll();
      expect(manager.getResourceCount()).toBe(0);
    });

    it("should reset the undo stack when clearAll is called", () => {
      const onUndoStateChange = jest.fn();
      const manager = new SchedulerManager({ onUndoStateChange });

      manager.addEvent({
        id: "evt-1",
        title: "Event 1",
        startTime: "2026-06-02T10:00:00Z",
        endTime: "2026-06-02T11:00:00Z",
        resourceId: "r1",
      });

      expect(manager.canUndo()).toBe(true);

      manager.clearAll();

      expect(manager.canUndo()).toBe(false);
      expect(manager.peekUndo()).toBeUndefined();
      // onUndoStateChange is called with false after clearAll
      expect(onUndoStateChange).toHaveBeenLastCalledWith(false);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Undo System
  // ─────────────────────────────────────────────────────────────────────────
  describe("Undo", () => {
    it("canUndo() returns false on a fresh manager", () => {
      const manager = new SchedulerManager();
      expect(manager.canUndo()).toBe(false);
    });

    it("peekUndo() returns undefined on a fresh manager", () => {
      const manager = new SchedulerManager();
      expect(manager.peekUndo()).toBeUndefined();
    });

    it("canUndo() returns true after adding an event", () => {
      const manager = new SchedulerManager();
      manager.addEvent({
        id: "evt-1",
        title: "Test",
        startTime: "2026-06-02T10:00:00Z",
        endTime: "2026-06-02T11:00:00Z",
        resourceId: "r1",
      });
      expect(manager.canUndo()).toBe(true);
    });

    it("peekUndo() returns the last undo action without consuming it", () => {
      const manager = new SchedulerManager();
      manager.addEvent({
        id: "evt-1",
        title: "Test",
        startTime: "2026-06-02T10:00:00Z",
        endTime: "2026-06-02T11:00:00Z",
        resourceId: "r1",
      });

      const peeked = manager.peekUndo();
      expect(peeked).toEqual({ type: "addEvent", id: "evt-1" });

      // Peeking again should return the same action (not consumed)
      expect(manager.peekUndo()).toEqual(peeked);
      expect(manager.canUndo()).toBe(true);
    });

    it("undo addEvent — removes the event from the store", () => {
      const manager = new SchedulerManager();
      manager.addEvent({
        id: "evt-1",
        title: "Test",
        startTime: "2026-06-02T10:00:00Z",
        endTime: "2026-06-02T11:00:00Z",
        resourceId: "r1",
      });

      expect(manager.getEvent("evt-1")).toBeDefined();

      manager.undo();

      expect(manager.getEvent("evt-1")).toBeUndefined();
      expect(manager.canUndo()).toBe(false);
    });

    it("undo deleteEvent — restores the event to the store", () => {
      const manager = new SchedulerManager();
      manager.addEvent({
        id: "evt-1",
        title: "Restored Event",
        startTime: "2026-06-02T10:00:00Z",
        endTime: "2026-06-02T11:00:00Z",
        resourceId: "r1",
      });

      manager.deleteEvent("evt-1");
      expect(manager.getEvent("evt-1")).toBeUndefined();

      // The undo stack now has: [addEvent(evt-1), deleteEvent(evt-1)]
      // The top is deleteEvent, so undoing restores it
      manager.undo();
      expect(manager.getEvent("evt-1")).toBeDefined();
      expect(manager.getEvent("evt-1")?.title).toBe("Restored Event");
    });

    it("undo updateEvent — reverts the event to its previous state", () => {
      const manager = new SchedulerManager();
      manager.addEvent({
        id: "evt-1",
        title: "Original Title",
        startTime: "2026-06-02T10:00:00Z",
        endTime: "2026-06-02T11:00:00Z",
        resourceId: "r1",
      });

      manager.updateEvent("evt-1", { title: "Updated Title" });
      expect(manager.getEvent("evt-1")?.title).toBe("Updated Title");

      manager.undo();
      expect(manager.getEvent("evt-1")?.title).toBe("Original Title");
    });

    it("undo does nothing when the stack is empty", () => {
      const manager = new SchedulerManager();
      // Should not throw
      manager.undo();
      expect(manager.canUndo()).toBe(false);
    });

    it("enforces a configurable maximum undo stack size (default 20)", () => {
      const manager = new SchedulerManager();

      // Add 22 events — only the last 20 should be undoable
      for (let i = 1; i <= 22; i++) {
        manager.addEvent({
          id: `evt-${i}`,
          title: `Event ${i}`,
          startTime: "2026-06-02T10:00:00Z",
          endTime: "2026-06-02T11:00:00Z",
          resourceId: "r1",
        });
      }

      // Undo 20 times — should all succeed
      for (let i = 0; i < 20; i++) {
        expect(manager.canUndo()).toBe(true);
        manager.undo();
      }

      // 21st undo — stack is empty
      expect(manager.canUndo()).toBe(false);

      // Events 1 and 2 should still exist (they were pushed off the stack)
      expect(manager.getEvent("evt-1")).toBeDefined();
      expect(manager.getEvent("evt-2")).toBeDefined();
    });

    it("respects a custom maxUndoStackSize from config", () => {
      const manager = new SchedulerManager({}, { maxUndoStackSize: 3 });

      // Add 5 events — only the last 3 should be undoable
      for (let i = 1; i <= 5; i++) {
        manager.addEvent({
          id: `evt-${i}`,
          title: `Event ${i}`,
          startTime: "2026-06-02T10:00:00Z",
          endTime: "2026-06-02T11:00:00Z",
          resourceId: "r1",
        });
      }

      // Undo 3 times — should all succeed
      for (let i = 0; i < 3; i++) {
        expect(manager.canUndo()).toBe(true);
        manager.undo();
      }

      // 4th undo — stack is empty
      expect(manager.canUndo()).toBe(false);

      // Events 1 and 2 should still exist (pushed off the stack)
      expect(manager.getEvent("evt-1")).toBeDefined();
      expect(manager.getEvent("evt-2")).toBeDefined();
    });

    it("undo does not push new actions onto the undo stack (no infinite loop)", () => {
      const manager = new SchedulerManager();
      manager.addEvent({
        id: "evt-1",
        title: "Test",
        startTime: "2026-06-02T10:00:00Z",
        endTime: "2026-06-02T11:00:00Z",
        resourceId: "r1",
      });

      manager.updateEvent("evt-1", { title: "Changed" });

      // Stack has 2 items: [addEvent, updateEvent]
      manager.undo(); // undoes updateEvent → calls updateEvent internally, but should NOT push

      // Stack should have 1 item (addEvent), not 2
      expect(manager.canUndo()).toBe(true);
      manager.undo(); // undoes addEvent
      expect(manager.canUndo()).toBe(false);
    });

    it("fires onUndoStateChange hook when undo state changes", async () => {
      const onUndoStateChange = jest.fn();
      const manager = new SchedulerManager({ onUndoStateChange });

      manager.addEvent({
        id: "evt-1",
        title: "Test",
        startTime: "2026-06-02T10:00:00Z",
        endTime: "2026-06-02T11:00:00Z",
        resourceId: "r1",
      });

      // Called with true after adding event (stack went from empty → non-empty)
      expect(onUndoStateChange).toHaveBeenCalledWith(true);

      manager.undo();

      // The undo finalize is deferred to a microtask to prevent async
      // rollback corruption — wait for it to settle.
      await Promise.resolve();

      // Called with false after undo (stack is now empty)
      expect(onUndoStateChange).toHaveBeenCalledWith(false);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Async hook rejection rollback
  // ─────────────────────────────────────────────────────────────────────────
  describe("Async hook rejection rollback", () => {
    it("should rollback event addition if async hook rejects", async () => {
      const onError = jest.fn();
      const manager = new SchedulerManager({
        onEventAdd: () => Promise.reject(new Error("Network error")),
        onError,
      });

      manager.addEvent({
        id: "evt-async-1",
        title: "Async Event",
        startTime: "2026-06-02T10:00:00Z",
        endTime: "2026-06-02T11:00:00Z",
        resourceId: "r1",
      });

      // Wait for the microtask (Promise rejection) to flush
      await new Promise((r) => setTimeout(r, 0));

      expect(schedulerStore.getState().events["evt-async-1"]).toBeUndefined();
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: "addEvent",
          reverted: true,
        }),
      );
    });

    it("should rollback event update if async hook rejects", async () => {
      const onError = jest.fn();
      const setupManager = new SchedulerManager();
      setupManager.addEvent({
        id: "evt-async-2",
        title: "Original",
        startTime: "2026-06-02T10:00:00Z",
        endTime: "2026-06-02T11:00:00Z",
        resourceId: "r1",
      });

      const failManager = new SchedulerManager({
        onEventUpdate: () => Promise.reject(new Error("Update fail")),
        onError,
      });

      failManager.updateEvent("evt-async-2", { title: "Will Fail" });

      await new Promise((r) => setTimeout(r, 0));

      expect(schedulerStore.getState().events["evt-async-2"].title).toBe(
        "Original",
      );
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: "updateEvent",
          reverted: true,
        }),
      );
    });

    it("should rollback event deletion if async hook rejects", async () => {
      const onError = jest.fn();
      const setupManager = new SchedulerManager();
      setupManager.addEvent({
        id: "evt-async-3",
        title: "To Delete",
        startTime: "2026-06-02T10:00:00Z",
        endTime: "2026-06-02T11:00:00Z",
        resourceId: "r1",
      });

      const failManager = new SchedulerManager({
        onEventDelete: () => Promise.reject(new Error("Delete fail")),
        onError,
      });

      failManager.deleteEvent("evt-async-3");

      await new Promise((r) => setTimeout(r, 0));

      expect(schedulerStore.getState().events["evt-async-3"]).toBeDefined();
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: "deleteEvent",
          reverted: true,
        }),
      );
    });

    it("should rollback resource addition if async hook rejects", async () => {
      const onError = jest.fn();
      const manager = new SchedulerManager({
        onResourceAdd: () => Promise.reject(new Error("Add fail")),
        onError,
      });

      manager.addResource({ id: "r-async-1", name: "Async Resource" });

      await new Promise((r) => setTimeout(r, 0));

      expect(schedulerStore.getState().resources["r-async-1"]).toBeUndefined();
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: "addResource",
          reverted: true,
        }),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Edge cases
  // ─────────────────────────────────────────────────────────────────────────
  describe("Edge cases", () => {
    it("getEventsByResource handles events with only resourceId (no resourceIds)", () => {
      const manager = new SchedulerManager();
      const evt = manager.addEvent({
        id: "evt-edge-1",
        title: "Legacy Event",
        startTime: "2026-06-02T10:00:00Z",
        endTime: "2026-06-02T11:00:00Z",
        resourceId: "r-legacy",
      });

      expect(manager.getEventsByResource("r-legacy")).toEqual([evt]);
      expect(manager.getEventsByResource("r-nonexistent")).toEqual([]);
    });

    it("deleteEvent returns false for a non-existent event", () => {
      const manager = new SchedulerManager();
      expect(manager.deleteEvent("non-existent-id")).toBe(false);
    });

    it("updateEvent with occurrence ID that has no parent event still works", () => {
      const manager = new SchedulerManager();
      manager.addEvent({
        id: "evt-occ-test",
        title: "Parent",
        startTime: "2026-06-02T10:00:00Z",
        endTime: "2026-06-02T11:00:00Z",
        resourceId: "r1",
      });

      // Update via base ID (non-occurrence) — simple path
      const updated = manager.updateEvent("evt-occ-test", {
        title: "Updated Parent",
      });
      expect(updated.title).toBe("Updated Parent");
    });

    it("deleteEvent strips occurrence suffix before deleting", () => {
      const manager = new SchedulerManager();
      manager.addEvent({
        id: "evt-del-occ",
        title: "Delete Me",
        startTime: "2026-06-02T10:00:00Z",
        endTime: "2026-06-02T11:00:00Z",
        resourceId: "r1",
      });

      // Delete using an occurrence ID — should resolve to base ID
      const result = manager.deleteEvent("evt-del-occ_occ_1234567890");
      expect(result).toBe(true);
      expect(manager.getEvent("evt-del-occ")).toBeUndefined();
    });

    it("constructor works with no hooks argument", () => {
      const manager = new SchedulerManager();
      // Should not throw on any operation
      manager.addEvent({
        id: "evt-no-hooks",
        title: "No Hooks",
        startTime: "2026-06-02T10:00:00Z",
        endTime: "2026-06-02T11:00:00Z",
        resourceId: "r1",
      });
      manager.updateEvent("evt-no-hooks", { title: "Still Fine" });
      manager.deleteEvent("evt-no-hooks");
      expect(manager.getEventCount()).toBe(0);
    });
  });
});
