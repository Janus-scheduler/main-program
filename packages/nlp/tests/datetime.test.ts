/**
 * Time-phrase parsing and resolution.
 *
 * This is NEW behaviour, so these are ordinary unit tests — the frozen-parity
 * discipline that governs `parity.test.ts` and `routing.test.ts` does not apply
 * here. There is no Python counterpart to agree with; correctness is judged
 * against the calendar.
 *
 * `now` is injected everywhere, so nothing depends on when the suite runs.
 */

import {
  DEFAULT_DURATION_MINUTES,
  DEFAULT_HOUR,
  PART_OF_DAY_HOURS,
  extractTimeMentions,
  hasTimeAnchor,
  parseTimeSpan,
  resolveTime,
  zonedPartsAt,
  zonedToUtcMs,
} from "../src";

/** Wednesday 2026-08-05, 08:30 UTC. Mid-week on purpose, so weekday maths
 *  has room to move in both directions. */
const NOW = new Date("2026-08-05T08:30:00.000Z");
const UTC = "UTC";

/** Resolve in UTC unless a test says otherwise. */
function resolve(text: string, timezone = UTC, now: Date = NOW) {
  return resolveTime(parseTimeSpan(text), { now, timezone });
}

describe("zonedToUtcMs / zonedPartsAt", () => {
  it("round-trips a wall-clock time through UTC", () => {
    const ms = zonedToUtcMs(2026, 8, 5, 14, 30, "Asia/Colombo");
    const parts = zonedPartsAt(ms, "Asia/Colombo");
    expect(parts).toMatchObject({
      year: 2026,
      month: 8,
      day: 5,
      hour: 14,
      minute: 30,
    });
  });

  it("applies a fixed offset correctly (Asia/Colombo, UTC+5:30)", () => {
    // 14:30 Colombo == 09:00 UTC
    expect(zonedToUtcMs(2026, 8, 5, 14, 30, "Asia/Colombo")).toBe(
      Date.UTC(2026, 7, 5, 9, 0),
    );
  });

  it("handles midnight without rolling to the previous day", () => {
    const ms = zonedToUtcMs(2026, 8, 5, 0, 0, "Asia/Tokyo");
    expect(zonedPartsAt(ms, "Asia/Tokyo")).toMatchObject({
      year: 2026,
      month: 8,
      day: 5,
      hour: 0,
      minute: 0,
    });
  });

  /**
   * The reason `zonedToUtcMs` samples the offset twice. A single-pass
   * conversion measures the offset at the nominal UTC instant, which sits on
   * the wrong side of a transition for times near it, and lands an hour out.
   */
  describe("DST boundaries", () => {
    it("resolves a time just after US spring-forward (2026-03-08, EST→EDT)", () => {
      // 03:00 EDT on the transition day == 07:00 UTC (offset is now -4).
      const ms = zonedToUtcMs(2026, 3, 8, 3, 0, "America/New_York");
      expect(ms).toBe(Date.UTC(2026, 2, 8, 7, 0));
      expect(zonedPartsAt(ms, "America/New_York")).toMatchObject({
        day: 8,
        hour: 3,
      });
    });

    it("resolves a time just before US spring-forward", () => {
      // 01:00 EST == 06:00 UTC (offset still -5).
      expect(zonedToUtcMs(2026, 3, 8, 1, 0, "America/New_York")).toBe(
        Date.UTC(2026, 2, 8, 6, 0),
      );
    });

    it("resolves a time after US fall-back (2026-11-01, EDT→EST)", () => {
      // 03:00 EST == 08:00 UTC.
      const ms = zonedToUtcMs(2026, 11, 1, 3, 0, "America/New_York");
      expect(ms).toBe(Date.UTC(2026, 10, 1, 8, 0));
      expect(zonedPartsAt(ms, "America/New_York")).toMatchObject({
        day: 1,
        hour: 3,
      });
    });

    it("round-trips the wall-clock hour across a Europe/London transition", () => {
      // 2026-03-29 is the UK spring-forward. 10:00 BST must come back as 10:00.
      const ms = zonedToUtcMs(2026, 3, 29, 10, 0, "Europe/London");
      expect(zonedPartsAt(ms, "Europe/London")).toMatchObject({
        day: 29,
        hour: 10,
      });
    });

    it("a nonexistent spring-forward time resolves to a real instant", () => {
      // 02:30 on 2026-03-08 in New York does not exist — the clock jumps
      // 02:00 → 03:00. The result must still be a valid instant, and must not
      // silently land on the previous day.
      const ms = zonedToUtcMs(2026, 3, 8, 2, 30, "America/New_York");
      expect(Number.isFinite(ms)).toBe(true);
      expect(zonedPartsAt(ms, "America/New_York").day).toBe(8);
    });
  });
});

