import { Event } from "../src/models/events/event";

describe("Event", () => {
  const validData = {
    id: "evt-001",
    title: "Team Meeting",
    startTime: "2025-02-18T14:00:00Z",
    endTime: "2025-02-18T15:00:00Z",
    resourceId: "room-101",
  };

  describe("isValid()", () => {
    it("should return true for a valid event", () => {
      const event = new Event(validData);
      expect(event.isValid()).toBe(true);
    });

    it("should return false when id is missing", () => {
      const event = new Event({ ...validData, id: "" });
      expect(event.isValid()).toBe(false);
    });

    it("should return false when title is missing", () => {
      const event = new Event({ ...validData, title: "" });
      expect(event.isValid()).toBe(false);
    });

    it("should return false when resourceId and resourceIds are missing", () => {
      const event = new Event({
        ...validData,
        resourceId: "",
        resourceIds: [],
      });
      expect(event.isValid()).toBe(false);
    });

    it("should use resourceIds if provided", () => {
      const event = new Event({
        ...validData,
        resourceId: "",
        resourceIds: ["room-101", "room-102"],
      });
      expect(event.isValid()).toBe(true);
      expect(event.resourceIds).toEqual(["room-101", "room-102"]);
      expect(event.resourceId).toBe("room-101");
    });

    it("should return false when startTime is after endTime", () => {
      const event = new Event({
        ...validData,
        startTime: "2025-02-18T16:00:00Z",
        endTime: "2025-02-18T15:00:00Z",
      });
      expect(event.isValid()).toBe(false);
    });
  });

  describe("getDuration()", () => {
    it("should return duration in minutes", () => {
      const event = new Event(validData);
      expect(event.getDuration()).toBe(60); // 1 hour = 60 minutes
    });

    it("should return correct duration for 30-minute event", () => {
      const event = new Event({
        ...validData,
        startTime: "2025-02-18T14:00:00Z",
        endTime: "2025-02-18T14:30:00Z",
      });
      expect(event.getDuration()).toBe(30);
    });
  });

  describe("default values", () => {
    it("should default status to draft when not provided", () => {
      const event = new Event(validData);
      expect(event.status).toBe("draft");
    });

    it("should default description to empty string when not provided", () => {
      const event = new Event(validData);
      expect(event.description).toBe("");
    });
  });
});
