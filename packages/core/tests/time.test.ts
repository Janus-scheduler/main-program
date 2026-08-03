import {
  getBrowserTimezone,
  isoToZonedDisplay,
  getUtcMsForZonedDatetime,
  zonedInputToISO,
  toFakeLocalDate,
  formatTimezoneLabel,
  getAllTimezones,
} from "../src/utils/time";

describe("Time Utilities", () => {
  it("should return the browser timezone", () => {
    const tz = getBrowserTimezone();
    expect(typeof tz).toBe("string");
    expect(tz.length).toBeGreaterThan(0);
  });

  it("should convert UTC ISO string to zoned display date and time", () => {
    const iso = "2026-06-02T10:00:00Z";
    const zoned = isoToZonedDisplay(iso, "Asia/Kolkata");
    expect(zoned.date).toBe("2026-06-02");
    expect(zoned.time).toBe("15:30");

    const zonedUtc = isoToZonedDisplay(iso, "UTC");
    expect(zonedUtc.date).toBe("2026-06-02");
    expect(zonedUtc.time).toBe("10:00");
  });

  it("should get UTC milliseconds for zoned datetime", () => {
    const ms = getUtcMsForZonedDatetime("2026-06-02", "15:30", "Asia/Kolkata");
    const expected = Date.UTC(2026, 5, 2, 10, 0, 0); // Month is 0-indexed (5 = June)
    expect(ms).toBe(expected);
  });

  it("should convert zoned input to ISO string", () => {
    const iso = zonedInputToISO("2026-06-02", "15:30", "Asia/Kolkata");
    expect(iso).toBe("2026-06-02T10:00:00.000Z");
  });

  it("should create a fake local Date reflecting the target timezone", () => {
    const ts = Date.UTC(2026, 5, 2, 10, 0, 0);
    const date = toFakeLocalDate(ts, "Asia/Kolkata");
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(5); // June
    expect(date.getDate()).toBe(2);
    expect(date.getHours()).toBe(15);
    expect(date.getMinutes()).toBe(30);
  });

  it("should format timezone label with offset", () => {
    const label = formatTimezoneLabel("Asia/Kolkata");
    expect(label).toContain("Asia/Kolkata");
    // Verify it contains GMT or UTC or some offset prefix
    expect(label).toMatch(/(GMT|UTC)/);
  });

  it("should handle formatTimezoneLabel fallback on invalid timezone", () => {
    const label = formatTimezoneLabel("invalid-timezone");
    expect(label).toBe("invalid-timezone");
  });

  it("should return all timezones", () => {
    const list = getAllTimezones();
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBeGreaterThan(0);
    expect(list).toContain("Europe/London");
  });
});