describe("extractTimeMentions", () => {
  it("finds a clock time and reports its span", () => {
    const [m] = extractTimeMentions("meet at 10am please");
    expect(m).toMatchObject({ kind: "clock", text: "10am" });
    expect("meet at 10am please".slice(m.start, m.end)).toBe("10am");
  });

  it.each([
    ["10am", 10, 0],
    ["10:30am", 10, 30],
    ["12am", 0, 0],
    ["12pm", 12, 0],
    ["1pm", 13, 0],
    ["11:45 PM", 23, 45],
  ])("parses %s as %i:%i", (text, hour, minute) => {
    const [m] = extractTimeMentions(`at ${text}`);
    expect(m.clock).toEqual({ hour, minute });
  });

  it("prefers the longer match when phrases overlap", () => {
    // "next monday" must be ONE relativeWeekday, not relativeUnit + weekday.
    const mentions = extractTimeMentions("move it to next monday");
    expect(mentions).toHaveLength(1);
    expect(mentions[0]).toMatchObject({
      kind: "relativeWeekday",
      direction: "next",
      weekday: 1,
    });
  });

  it("finds several mentions in one sentence, in document order", () => {
    const mentions = extractTimeMentions(
      "tomorrow afternoon at 2pm for 30 minutes",
    );
    expect(mentions.map((m) => m.kind)).toEqual([
      "tomorrow",
      "partOfDay",
      "clock",
      "duration",
    ]);
    for (let i = 1; i < mentions.length; i++) {
      expect(mentions[i].start).toBeGreaterThanOrEqual(mentions[i - 1].end);
    }
  });

  it.each([
    ["for 30 minutes", 30],
    ["for 45 mins", 45],
    ["for 2 hours", 120],
    ["for an hour", 60],
    ["for a day", 480],
  ])("parses duration %s as %i minutes", (text, minutes) => {
    const span = parseTimeSpan(`book it tomorrow ${text}`);
    expect(span?.durationMinutes).toBe(minutes);
  });

  it("returns nothing for text with no time phrase", () => {
    expect(extractTimeMentions("book the boardroom")).toEqual([]);
    expect(parseTimeSpan("book the boardroom")).toBeUndefined();
  });

  /**
   * Extraction and the frozen `hasTimeAnchor()` must agree on what counts as a
   * time. If they drift, an utterance can clear gate 5 ("has a time") and then
   * produce no resolvable time — the user gets a parse card with an empty when.
   */
  it("agrees with the frozen hasTimeAnchor on what is a time", () => {
    const phrases = [
      "tomorrow at 10am",
      "next monday",
      "this afternoon",
      "tonight",
      "at noon",
      "in 30 minutes",
      "on friday",
      "next week",
      "today",
      "at midnight",
    ];
    for (const phrase of phrases) {
      expect(hasTimeAnchor(phrase)).toBe(true);
      expect(extractTimeMentions(phrase).length).toBeGreaterThan(0);
    }
  });
});

