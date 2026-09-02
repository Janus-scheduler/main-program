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

  /**
   * REGRESSION — every fractional duration used to resolve to 300 minutes.
   *
   * `\b(\d+)` cannot span a decimal point, so the match restarted after it and
   * captured the fractional digits as the whole number: "1.5 hours" → "5" →
   * 5 hours. "0.5 hours" and "2.5 hrs" collapsed to the same 300. A half-hour
   * meeting was booked as five hours, with no assumption flag, and the card
   * showed "5 hr" as though the user had said it.
   */
  it.each([
    ["1.5 hours", 90],
    ["1.5 hrs", 90],
    ["2.5 hrs", 150],
    ["0.5 hours", 30],
    ["1.25 hours", 75],
    ["1.5 minutes", 1.5],
  ])("parses fractional duration %s as %i minutes", (text, minutes) => {
    const span = parseTimeSpan(`book it tomorrow for ${text}`);
    expect(span?.durationMinutes).toBe(minutes);
  });

  /**
   * REGRESSION — the dialogue layer accepted "45mins" through a looser regex of
   * its own (`\s*`) while this module required `\s+`, so the answer was merged
   * into the utterance and then never parsed back out. `assumed.duration`
   * stayed true, the duration question repeated, and the conversation ran into
   * the round cap. There is one duration regex now.
   */
  it.each([
    ["45mins", 45],
    ["45min", 45],
    ["2hrs", 120],
    ["2hr", 120],
    ["30minutes", 30],
    ["1.5hours", 90],
  ])("parses unspaced duration %s as %i minutes", (text, minutes) => {
    const span = parseTimeSpan(`book it tomorrow for ${text}`);
    expect(span?.durationMinutes).toBe(minutes);
  });

  it("does not mistake a clock time for a duration", () => {
    const span = parseTimeSpan("book it tomorrow at 3pm");
    expect(span?.durationMinutes).toBeUndefined();
    expect(span?.clock).toEqual({ hour: 15, minute: 0 });
  });

  /**
   * REGRESSION — "on the 25th at 9am" silently dropped the day.
   *
   * No mention pattern matched a bare ordinal, so the date component stayed
   * empty and the event was booked on whatever the rest of the sentence
   * defaulted to — today, or tomorrow. The card showed that wrong date
   * confidently, with no assumption disclosed, because as far as the resolver
   * was concerned the user had never given a date at all.
   */
  describe("bare day-of-month", () => {
    const on = (text: string, now = NOW) => resolve(text, UTC, now);

    // NOW is Wednesday 2026-08-05, so the 25th is still ahead in August while
    // the 3rd has passed and belongs to September.
    it.each([
      ["book it on the 25th at 9am", "2026-08-25"],
      ["book it the 3rd at 2pm", "2026-09-03"],
      ["book it on the 25th", "2026-08-25"],
      ["book it the 25th, please", "2026-08-25"],
    ])("%s resolves to %s", (text, date) => {
      expect(on(text)!.localDate).toBe(date);
    });

    it("treats today's date as today, not four weeks away", () => {
      // NOW is the 5th; "the 5th" means now, not next month.
      expect(on("book it the 5th at 9am")!.localDate).toBe("2026-08-05");
    });

    it("rolls past months that are too short", () => {
      // From 31 January, "the 30th" cannot be February.
      const jan31 = new Date("2026-01-31T08:30:00.000Z");
      expect(on("book it the 30th at 9am", jan31)!.localDate).toBe(
        "2026-03-30",
      );
    });

    /**
     * The guard that took two attempts. An ordinal used as an ADJECTIVE is
     * followed by the noun it modifies; a date is not. Without the trailing
     * lookahead, "the 3rd" in "the 3rd floor" won on position and booked
     * 3 September instead of tomorrow.
     */
    it.each([
      "book the 3rd floor room tomorrow at 9am",
      "book the 2nd meeting room tomorrow at 9am",
      "reserve the 1st aid room tomorrow at 9am",
    ])("does not read an adjective as a date: %s", (text) => {
      expect(on(text)!.localDate).toBe("2026-08-06"); // tomorrow, from NOW
    });

    it("leaves an explicit month name to the monthDate path", () => {
      const span = parseTimeSpan("book it August 25th at 9am");
      expect(span?.date?.kind).toBe("monthDate");
    });

    it("ignores an impossible day rather than inventing one", () => {
      expect(parseTimeSpan("book it the 45th at 9am")?.date).toBeUndefined();
    });
  });

  /**
   * A calendar date that only resolved by adding a whole year.
   *
   * "August 25th" said on 30 August became August 2027 — twelve months from a
   * date five days gone, presented on a confident card with nothing disclosed.
   * Rolling forward is right in general and wrong just after the fact, so the
   * near case is flagged for the dialogue layer to ask about.
   */
  describe("stale year roll", () => {
    const AUG30 = new Date("2026-08-30T09:00:00.000Z");
    const DEC20 = new Date("2026-12-20T09:00:00.000Z");
    const at = (text: string, now: Date) => resolve(text, UTC, now);

    it("flags a date a few days past", () => {
      const r = at("book it August 25th at 9am", AUG30);
      expect(r!.localDate).toBe("2027-08-25");
      expect(r!.staleYearRoll).toBe(true);
      expect(r!.statedDate).toBe("2026-08-25");
    });

    it("does not flag a date still ahead", () => {
      const r = at("book it August 31st at 9am", AUG30);
      expect(r!.localDate).toBe("2026-08-31");
      expect(r!.staleYearRoll).toBe(false);
    });

    it("flags inside the window but not outside it", () => {
      // 41 days back — a plausible misremembering.
      expect(at("book it July 20th at 9am", AUG30)!.staleYearRoll).toBe(true);
      // 90 days back — far enough that next year is the honest reading.
      expect(at("book it June 1st at 9am", AUG30)!.staleYearRoll).toBe(false);
    });

    /**
     * The case that must stay silent. Said in December, "January 5th" is next
     * January — it is a forward date, not a roll, and flagging it would put a
     * question in front of an ordinary booking.
     */
    it("says nothing about a forward date that crosses new year", () => {
      const r = at("book it January 5th at 9am", DEC20);
      expect(r!.localDate).toBe("2027-01-05");
      expect(r!.staleYearRoll).toBe(false);
    });

    it("respects an explicitly stated year", () => {
      // The user named the year, so there is nothing to second-guess.
      const r = at("book it August 25th 2027 at 9am", AUG30);
      expect(r!.staleYearRoll).toBe(false);
    });
  });

  /**
   * REGRESSION — "yesterday" matched no pattern at all.
   *
   * It was silently ignored, so the date fell back to today: the user asked for
   * yesterday and got today, with nothing disclosed. Recognising it also makes
   * it an EXPLICIT past reference, which is what keeps the past-date question
   * quiet for it.
   */
  describe("yesterday", () => {
    it("resolves to the day before, not to today", () => {
      const r = resolve("book it yesterday at 3pm");
      expect(r!.localDate).toBe("2026-08-04"); // NOW is 2026-08-05
      expect(r!.localTime).toBe("15:00");
    });

    it("counts as asking for the past, so nothing is flagged", () => {
      expect(resolve("book it yesterday at 3pm")!.resolvedInPast).toBe(false);
    });
  });

  /**
   * A resolved instant that landed behind `now` without being asked to.
   *
   * A backstop, not a fix for one phrase: most paths roll forward on their own
   * (a bare clock to tomorrow, a bare weekday to the next one), so this catches
   * what does not — and anything that regresses that way in future.
   */
  describe("resolvedInPast", () => {
    // Thursday 2026-09-03, 14:00 in Colombo — morning times have gone.
    const AFTERNOON = new Date("2026-09-03T08:30:00.000Z");
    const at = (text: string) => resolve(text, "Asia/Colombo", AFTERNOON);

    it("flags today at an hour that has passed", () => {
      const r = at("book it today at 9am");
      expect(r!.localDate).toBe("2026-09-03");
      expect(r!.resolvedInPast).toBe(true);
    });

    it.each([
      "book it yesterday at 3pm",
      "book it last monday at 3pm",
      "book it last week at 3pm",
      "book it August 25 2025 at 3pm",
    ])("stays quiet when the past was asked for: %s", (text) => {
      expect(at(text)!.resolvedInPast).toBe(false);
    });

    it.each([
      "book it at 9am",
      "book it tomorrow at 3pm",
      "book it at 11pm",
      "book it monday at 3pm",
    ])("is not set for a future instant: %s", (text) => {
      const r = at(text)!;
      expect(r.startMs).toBeGreaterThan(AFTERNOON.getTime());
      expect(r.resolvedInPast).toBe(false);
    });
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

// ══════════════════════════════════════════════════════════════════════════
//  Conversational clock phrases  (Tier 3 · A6 + D10)
//
//  "half past two" matched no pattern at all, so the time fell back to the
//  09:00 default AND the unclaimed words fell through to become the event
//  title. One missing pattern, two visible defects.
// ══════════════════════════════════════════════════════════════════════════

describe("half past / quarter past / quarter to", () => {
  it.each([
    ["tomorrow at half past two", "14:30"],
    ["tomorrow at half past 2", "14:30"],
    ["tomorrow at half past nine", "09:30"],
    ["tomorrow at half past twelve", "12:30"],
    ["tomorrow at half past eleven", "11:30"],
    ["tomorrow at quarter past three", "15:15"],
    ["tomorrow at quarter past 3", "15:15"],
    ["tomorrow at quarter to four", "15:45"],
    ["tomorrow at quarter to 4", "15:45"],
    ["tomorrow at quarter to twelve", "11:45"],
    ["tomorrow at quarter to one", "12:45"],
  ])("resolves %s to %s", (text, expected) => {
    expect(resolve(text)!.localTime).toBe(expected);
  });

  it("counts back from the named hour for “to”", () => {
    // "quarter to four" is in the hour BEFORE four, not after it.
    expect(resolve("tomorrow at quarter to four")!.localTime).toBe("15:45");
    expect(resolve("tomorrow at quarter past four")!.localTime).toBe("16:15");
  });

  it("honours an explicit meridiem instead of guessing", () => {
    expect(resolve("tomorrow at half past two pm")!.localTime).toBe("14:30");
    expect(resolve("tomorrow at half past two am")!.localTime).toBe("02:30");
  });

  it("discloses the guessed half of the day", () => {
    // The phrase states the minutes exactly and the meridiem not at all, so
    // the hour is this module's inference and has to be visible.
    const r = resolve("tomorrow at half past two")!;
    expect(r.assumed.meridiem).toBe(true);
    expect(r.assumptions.join(" ")).toContain("half past two");
    expect(r.assumptions.join(" ")).toContain("14:30");
    // NOT `timeOfDay`. The user gave a time of day, minutes and all — only the
    // half of the day was invented. Conflating them made the session re-ask
    // "what time?" for a booking that had plainly said "half past two".
    expect(r.assumed.timeOfDay).toBe(false);
  });

  it("claims no assumption when the meridiem was stated", () => {
    const r = resolve("tomorrow at half past two pm")!;
    expect(r.assumptions.join(" ")).not.toContain("half past two");
  });

  it("claims the whole phrase as one mention", () => {
    // D10: whatever the extractor does not claim falls through to the title.
    const span = parseTimeSpan("book Room A at half past two tomorrow")!;
    const clock = span.mentions.find((m) => m.kind === "clock")!;
    expect(clock.text).toBe("half past two");
  });

  it("leaves plain clock times exactly as they were", () => {
    expect(resolve("tomorrow at 3pm")!.localTime).toBe("15:00");
    expect(resolve("tomorrow at 10:30 am")!.localTime).toBe("10:30");
    expect(resolve("tomorrow at noon")!.localTime).toBe("12:00");
    expect(resolve("tomorrow at midnight")!.localTime).toBe("00:00");
    expect(resolve("tomorrow at 3pm to 5pm")!.durationMinutes).toBe(120);
  });
});

// ══════════════════════════════════════════════════════════════════════════
//  "in 2 hours" is a start time, not a length  (Tier 3 · A14)
//
//  "for 2 hours" and "in 2 hours" are opposite meanings sharing a surface
//  form, and the duration pattern claimed both. So "book Room A in 30 minutes"
//  produced a 30-minute event with NO START TIME AT ALL and still reached a
//  confirmable card.
// ══════════════════════════════════════════════════════════════════════════

describe("relative offsets", () => {
  // NOW is 2026-08-05T08:30:00Z, and `resolve` works in UTC.
  it.each([
    ["in 2 hours", "10:30"],
    ["in an hour", "09:30"],
    ["in 30 minutes", "09:00"],
    ["in 90 minutes", "10:00"],
    ["in 1.5 hours", "10:00"],
    ["in 45 mins", "09:15"],
  ])("resolves %s to %s", (text, expected) => {
    const r = resolve(text)!;
    expect(r.localTime).toBe(expected);
    expect(r.localDate).toBe("2026-08-05");
  });

  it("rolls into the next day when the offset crosses midnight", () => {
    const lateNight = new Date("2026-08-05T23:00:00.000Z");
    const r = resolve("in 2 hours", UTC, lateNight)!;
    expect(r.localDate).toBe("2026-08-06");
    expect(r.localTime).toBe("01:00");
  });

  it("is a start time, leaving the duration to its own phrase", () => {
    const r = resolve("in 2 hours for 30 minutes")!;
    expect(r.localTime).toBe("10:30");
    expect(r.durationMinutes).toBe(30);
  });

  it("does not round the resulting clock", () => {
    // "in 2 hours" at 08:37 is 10:37. Tidying it to 10:30 would invent a time
    // the user never asked for.
    const odd = new Date("2026-08-05T08:37:00.000Z");
    expect(resolve("in 2 hours", UTC, odd)!.localTime).toBe("10:37");
  });

  it("still reads “for N hours” as a length", () => {
    const r = resolve("tomorrow at 3pm for 2 hours")!;
    expect(r.localTime).toBe("15:00");
    expect(r.durationMinutes).toBe(120);
  });

  it("leaves a bare “2 hours” as a length", () => {
    const span = parseTimeSpan("2 hours")!;
    expect(span.durationMinutes).toBe(120);
    expect(span.offsetMinutes).toBeUndefined();
  });

  it("yields to a stated date rather than contradicting it", () => {
    // "tomorrow in 2 hours" is incoherent; the value the user can see wins.
    const r = resolve("tomorrow in 2 hours")!;
    expect(r.localDate).toBe("2026-08-06");
  });

  it("claims the whole phrase, so it cannot become a title", () => {
    const span = parseTimeSpan("book Room A in 2 hours")!;
    const offset = span.mentions.find((m) => m.kind === "relativeOffset")!;
    expect(offset.text).toBe("in 2 hours");
    expect(span.mentions.some((m) => m.kind === "duration")).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════════════
//  A named timezone  (found in the Phase 09 browser pass)
//
//  “3pm EST” resolved as plain 3pm in the calendar's own zone — the zone word
//  was never parsed, so it changed nothing AND fell through as unclaimed text
//  to become the event's NAME (“EST”, “York time”). Silent wrong data with a
//  perfectly reasonable-looking card.
// ══════════════════════════════════════════════════════════════════════════

describe("a named timezone", () => {
  // resolve() works in UTC; NOW is 2026-08-05T08:30:00Z.
  it.each([
    ["tomorrow at 3pm UTC", "2026-08-06T15:00:00.000Z"],
    ["tomorrow at 3pm GMT", "2026-08-06T15:00:00.000Z"],
    ["tomorrow at 3pm New York time", "2026-08-06T19:00:00.000Z"],
    ["tomorrow at 3pm EST", "2026-08-06T19:00:00.000Z"],
    ["tomorrow at 3pm London time", "2026-08-06T14:00:00.000Z"],
    ["tomorrow at 3pm Tokyo time", "2026-08-06T06:00:00.000Z"],
  ])("%s resolves to the right INSTANT", (text, iso) => {
    expect(resolve(text)!.startISO).toBe(iso);
  });

  it("discloses the conversion", () => {
    const r = resolve("tomorrow at 3pm New York time")!;
    expect(r.assumptions.join(" ")).toContain("America/New_York");
    expect(r.assumptions.join(" ")).toContain("New York time");
  });

  it("refuses to guess an ambiguous abbreviation", () => {
    // IST is India, Ireland and Israel. A coin-flip is not a reading of
    // anyone's intent, so the calendar's zone is used AND said out loud.
    const r = resolve("tomorrow at 3pm IST")!;
    expect(r.startISO).toBe(resolve("tomorrow at 3pm")!.startISO);
    expect(r.assumed.timeZone).toBe(true);
    expect(r.assumptions.join(" ")).toMatch(/could mean several/i);
  });

  it("says nothing when no zone was named", () => {
    const r = resolve("tomorrow at 3pm")!;
    expect(r.assumed.timeZone).toBe(false);
    expect(r.assumptions.join(" ")).not.toMatch(/timezone|could mean/i);
  });

  it("claims the zone words, so they cannot become a title", () => {
    for (const phrase of ["3pm EST", "3pm New York time", "3pm UTC"]) {
      const span = parseTimeSpan(phrase)!;
      expect(span.mentions.some((m) => m.kind === "zone")).toBe(true);
    }
  });

  it("leaves an unzoned time exactly as it was", () => {
    expect(resolve("tomorrow at 3pm")!.localTime).toBe("15:00");
    expect(resolve("tomorrow at 3pm")!.startISO).toBe(
      "2026-08-06T15:00:00.000Z",
    );
  });
});
