import { Assignment } from "../src/models/assignments/assignments";

describe("Assignment Model", () => {
  it("should construct a valid assignment with default role", () => {
    const a = new Assignment({
      id: "a1",
      eventId: "e1",
      resourceId: "r1",
    });
    expect(a.id).toBe("a1");
    expect(a.eventId).toBe("e1");
    expect(a.resourceId).toBe("r1");
    expect(a.role).toBe("attendee");
    expect(a.isValid()).toBe(true);
  });

  it("should construct with custom role", () => {
    const a = new Assignment({
      id: "a1",
      eventId: "e1",
      resourceId: "r1",
      role: "organizer",
    });
    expect(a.role).toBe("organizer");
  });

  it("should return false on isValid if properties are missing", () => {
    const a = new Assignment({
      id: "",
      eventId: "e1",
      resourceId: "r1",
    });
    expect(a.isValid()).toBe(false);
  });
});