describe("resolveTime — dates", () => {
  it("resolves 'tomorrow at 10am'", () => {
    const r = resolve("schedule a sync tomorrow at 10am")!;
    expect(r.localDate).toBe("2026-08-06");
    expect(r.localTime).toBe("10:00");
    expect(r.weekday).toBe("thursday");
    expect(r.startISO).toBe("2026-08-06T10:00:00.000Z");
  });

  it("resolves 'today at 4pm'", () => {
    const r = resolve("call at 4pm today")!;
    expect(r.localDate).toBe("2026-08-05");
    expect(r.localTime).toBe("16:00");
  });

  it("'tonight' is today, in the evening", () => {
    const r = resolve("drinks tonight")!;
    expect(r.localDate).toBe("2026-08-05");
    expect(r.localTime).toBe(
      `${String(PART_OF_DAY_HOURS.night).padStart(2, "0")}:00`,
    );
  });

  it.each([
    ["monday", "2026-08-10"],
    ["tuesday", "2026-08-11"],
    ["thursday", "2026-08-06"],
    ["friday", "2026-08-07"],
  ])("a bare weekday '%s' means the next one", (day, expected) => {
    expect(resolve(`meet on ${day}`)!.localDate).toBe(expected);
  });

  it("a bare weekday naming TODAY means a week away, not today", () => {
    // NOW is a Wednesday. "wednesday" must not resolve to today — the time may
    // already have passed, and scheduling into the past is never the intent.
    expect(resolve("meet on wednesday")!.localDate).toBe("2026-08-12");
  });

  /**
   * `now` is Wednesday 2026-08-05, so the Sunday-started weeks are
   * Aug 2–8 (this) and Aug 9–15 (next).
   *
   * Note "next monday" and a bare "monday" both give Aug 10 here, and that is
   * correct rather than a collision: when the named day already lies ahead in
   * the coming week, the two phrasings genuinely mean the same day. They only
   * diverge for a day still to come in the CURRENT week — see the friday pair
   * below, where bare "friday" is Aug 7 but "next friday" is Aug 14.
   */
  it.each([
    ["next monday", "2026-08-10"],
    ["this monday", "2026-08-03"],
    ["last monday", "2026-07-27"],
    ["next friday", "2026-08-14"],
    ["this friday", "2026-08-07"],
  ])("'%s' resolves to %s", (phrase, expected) => {
    expect(resolve(`move it to ${phrase}`)!.localDate).toBe(expected);
  });

  it("distinguishes a bare weekday from 'next <weekday>' within this week", () => {
    expect(resolve("meet on friday")!.localDate).toBe("2026-08-07");
    expect(resolve("meet on next friday")!.localDate).toBe("2026-08-14");
  });

  it.each([
    ["next week", "2026-08-12"],
    ["last week", "2026-07-29"],
    ["this week", "2026-08-05"],
    ["next month", "2026-09-05"],
    ["next quarter", "2026-11-05"],
    ["next year", "2027-08-05"],
  ])("'%s' resolves to %s", (phrase, expected) => {
    expect(resolve(`schedule it ${phrase}`)!.localDate).toBe(expected);
  });

  it("month arithmetic clamps to the target month's length", () => {
    // 31 Jan + 1 month is 28 Feb, not 3 March.
    const jan31 = new Date("2026-01-31T08:00:00.000Z");
    expect(resolve("do it next month", UTC, jan31)!.localDate).toBe(
      "2026-02-28",
    );
  });

  it("week rollover crosses a month boundary correctly", () => {
    const aug28 = new Date("2026-08-28T08:00:00.000Z");
    expect(resolve("do it next week", UTC, aug28)!.localDate).toBe(
      "2026-09-04",
    );
  });

  it("year rollover works across new year", () => {
    const dec30 = new Date("2026-12-30T08:00:00.000Z");
    expect(resolve("do it next week", UTC, dec30)!.localDate).toBe(
      "2027-01-06",
    );
  });

  /**
   * "next sprint" is an organisational concept with no calendar definition this
   * package can know. Refusing to guess is deliberate: an unresolved time flows
   * to CLARIFY and the user gets asked, which is what gate 5 already does.
   */
  it("returns null for 'next sprint' rather than guessing", () => {
    expect(resolve("move it to next sprint")).toBeNull();
  });
});

describe("resolveTime — times of day", () => {
  it.each([
    ["morning", PART_OF_DAY_HOURS.morning],
    ["afternoon", PART_OF_DAY_HOURS.afternoon],
    ["evening", PART_OF_DAY_HOURS.evening],
  ])("'tomorrow %s' uses the %i:00 default", (part, hour) => {
    const r = resolve(`meet tomorrow ${part}`)!;
    expect(r.localTime).toBe(`${String(hour).padStart(2, "0")}:00`);
    expect(r.assumptions.join(" ")).toContain(part);
  });

  it("an explicit clock beats a part-of-day in the same sentence", () => {
    const r = resolve("meet tomorrow afternoon at 2pm")!;
    expect(r.localTime).toBe("14:00");
    expect(r.assumptions.join(" ")).not.toContain("afternoon");
  });

  it("noon and midnight resolve to 12:00 and 00:00", () => {
    expect(resolve("lunch tomorrow at noon")!.localTime).toBe("12:00");
    expect(resolve("deploy tomorrow at midnight")!.localTime).toBe("00:00");
  });

  describe("a clock time with no date", () => {
    it("means today when that time is still ahead", () => {
      // NOW is 08:30 UTC; 4pm has not happened yet.
      const r = resolve("call at 4pm")!;
      expect(r.localDate).toBe("2026-08-05");
      expect(r.assumptions).toContain("no date given — assumed today");
    });

    it("means tomorrow when that time has already passed", () => {
      // 6am is behind 08:30.
      const r = resolve("call at 6am")!;
      expect(r.localDate).toBe("2026-08-06");
      expect(r.assumptions.join(" ")).toContain("that time has passed");
    });
  });
});

