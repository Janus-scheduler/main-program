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

  it("should accurately round-trip date and time across various timezones", () => {
    const testCases = [
      { tz: "America/New_York", date: "2026-01-15", time: "09:30" }, // Winter (EST, UTC-5)
      { tz: "America/New_York", date: "2026-07-15", time: "14:00" }, // Summer (EDT, UTC-4)
      { tz: "Europe/London", date: "2026-01-15", time: "10:00" }, // GMT (UTC+0)
      { tz: "Europe/London", date: "2026-07-15", time: "10:00" }, // BST (UTC+1)
      { tz: "Asia/Colombo", date: "2026-06-02", time: "17:45" }, // UTC+5:30
      { tz: "Asia/Tokyo", date: "2026-11-20", time: "23:15" }, // UTC+9
      { tz: "America/St_Johns", date: "2026-07-10", time: "08:30" }, // Newfoundland (UTC-2:30)
    ];

    for (const { tz, date, time } of testCases) {
      const iso = zonedInputToISO(date, time, tz);
      const display = isoToZonedDisplay(iso, tz);
      expect(display.date).toBe(date);
      expect(display.time).toBe(time);
    }
  });

  it("should correctly handle DST transitions with 2-pass sampling", () => {
    // US Spring forward 2026: March 8, 2026 at 2:00 AM -> 3:00 AM
    const preDst = zonedInputToISO("2026-03-08", "01:30", "America/New_York");
    const postDst = zonedInputToISO("2026-03-08", "03:30", "America/New_York");

    expect(isoToZonedDisplay(preDst, "America/New_York")).toEqual({
      date: "2026-03-08",
      time: "01:30",
    });
    expect(isoToZonedDisplay(postDst, "America/New_York")).toEqual({
      date: "2026-03-08",
      time: "03:30",
    });

    // Exactly 1 hour difference in real time between 1:30 AM EST and 3:30 AM EDT
    const diffMs = new Date(postDst).getTime() - new Date(preDst).getTime();
    expect(diffMs).toBe(60 * 60 * 1000);
  });

  it("should fallback to default timezones when Intl.supportedValuesOf throws or is unavailable", () => {
    const originalSupported = Intl.supportedValuesOf;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (Intl as any).supportedValuesOf = undefined;
      const list = getAllTimezones();
      expect(list).toContain("UTC");
      expect(list).toContain("America/New_York");
    } finally {
      Intl.supportedValuesOf = originalSupported;
    }
  });

  it("should handle toFakeLocalDate edge cases and hour 24 wrap-around", () => {
    const ts = new Date("2026-06-02T23:59:59Z").getTime();
    const fake = toFakeLocalDate(ts, "UTC");
    expect(fake.getUTCFullYear()).toBe(2026);
  });
});
