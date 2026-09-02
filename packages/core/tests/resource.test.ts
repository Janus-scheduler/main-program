import { Resource } from "../src/models/resources/resources";

describe("Resource Model", () => {
  it("should construct a resource with defaults (person type, empty email)", () => {
    const r = new Resource({
      id: "r1",
      name: "Resource 1",
    });
    expect(r.id).toBe("r1");
    expect(r.name).toBe("Resource 1");
    expect(r.type).toBe("person");
    expect(r.email).toBe("");
    expect(r.isValid()).toBe(false);
  });

  it("should be valid when a person resource has an email", () => {
    const r = new Resource({
      id: "r1",
      name: "Resource 1",
      email: "r1@test.com",
    });
    expect(r.isValid()).toBe(true);
  });

  it("should construct with custom type and email", () => {
    const r = new Resource({
      id: "r1",
      name: "Resource 1",
      type: "room",
      email: "room1@test.com",
    });
    expect(r.type).toBe("room");
    expect(r.email).toBe("room1@test.com");
  });

  it("should be valid for non-person types without an email", () => {
    const r = new Resource({
      id: "r1",
      name: "Resource 1",
      type: "room",
    });
    expect(r.isValid()).toBe(true);
  });

  it("should treat a whitespace-only email as missing for person resources", () => {
    const r = new Resource({
      id: "r1",
      name: "Resource 1",
      type: "person",
      email: "   ",
    });
    expect(r.isValid()).toBe(false);
  });

  it("should return false on isValid if properties are missing", () => {
    const r = new Resource({
      id: "",
      name: "R1",
    });
    expect(r.isValid()).toBe(false);
  });
});