/**
 * `assumed` is what a UI reads to decide which chip to mark. It has to stay in
 * step with `assumptions`, and the pair must never disagree — the first bug
 * here was a UI regex that matched one wording of "I chose this hour" and not
 * the other, so an invented 09:00 was rendered as though the user had said it.
 */
describe("resolveTime — structured assumption flags", () => {
  it("flags an hour invented from a part of day", () => {
    const r = resolve("meet tomorrow morning")!;
    expect(r.localTime).toBe("09:00");
    expect(r.assumed.timeOfDay).toBe(true);
    expect(r.assumed.date).toBe(false);
  });

  it("flags an hour invented from the working-day default", () => {
    const r = resolve("meet tomorrow")!;
    expect(r.localTime).toBe("09:00");
    expect(r.assumed.timeOfDay).toBe(true);
  });

  it("does not flag an hour the user actually gave", () => {
    const r = resolve("meet tomorrow at 3pm")!;
    expect(r.assumed.timeOfDay).toBe(false);
    expect(r.assumed.date).toBe(false);
  });

  it("flags a date that was inferred from a bare clock time", () => {
    const r = resolve("call at 4pm")!;
    expect(r.assumed.date).toBe(true);
    expect(r.assumed.timeOfDay).toBe(false);
  });

  it("flags the default duration and not an explicit one", () => {
    expect(resolve("meet tomorrow at 10am")!.assumed.duration).toBe(true);
    expect(
      resolve("meet tomorrow at 10am for 30 minutes")!.assumed.duration,
    ).toBe(false);
  });

  it.each([
    "meet tomorrow morning",
    "meet tomorrow",
    "meet tomorrow at 3pm",
    "call at 4pm",
    "call at 6am",
    "meet next friday at 2pm for 90 minutes",
    "lunch today at noon",
  ])("flags and prose agree exactly for %p", (text) => {
    const r = resolve(text)!;
    // Every flag that is set must have produced a sentence, and the count of
    // sentences must equal the count of flags. Neither can drift silently.
    const flagged = Object.values(r.assumed).filter(Boolean).length;
    expect(r.assumptions).toHaveLength(flagged);
  });
});

describe("resolveTime — duration and assumptions", () => {
  it("uses an explicit duration and records no assumption for it", () => {
    const r = resolve("meet tomorrow at 10am for 30 minutes")!;
    expect(r.durationMinutes).toBe(30);
    expect(r.endISO).toBe("2026-08-06T10:30:00.000Z");
    expect(r.assumptions.join(" ")).not.toContain("duration");
  });

  it("defaults the duration and says so", () => {
    const r = resolve("meet tomorrow at 10am")!;
    expect(r.durationMinutes).toBe(DEFAULT_DURATION_MINUTES);
    expect(r.assumptions.join(" ")).toContain("duration");
  });

  it("defaults the time of day and says so", () => {
    const r = resolve("meet tomorrow")!;
    expect(r.localTime).toBe(`${String(DEFAULT_HOUR).padStart(2, "0")}:00`);
    expect(r.assumptions.join(" ")).toContain("no time of day");
  });

  /**
   * The parse card is a verification surface. Anything the resolver invented
   * has to be visible, or the user is confirming something they were never
   * shown.
   */
  it("states every invented value when the user gave only a date", () => {
    const r = resolve("something tomorrow")!;
    expect(r.assumptions).toHaveLength(2); // time of day + duration
  });

  it("states nothing when the user gave everything", () => {
    const r = resolve("meet tomorrow at 10am for 45 minutes")!;
    expect(r.assumptions).toEqual([]);
  });

  it("end is always after start", () => {
    for (const text of [
      "tomorrow at 10am",
      "next monday morning",
      "tonight",
      "at noon today",
    ]) {
      const r = resolve(text)!;
      expect(r.endMs).toBeGreaterThan(r.startMs);
      expect(new Date(r.endISO).getTime()).toBe(r.endMs);
      expect(new Date(r.startISO).getTime()).toBe(r.startMs);
    }
  });

  it("returns null when there is no time phrase at all", () => {
    expect(resolve("book the boardroom")).toBeNull();
    expect(resolveTime(undefined, { now: NOW, timezone: UTC })).toBeNull();
  });
});

