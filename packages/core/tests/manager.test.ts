import { SchedulerManager } from "../src/services/SchedulerManager.service";
import { schedulerStore } from "../src/store/scheduler.store";

describe("SchedulerManager", () => {
  beforeEach(() => {
    schedulerStore.getState().clearAll();
  });

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
  });

  it("should roll back event addition if the hook throws an error", () => {
    const onErrorMock = jest.fn();
    const manager = new SchedulerManager({
      onEventAdd: () => {
        throw new Error("API Failure");
      },
      onError: onErrorMock,
    });

    try {
      manager.addEvent({
        id: "evt-1",
        title: "Test Event",
        startTime: "2026-06-02T10:00:00Z",
        endTime: "2026-06-02T11:00:00Z",
        resourceId: "r1",
      });
    } catch (e) {
      // Ignored for testing synchronous catch rollback
    }

    expect(schedulerStore.getState().events["evt-1"]).toBeUndefined();
    expect(onErrorMock).toHaveBeenCalled();
  });
});
