import { JanusEventBus, janusEventBus } from "../src/api/EventBus";

describe("JanusEventBus", () => {
  it("should subscribe, emit, and unsubscribe from events", () => {
    const bus = new JanusEventBus();
    const mockHandler = jest.fn();

    // Subscribe
    bus.on("add-event", mockHandler);

    // Emit
    bus.emit("add-event", undefined);
    expect(mockHandler).toHaveBeenCalledWith(undefined);

    // Unsubscribe
    bus.off("add-event", mockHandler);
    bus.emit("add-event", undefined);
    expect(mockHandler).toHaveBeenCalledTimes(1); // No new calls
  });

  it("should not crash on off when no listeners exist", () => {
    const bus = new JanusEventBus();
    expect(() => bus.off("add-event", jest.fn())).not.toThrow();
  });

  it("should catch errors thrown by handlers and log them", () => {
    const bus = new JanusEventBus();
    const badHandler = () => {
      throw new Error("Bad handler error");
    };
    const goodHandler = jest.fn();

    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    bus.on("add-event", badHandler);
    bus.on("add-event", goodHandler);

    bus.emit("add-event", undefined);

    expect(goodHandler).toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  it("should export a default singleton instance", () => {
    expect(janusEventBus).toBeInstanceOf(JanusEventBus);
  });
});