describe("resolveTime — timezones", () => {
  it("resolves the wall-clock time in the caller's timezone, not UTC", () => {
    const r = resolve("meet tomorrow at 10am", "Asia/Colombo")!;
    expect(r.localDate).toBe("2026-08-06");
    expect(r.localTime).toBe("10:00");
    // 10:00 Colombo == 04:30 UTC
    expect(r.startISO).toBe("2026-08-06T04:30:00.000Z");
    expect(r.timezone).toBe("Asia/Colombo");
  });

  it("'today' follows the caller's timezone, not the host's", () => {
    // 2026-08-05T20:00Z is already 2026-08-06 in Tokyo (UTC+9).
    const lateUtc = new Date("2026-08-05T20:00:00.000Z");
    expect(
      resolve("meet today at 11pm", "Asia/Tokyo", lateUtc)!.localDate,
    ).toBe("2026-08-06");
    expect(resolve("meet today at 11pm", UTC, lateUtc)!.localDate).toBe(
      "2026-08-05",
    );
  });

  it("a meeting spanning a DST transition still has the right duration", () => {
    // 2026-11-01 01:30 New York, 60 minutes, across the fall-back hour.
    const nov1 = new Date("2026-11-01T00:00:00.000Z");
    const r = resolve("meet at 1am for 60 minutes", "America/New_York", nov1)!;
    expect(r.endMs - r.startMs).toBe(60 * 60_000);
  });

  it("throws on an invalid timezone rather than silently using UTC", () => {
    expect(() =>
      resolveTime(parseTimeSpan("tomorrow at 10am"), {
        now: NOW,
        timezone: "Not/AZone",
      }),
    ).toThrow();
  });

  it("resolves time ranges (e.g. 5pm to 7pm) and calculates exact duration", () => {
    const r = resolve("meeting tomorrow at 5pm to 7pm")!;
    expect(r.localDate).toBe("2026-08-06");
    expect(r.localTime).toBe("17:00");
    expect(r.durationMinutes).toBe(120);
    expect(r.assumed.duration).toBe(false);
  });

  it("resolves time ranges like '5pm to 6pm' without assuming duration", () => {
    const r = resolve("schedule a meeting on this monday at 5pm to 6pm")!;
    expect(r.localTime).toBe("17:00");
    expect(r.durationMinutes).toBe(60);
    expect(r.assumed.duration).toBe(false);
  });

  it("resolves time ranges without start meridiem like '5 to 7pm'", () => {
    const r = resolve("meeting tomorrow from 5 to 7pm")!;
    expect(r.localTime).toBe("17:00");
    expect(r.durationMinutes).toBe(120);
    expect(r.assumed.duration).toBe(false);
  });

  it("resolves minute ranges like '10:00 to 11:30 am'", () => {
    const r = resolve("call tomorrow from 10:00 to 11:30 am")!;
    expect(r.localTime).toBe("10:00");
    expect(r.durationMinutes).toBe(90);
    expect(r.assumed.duration).toBe(false);
  });

  it("resolves explicit calendar dates like 'August 18' and '18th of August'", () => {
    const r1 = resolve("meeting on August 18 at 2pm")!;
    expect(r1.localDate).toBe("2026-08-18");
    expect(r1.localTime).toBe("14:00");
    expect(r1.assumed.date).toBe(false);
    expect(r1.assumed.timeOfDay).toBe(false);

    const r2 = resolve("sync on 18th of August at 10am")!;
    expect(r2.localDate).toBe("2026-08-18");
    expect(r2.localTime).toBe("10:00");
    expect(r2.assumed.date).toBe(false);

    const r3 = resolve("review on Aug 18, 2027 at 3pm")!;
    expect(r3.localDate).toBe("2027-08-18");
    expect(r3.localTime).toBe("15:00");

    const r4 = resolve("book room on September 25th at 9am")!;
    expect(r4.localDate).toBe("2026-09-25");
    expect(r4.localTime).toBe("09:00");

    const r5 = resolve("demo on Oct 12, 2026 at 4:30pm")!;
    expect(r5.localDate).toBe("2026-10-12");
    expect(r5.localTime).toBe("16:30");

    const r6 = resolve("annual meeting on 15th of December")!;
    expect(r6.localDate).toBe("2026-12-15");
    expect(r6.assumed.date).toBe(false);
    expect(r6.assumed.timeOfDay).toBe(true);
  });
});
