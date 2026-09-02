/**
 * Deterministic time-phrase parsing and resolution.
 *
 * ══════════════════════════════════════════════════════════════════════════
 *  THIS IS NEW BEHAVIOUR, NOT PART OF THE FROZEN PIPELINE.
 *
 *  The frozen classifier DETECTS times only in order to DELETE them
 *  (`stripSlots`) — it ends at `{intent, confidence, margin, route, gate}` and
 *  has no concept of when an event actually is. `architecture.drawio`'s runtime
 *  page confirms this: it terminates at PROCEED/CLARIFY/REJECT with no entity
 *  node anywhere.
 *
 *  So this module is additive. It never runs inside `classify()` or any gate,
 *  and nothing here can change a routing decision. It reads the SAME
 *  `TIME_PATTERNS` the frozen pipeline uses, so "what counts as a time" stays
 *  one definition — but it captures spans instead of erasing them.
 *
 *  Consequence worth stating plainly: the constants below (what "morning"
 *  means, how long a meeting is by default) are PRODUCT decisions, tunable and
 *  not frozen. Everything imported from `constants.ts` is frozen. Do not
 *  confuse the two.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Zero dependencies. Timezone maths uses `Intl.DateTimeFormat` only, mirroring
 * the approach in `packages/core/src/utils/time.ts` rather than importing it —
 * `@janus-scheduler/nlp` must not depend on `@janus-scheduler/core`.
 */

import * as chrono from "chrono-node";

import type {
  ClockTime,
  DateAnchor,
  PartOfDay,
  ResolveContext,
  ResolvedTime,
  TimeMention,
  TimeSpan,
} from "./types";

// ── product defaults (NOT frozen — tune these freely) ─────────────────────

/**
 * What a bare part-of-day word resolves to, as a 24-hour start time.
 * Chosen to sit inside a normal working day; `tonight` is deliberately later
 * than `evening` because it reads as "after hours" rather than "end of day".
 */
export const PART_OF_DAY_HOURS: Record<PartOfDay, number> = {
  morning: 9,
  afternoon: 14,
  evening: 18,
  night: 19,
};

/** Start time assumed when a date is given with no time of day ("tomorrow"). */
export const DEFAULT_HOUR = 9;

/** Event length assumed when no duration is stated. */
export const DEFAULT_DURATION_MINUTES = 60;

/**
 * The exact disclosure line for an invented duration.
 *
 * Exported so a caller can drop THIS line without matching prose — a
 * cancellation has no length to invent, and "assumed 60 minutes" on a card
 * whose button says "Cancel event" reads as though something is about to be
 * created. `ResolvedTime.assumed` already warns that matching the wording of
 * these strings is fragile and was wrong once; comparing against the value
 * itself is not.
 */
export const DURATION_ASSUMPTION = `no duration given — assumed ${DEFAULT_DURATION_MINUTES} minutes`;

/**
 * Zone words a user may type, mapped to IANA names.
 *
 * Curated, not exhaustive, and deliberately so. An unknown zone is better
 * REFUSED than guessed at: booking 3pm in the wrong zone is silent wrong data
 * of the worst kind, because the card looks perfectly reasonable.
 *
 * `null` marks a genuinely AMBIGUOUS abbreviation. IST is India, Ireland and
 * Israel; CST is US Central and China. Those are asked about, never assumed —
 * a coin-flip between Chicago and Shanghai is not a reading of anyone's
 * intent.
 */
export const ZONE_LEXICON: Record<string, string | null> = {
  utc: "UTC",
  gmt: "UTC",
  // North America
  est: "America/New_York",
  edt: "America/New_York",
  et: "America/New_York",
  "eastern time": "America/New_York",
  "new york time": "America/New_York",
  pst: "America/Los_Angeles",
  pdt: "America/Los_Angeles",
  pt: "America/Los_Angeles",
  "pacific time": "America/Los_Angeles",
  "los angeles time": "America/Los_Angeles",
  mst: "America/Denver",
  // Europe
  bst: "Europe/London",
  "london time": "Europe/London",
  "uk time": "Europe/London",
  cet: "Europe/Paris",
  cest: "Europe/Paris",
  "paris time": "Europe/Paris",
  "berlin time": "Europe/Berlin",
  // Asia-Pacific
  "india time": "Asia/Kolkata",
  "kolkata time": "Asia/Kolkata",
  "colombo time": "Asia/Colombo",
  "sri lanka time": "Asia/Colombo",
  jst: "Asia/Tokyo",
  "tokyo time": "Asia/Tokyo",
  "singapore time": "Asia/Singapore",
  "dubai time": "Asia/Dubai",
  aest: "Australia/Sydney",
  "sydney time": "Australia/Sydney",
  // ambiguous — ask, do not guess
  ist: null,
  cst: null,
  cdt: null,
};

/** Longest first, so “new york time” wins over a bare “time” fragment. */
const ZONE_ALTERNATION = Object.keys(ZONE_LEXICON)
  .sort((a, b) => b.length - a.length)
  .map((z) => z.replace(/ /g, String.raw`\s+`))
  .join("|");

const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = 86_400_000;

const WEEKDAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

/** Maps the frozen `TIME_PATTERNS` weekday STEMS onto weekday indices. */
const WEEKDAY_BY_STEM: Record<string, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  tues: 2,
  wednes: 3,
  thur: 4,
  thurs: 4,
  fri: 5,
  satur: 6,
};

const MONTH_BY_NAME: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

// ── timezone primitives ───────────────────────────────────────────────────

/**
 * Memoized formatters, keyed by IANA timezone.
 *
 * Constructing an `Intl.DateTimeFormat` resolves ICU locale and timezone data
 * and costs ~10-50µs — the single most expensive operation in this module. The
 * same caching rationale (and the same construct-before-cache-write ordering,
 * so an invalid timezone throws without poisoning the cache) as
 * `packages/core/src/utils/time.ts`.
 */
const _partsFmts = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timezone: string): Intl.DateTimeFormat {
  let fmt = _partsFmts.get(timezone);
  if (fmt === undefined) {
    // Constructed BEFORE the cache write: a bad timezone throws here and
    // nothing is stored.
    fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    if (_partsFmts.size > 512) _partsFmts.clear();
    _partsFmts.set(timezone, fmt);
  }
  return fmt;
}

interface ZonedParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number; // 0-23
  minute: number;
  second: number;
}

/** Wall-clock parts in `timezone` for a UTC instant. */
export function zonedPartsAt(utcMs: number, timezone: string): ZonedParts {
  const parts = partsFormatter(timezone).formatToParts(new Date(utcMs));
  const get = (type: string): number =>
    Number(parts.find((p) => p.type === type)?.value);
  let hour = get("hour");
  if (hour === 24) hour = 0; // some ICU builds report midnight as 24
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour,
    minute: get("minute"),
    second: get("second"),
  };
}

/** How far ahead of UTC `timezone` is, in ms, at a given UTC instant. */
function offsetAt(utcMs: number, timezone: string): number {
  const p = zonedPartsAt(utcMs, timezone);
  return (
    Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - utcMs
  );
}

/**
 * UTC milliseconds for a wall-clock time in `timezone`.
 *
 * Two passes, and the second one is the point. The naive single pass — measure
 * the offset at the nominal UTC instant, subtract it — is wrong within one
 * offset-width of a DST transition, because the offset is sampled at the wrong
 * moment. Sampling again at the candidate answer and re-deriving when the two
 * disagree fixes both the spring-forward and fall-back neighbourhoods.
 *
 * (`packages/core/src/utils/time.ts` does the single-pass version. This is not
 * a criticism of it — it converts times that a user typed into a picker, which
 * are already anchored. Here we synthesise wall-clock times like "next Sunday
 * 09:00" that can land exactly on a transition.)
 *
 * Times inside a spring-forward gap do not exist; this returns the instant the
 * clock jumps to, which is the conventional and least-surprising choice.
 */
export function zonedToUtcMs(
  year: number,
  month: number, // 1-12
  day: number,
  hour: number,
  minute: number,
  timezone: string,
): number {
  const nominal = Date.UTC(year, month - 1, day, hour, minute, 0);
  const firstOffset = offsetAt(nominal, timezone);
  const candidate = nominal - firstOffset;
  const secondOffset = offsetAt(candidate, timezone);
  return secondOffset === firstOffset ? candidate : nominal - secondOffset;
}

/** Day of week (0 = Sunday) for a wall-clock date. */
function weekdayOf(year: number, month: number, day: number): number {
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/** Shift a wall-clock calendar date by whole days, with month/year rollover. */
function addDays(
  year: number,
  month: number,
  day: number,
  delta: number,
): { year: number; month: number; day: number } {
  const d = new Date(Date.UTC(year, month - 1, day) + delta * MS_PER_DAY);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
  };
}

/**
 * How far into the past a stated calendar date can be before rolling it a year
 * forward stops looking like a misremembering and starts looking like intent.
 *
 * 45 days: comfortably covers "I meant last month", while leaving "January 5th"
 * said in December to roll forward silently, which is what it means.
 */
const RECENT_PAST_DAYS = 45;

/** Whole days from `b` to `a`, positive when `a` is later. */
function daysBetween(
  a: { year: number; month: number; day: number },
  b: { year: number; month: number; day: number },
): number {
  const ms =
    Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day);
  return Math.round(ms / 86400000);
}

/**
 * Did the user actually ASK for a date in the past?
 *
 * "yesterday", "last friday", "last week" and a year stated outright all mean
 * it deliberately. Everything else that lands behind `now` got there by
 * accident, and is worth a question.
 */
function statesAPastDate(span: TimeSpan): boolean {
  const date = span.date;
  if (date === undefined) return false;
  switch (date.kind) {
    case "yesterday":
      return true;
    case "relativeWeekday":
    case "relativeUnit":
      return date.direction === "last";
    case "monthDate":
      // A year the user typed is a year they meant.
      return date.year !== undefined;
    default:
      return false;
  }
}

/** Days in a 1-indexed month. Leap years handled by `Date` itself. */
function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Shift by whole months, clamping the day to the target month's length.
 * "next month" from 31 Jan is 28/29 Feb, not 2/3 March.
 */
function addMonths(
  year: number,
  month: number,
  day: number,
  delta: number,
): { year: number; month: number; day: number } {
  const total = year * 12 + (month - 1) + delta;
  const ty = Math.floor(total / 12);
  const tm = total - ty * 12; // 0-11
  const daysInTarget = new Date(Date.UTC(ty, tm + 1, 0)).getUTCDate();
  return { year: ty, month: tm + 1, day: Math.min(day, daysInTarget) };
}

// ── time-phrase extraction ────────────────────────────────────────────────

/** Spelled-out hours, for "half past two". Only 1-12 — a clock has no more. */
const HOUR_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
};

/** Longest-first, so "twelve" is not shadowed by a shorter alternative. */
const HOUR_WORD_ALTERNATION = Object.keys(HOUR_WORDS)
  .sort((a, b) => b.length - a.length)
  .join("|");

function hourNumber(token: string): number {
  const word = HOUR_WORDS[token.toLowerCase()];
  return word ?? Number(token);
}

/**
 * Which half of the day a bare hour means, when the phrase never said.
 *
 * "half past two" is 14:30 to almost everyone arranging a meeting, and "half
 * past nine" is 09:30 — the split is the working day, not the clock. 1-5 read
 * as afternoon, 6-11 as morning, 12 as noon.
 *
 * This is a GUESS, and `resolveTime` discloses it on the card rather than
 * presenting it as something the user said. A wrong guess the user can see and
 * correct is fine; a wrong guess presented as their own words is not.
 */
function businessHour(hour12: number): number {
  if (hour12 === 12) return 12;
  return hour12 >= 1 && hour12 <= 5 ? hour12 + 12 : hour12;
}

/**
 * Labelled patterns mirroring the frozen `TIME_PATTERNS`, one per alternative,
 * with capture groups.
 *
 * These deliberately reproduce the frozen list's exact surface coverage — the
 * quirks included. `(tues?)day` matches "tueday"; `(thurs?)day` matches
 * "thurday". Tightening them here would make extraction disagree with
 * `hasTimeAnchor()`, so an utterance could pass gate 5 and then yield no time.
 * Agreement matters more than tidiness.
 *
 * Order matters: the first match at a position wins, so more specific patterns
 * ("next monday") must precede the general ones ("monday").
 */
const MENTION_PATTERNS: Array<{
  kind: TimeMention["kind"];
  re: RegExp;
}> = [
  // "5pm to 7pm", "5:00 to 7:00 pm", "5 to 7pm", "from 5pm to 7pm", "5pm-7pm"
  {
    kind: "clockRange",
    re: /\b(?:from\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:to|-|until|till|through)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/gi,
  },
  // "10am", "10:30 pm", "3 PM"
  { kind: "clock", re: /\b(\d{1,2})(?::(\d{2}))?\s?(am|pm)\b/gi },
  // "half past two", "quarter past 3", "quarter to four", "half past two pm".
  //
  // Must sit AFTER the plain clock pattern so "half past 2pm" gives its own
  // match rather than the bare "2pm" inside it winning the position first.
  {
    kind: "clock",
    re: new RegExp(
      String.raw`\b(half|quarter)\s+(past|to|till|til|before|after)\s+` +
        String.raw`(\d{1,2}|${HOUR_WORD_ALTERNATION})\b(?:\s*(am|pm))?`,
      "gi",
    ),
  },
  // A named zone, so it is honoured rather than left to become a title.
  {
    kind: "zone",
    re: new RegExp(
      String.raw`\b(?:` + ZONE_ALTERNATION + String.raw`)\b`,
      "gi",
    ),
  },
  { kind: "noon", re: /\bnoon\b/gi },
  { kind: "midnight", re: /\bmidnight\b/gi },
  // "August 18", "August 18th", "Aug 18", "Aug 18, 2026"
  {
    kind: "monthDate",
    re: /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s*,?\s*(\d{4}))?\b/gi,
  },
  // "18th of August", "18 August", "18th August", "18 Aug 2026"
  {
    kind: "monthDate",
    re: /\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)(?:\s*,?\s*(\d{4}))?\b/gi,
  },
  // "next monday", "this friday", "last tuesday"
  {
    kind: "relativeWeekday",
    re: /\b(next|this|last)\s+(mon|tues?|wednes|thurs?|fri|satur|sun)day\b/gi,
  },
  // "next week", "this month", "last quarter", "next sprint"
  {
    kind: "relativeUnit",
    re: /\b(next|this|last)\s+(week|month|quarter|year|sprint)\b/gi,
  },
  // bare "monday", "tuesdays", "friday's"
  {
    kind: "weekday",
    re: /\b(mon|tues?|wednes|thurs?|fri|satur|sun)day'?s?\b/gi,
  },
  { kind: "today", re: /\btoday'?s?\b/gi },
  { kind: "tomorrow", re: /\btomorrow'?s?\b/gi },
  // Matched so it can be HONOURED, not so it can be offered. Before this,
  // "yesterday" matched nothing, was silently ignored, and the date fell back
  // to today — the user asked for yesterday and got today, undisclosed.
  // Recognising it also makes it an EXPLICIT past reference, so the past-date
  // question below stays quiet for it.
  { kind: "yesterday", re: /\byesterday'?s?\b/gi },
  { kind: "tonight", re: /\btonight\b/gi },
  // "in 2 hours", "in an hour", "in 30 minutes" — WHEN, not how long.
  //
  // Must precede the duration patterns, and starts at "in" rather than at the
  // number so the coverage filter in `extractTimeMentions` drops the duration
  // match nested inside it. Without that, "for 2 hours" and "in 2 hours" — the
  // two opposite meanings — both came out as a length.
  //
  // Minutes and hours only. "in 2 days" is left to the existing date patterns
  // because a day-scale offset says nothing about the time of day, and
  // inventing 09:37 from the current clock would be worse than the 09:00
  // default the normal path already discloses.
  {
    kind: "relativeOffset",
    re: /\bin\s+(an?|\d+(?:\.\d+)?)\s*(minutes?|mins?|hours?|hrs?)\b/gi,
  },
  // durations
  { kind: "duration", re: /\ban?\s+hour(\s+later)?\b/gi },
  { kind: "duration", re: /\ba\s+day\b/gi },
  // LOAD-BEARING DETAILS, both the result of a real defect:
  //
  //   `(?:\.\d+)?` — without it `\b(\d+)` cannot span a decimal point, so the
  //   match restarted AFTER the point and captured the fractional digits as the
  //   whole number: "1.5 hours" became 5 hours (300 min), "0.5 hours" likewise.
  //   Every fractional duration collapsed to 300.
  //
  //   `\s*` rather than `\s+` — "45mins" otherwise passed the dialogue layer's
  //   own looser check and was appended to the utterance, but was never parsed
  //   back out, so `assumed.duration` stayed true and the question repeated for
  //   ever. There is now exactly one duration regex; `session.ts` defers to it.
  {
    kind: "duration",
    re: /\b(\d+(?:\.\d+)?)\s*(minutes?|mins?|hours?|hrs?)\b/gi,
  },
  // A bare day of the month with no month named: "the 25th", "on the 3rd".
  //
  // Ordered AFTER the month-name patterns on purpose. "August 25th" is matched
  // by `monthDate` first, which starts earlier and spans further, so the
  // coverage filter in `extractTimeMentions` drops this narrower match. Only a
  // genuinely month-less ordinal survives to here.
  //
  // Two guards, and BOTH are needed — requiring only `the` is not enough:
  //
  //   1. `the` must precede it, so a bare ordinal in a title is not a date.
  //   2. The trailing lookahead. Without it "book the 3rd floor room tomorrow"
  //      matched "the 3rd", beat "tomorrow" on position, and booked 3 September.
  //      An ordinal used as an ADJECTIVE is followed by the noun it modifies
  //      ("3rd floor", "2nd attempt"); a date is followed by end-of-phrase,
  //      punctuation, a preposition, or a clock time. That is the difference.
  //
  // The cost of a false positive here is a silently wrong booking date, which
  // is the failure mode this whole pattern exists to remove — so it is
  // deliberately conservative. "book it the 25th sometime" is not matched, and
  // falls through to CLARIFY, which asks.
  {
    kind: "dayOfMonth",
    re: /\b(?:on\s+)?the\s+(\d{1,2})(?:st|nd|rd|th)\b(?=\s*$|\s*[,.;!?]|\s+(?:at|from|to|in|for|with|and|by|before|after|starting|until|till)\b|\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)\b)/gi,
  },
  { kind: "partOfDay", re: /\b(morning|afternoon|evening)\b/gi },
];

/** 12-hour clock + meridiem → 24-hour. Handles the 12am/12pm wrap. */
function to24Hour(hour12: number, meridiem: string): number {
  const h = hour12 % 12;
  return meridiem.toLowerCase() === "pm" ? h + 12 : h;
}

function weekdayFromStem(stem: string): number | undefined {
  return WEEKDAY_BY_STEM[stem.toLowerCase()];
}

const MONTH_NAMES_RE =
  /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/i;

function extractChronoMentions(text: string): TimeMention[] {
  const chronoResults = chrono.parse(text);
  const mentions: TimeMention[] = [];

  for (const r of chronoResults) {
    const isHourCertain = r.start.isCertain("hour");
    const isDayCertain = r.start.isCertain("day");
    const isMonthCertain = r.start.isCertain("month");

    // Only emit monthDate if it contains an explicit month name or calendar date
    const hasMonthName = MONTH_NAMES_RE.test(r.text);
    const hasRelativeKeyword =
      /\b(today|tomorrow|tonight|yesterday|week|month|year|quarter|sprint|hour|hours|mins?|minutes?|day|days)\b/i.test(
        r.text,
      );

    if (isDayCertain && isMonthCertain && hasMonthName && !hasRelativeKeyword) {
      const clock: ClockTime | undefined = isHourCertain
        ? { hour: r.start.get("hour") ?? 0, minute: r.start.get("minute") ?? 0 }
        : undefined;
      const endClock: ClockTime | undefined =
        r.end && r.end.isCertain("hour")
          ? { hour: r.end.get("hour") ?? 0, minute: r.end.get("minute") ?? 0 }
          : undefined;

      let durationMinutes: number | undefined;
      if (clock && endClock) {
        const startTotal = clock.hour * 60 + clock.minute;
        let endTotal = endClock.hour * 60 + endClock.minute;
        if (endTotal <= startTotal) endTotal += 24 * 60;
        durationMinutes = endTotal - startTotal;
      }

      mentions.push({
        text: r.text,
        start: r.index,
        end: r.index + r.text.length,
        kind: "monthDate",
        month: r.start.get("month") ?? undefined,
        day: r.start.get("day") ?? undefined,
        year: r.start.isCertain("year")
          ? (r.start.get("year") ?? undefined)
          : undefined,
        clock,
        endClock,
        durationMinutes,
      });
    }
  }

  return mentions;
}

/**
 * Every time phrase in `text`, with its character span.
 *
 * Overlapping matches are resolved by preferring the earlier start, then the
 * longer span.
 */
export function extractTimeMentions(text: string): TimeMention[] {
  const found: TimeMention[] = [];

  // 1. Chrono-node natural language parsing
  try {
    found.push(...extractChronoMentions(text));
  } catch {
    // Fail-safe
  }

  // 2. Pattern-based mentions (durations, specific regexes)
  for (const { kind, re } of MENTION_PATTERNS) {
    const rx = new RegExp(re.source, re.flags);
    let m: RegExpExecArray | null;
    while ((m = rx.exec(text)) !== null) {
      if (m[0].length === 0) {
        rx.lastIndex++;
        continue;
      }
      found.push(buildMention(kind, m));
    }
  }

  found.sort((a, b) => a.start - b.start || b.end - a.end);

  // Drop anything fully or partially covered by an earlier, longer match.
  const kept: TimeMention[] = [];
  let coveredTo = -1;
  for (const mention of found) {
    if (mention.start < coveredTo) continue;
    kept.push(mention);
    coveredTo = mention.end;
  }
  return kept;
}

function buildMention(
  kind: TimeMention["kind"],
  m: RegExpExecArray,
): TimeMention {
  const base = { text: m[0], start: m.index, end: m.index + m[0].length };

  switch (kind) {
    case "clockRange": {
      const endMeridiem = (m[6] ?? "pm").toLowerCase();
      const startMeridiem = m[3] ? m[3].toLowerCase() : endMeridiem;
      const startHour = to24Hour(Number(m[1]), startMeridiem);
      const startMinute = m[2] ? Number(m[2]) : 0;
      const endHour = to24Hour(Number(m[4]), endMeridiem);
      const endMinute = m[5] ? Number(m[5]) : 0;
      const startTotal = startHour * 60 + startMinute;
      let endTotal = endHour * 60 + endMinute;
      if (endTotal <= startTotal) {
        endTotal += 24 * 60;
      }
      return {
        ...base,
        kind,
        clock: { hour: startHour, minute: startMinute },
        endClock: { hour: endHour, minute: endMinute },
        durationMinutes: endTotal - startTotal,
      };
    }
    case "clock": {
      // Two patterns share this kind, so they are told apart by shape rather
      // than by a second kind — everything downstream (endClock pairing, the
      // title blanking in entities.ts) should treat them identically.
      if (/^(?:half|quarter)$/i.test(m[1])) {
        const offset = m[1].toLowerCase() === "half" ? 30 : 15;
        const backwards = /^(?:to|till|til|before)$/i.test(m[2]);
        const meridiem = m[4];
        const named = hourNumber(m[3]);

        // "quarter to four" names the hour it counts BACK from, so the event
        // is in the hour before it.
        const hour24 = meridiem
          ? to24Hour(named, meridiem)
          : businessHour(named);
        const minute = backwards ? 60 - offset : offset;
        const hour = backwards ? (hour24 + 23) % 24 : hour24;

        return {
          ...base,
          kind,
          clock: { hour, minute },
          ...(meridiem ? {} : { meridiemAssumed: true }),
        };
      }

      return {
        ...base,
        kind,
        clock: {
          hour: to24Hour(Number(m[1]), m[3]),
          minute: m[2] ? Number(m[2]) : 0,
        },
      };
    }
    case "relativeOffset": {
      const quantity = /^an?$/i.test(m[1]) ? 1 : Number(m[1]);
      const perUnit = /^h/i.test(m[2]) ? 60 : 1;
      return { ...base, kind, offsetMinutes: Math.round(quantity * perUnit) };
    }
    case "zone": {
      const key = m[0].toLowerCase().replace(/\s+/g, " ");
      const iana = ZONE_LEXICON[key];
      return iana
        ? { ...base, kind, zone: iana }
        : { ...base, kind, zoneAmbiguous: true };
    }
    case "noon":
      return { ...base, kind, clock: { hour: 12, minute: 0 } };
    case "midnight":
      return { ...base, kind, clock: { hour: 0, minute: 0 } };
    case "relativeWeekday":
      return {
        ...base,
        kind,
        direction: m[1].toLowerCase() as "next" | "this" | "last",
        weekday: weekdayFromStem(m[2]),
      };
    case "relativeUnit":
      return {
        ...base,
        kind,
        direction: m[1].toLowerCase() as "next" | "this" | "last",
        unit: m[2].toLowerCase() as TimeMention["unit"],
      };
    case "weekday":
      return { ...base, kind, weekday: weekdayFromStem(m[1]) };
    case "dayOfMonth": {
      const day = Number(m[1]);
      // 32nd, 99th — not a date. Emitting nothing lets the sentence fall through
      // to CLARIFY, which asks; emitting a bogus day would book something.
      if (!Number.isInteger(day) || day < 1 || day > 31) {
        return { ...base, kind: "dayOfMonth" };
      }
      return { ...base, kind: "dayOfMonth", day };
    }
    case "monthDate": {
      const isMonthFirst = isNaN(Number(m[1]));
      const monthStr = isMonthFirst ? m[1].toLowerCase() : m[2].toLowerCase();
      const dayNum = Number(isMonthFirst ? m[2] : m[1]);
      const yearNum = m[3] ? Number(m[3]) : undefined;
      const monthNum = MONTH_BY_NAME[monthStr] ?? 1;
      return {
        ...base,
        kind,
        month: monthNum,
        day: dayNum,
        year: yearNum,
      };
    }
    case "duration": {
      const minutes = durationOf(m);
      // "for 0 minutes" is not a length, and an event of no length is not a
      // booking — it was accepted and created as a zero-duration event. The
      // MENTION is still returned so the words stay claimed: unclaimed text
      // falls through and becomes the event title, which is how "half past
      // two" once ended up as an event name.
      return minutes > 0
        ? { ...base, kind, durationMinutes: minutes }
        : { ...base, kind };
    }
    case "partOfDay":
      return {
        ...base,
        kind,
        partOfDay: m[1].toLowerCase() as PartOfDay,
      };
    default:
      return { ...base, kind };
  }
}

function durationOf(m: RegExpExecArray): number {
  const lowered = m[0].toLowerCase();
  if (/\bhour\b/.test(lowered) && !/\d/.test(lowered)) return 60; // "an hour"
  if (/\ba\s+day\b/.test(lowered)) return 8 * 60; // "a day" = a working day
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return DEFAULT_DURATION_MINUTES;
  return /^h/.test(m[2] ?? "") ? n * 60 : n;
}

/**
 * Fold the mentions in an utterance into one span.
 *
 * A sentence usually spreads its time across several phrases — "tomorrow
 * afternoon at 2pm for 30 minutes" is four. Later mentions of the same
 * component do not overwrite earlier ones: the first date-bearing phrase wins,
 * the first clock wins. An explicit clock always beats a part-of-day, since
 * "tomorrow afternoon at 2pm" means 2pm, not the afternoon default.
 */
export function toTimeSpan(mentions: TimeMention[]): TimeSpan | undefined {
  if (mentions.length === 0) return undefined;

  const span: TimeSpan = {
    mentions,
    text: mentions.map((m) => m.text).join(" "),
    start: Math.min(...mentions.map((m) => m.start)),
    end: Math.max(...mentions.map((m) => m.end)),
  };

  for (const m of mentions) {
    switch (m.kind) {
      case "clockRange":
        span.clock ??= m.clock;
        span.endClock ??= m.endClock;
        span.durationMinutes ??= m.durationMinutes;
        break;
      case "clock":
      case "noon":
      case "midnight":
        if (!span.clock) {
          span.clock = m.clock;
          if (m.meridiemAssumed) {
            span.meridiemAssumed = true;
            span.meridiemPhrase = m.text;
          }
        } else if (!span.endClock && m.clock) {
          span.endClock = m.clock;
          const startTotal = span.clock.hour * 60 + span.clock.minute;
          let endTotal = span.endClock.hour * 60 + span.endClock.minute;
          if (endTotal <= startTotal) endTotal += 24 * 60;
          span.durationMinutes ??= endTotal - startTotal;
        }
        break;
      case "zone":
        if (m.zoneAmbiguous) span.zoneAmbiguous = true;
        else if (m.zone && !span.zone) {
          span.zone = m.zone;
          span.zonePhrase = m.text;
        }
        break;
      case "relativeOffset":
        span.offsetMinutes ??= m.offsetMinutes;
        break;
      case "today":
        span.date ??= { kind: "today" };
        break;
      case "tomorrow":
        span.date ??= { kind: "tomorrow" };
        break;
      case "yesterday":
        span.date ??= { kind: "yesterday" };
        break;
      case "tonight":
        span.date ??= { kind: "today" };
        span.partOfDay ??= "night";
        break;
      case "weekday":
        if (m.weekday !== undefined) {
          span.date ??= { kind: "weekday", weekday: m.weekday };
        }
        break;
      case "relativeWeekday":
        if (m.weekday !== undefined) {
          span.date ??= {
            kind: "relativeWeekday",
            weekday: m.weekday,
            direction: m.direction ?? "next",
          };
        }
        break;
      case "relativeUnit":
        span.date ??= {
          kind: "relativeUnit",
          unit: m.unit ?? "week",
          direction: m.direction ?? "next",
        };
        break;
      case "monthDate":
        if (m.month !== undefined && m.day !== undefined) {
          span.date ??= {
            kind: "monthDate",
            month: m.month,
            day: m.day,
            year: m.year,
          };
        }
        if (m.clock) {
          span.clock ??= m.clock;
        }
        if (m.endClock) {
          span.endClock ??= m.endClock;
        }
        if (m.durationMinutes !== undefined) {
          span.durationMinutes ??= m.durationMinutes;
        }
        break;
      case "dayOfMonth":
        if (m.day !== undefined) {
          span.date ??= { kind: "dayOfMonth", day: m.day };
        }
        break;
      case "partOfDay":
        span.partOfDay ??= m.partOfDay;
        break;
      case "duration":
        span.durationMinutes ??= m.durationMinutes;
        break;
    }
  }

  return span;
}

/** Parse an utterance straight into a span. */
export function parseTimeSpan(text: string): TimeSpan | undefined {
  return toTimeSpan(extractTimeMentions(text));
}

// ── resolution ────────────────────────────────────────────────────────────

/** Resolve a date anchor to a wall-clock calendar date in the given timezone. */
function resolveDate(
  anchor: DateAnchor | undefined,
  today: { year: number; month: number; day: number },
): { year: number; month: number; day: number } | "unresolvable" | undefined {
  if (anchor === undefined) return undefined;

  switch (anchor.kind) {
    case "today":
      return today;

    case "tomorrow":
      return addDays(today.year, today.month, today.day, 1);

    case "yesterday":
      return addDays(today.year, today.month, today.day, -1);

    case "weekday": {
      // A bare weekday means the NEXT one, strictly in the future. Saying
      // "monday" on a Monday means the Monday a week away — treating it as
      // "today" would silently schedule something in the past when the clock
      // time has already gone by.
      const current = weekdayOf(today.year, today.month, today.day);
      const delta = ((anchor.weekday - current + 7 - 1) % 7) + 1; // 1..7
      return addDays(today.year, today.month, today.day, delta);
    }

    case "relativeWeekday": {
      const current = weekdayOf(today.year, today.month, today.day);
      if (anchor.direction === "this") {
        // The named day within the current Sunday-started week, past or future.
        return addDays(
          today.year,
          today.month,
          today.day,
          anchor.weekday - current,
        );
      }
      const weekShift = anchor.direction === "next" ? 7 : -7;
      return addDays(
        today.year,
        today.month,
        today.day,
        anchor.weekday - current + weekShift,
      );
    }

    case "relativeUnit": {
      const sign =
        anchor.direction === "last" ? -1 : anchor.direction === "next" ? 1 : 0;
      switch (anchor.unit) {
        case "week":
          return addDays(today.year, today.month, today.day, 7 * sign);
        case "month":
          return addMonths(today.year, today.month, today.day, sign);
        case "quarter":
          return addMonths(today.year, today.month, today.day, 3 * sign);
        case "year":
          return addMonths(today.year, today.month, today.day, 12 * sign);
        case "sprint":
          // "next sprint" is an organisational concept with no calendar
          // definition this package can know. Refusing to guess is the point:
          // an unresolved time flows to CLARIFY and the user is asked, which is
          // exactly what gate 5 already does for a missing time.
          return "unresolvable";
      }
      return "unresolvable";
    }

    case "dayOfMonth": {
      // The next occurrence of that day: this month if it has not passed,
      // otherwise next month. Same-day counts as today — someone saying "the
      // 25th" on the 25th means today, not four weeks away.
      if (anchor.day >= today.day) {
        const inThisMonth = daysInMonth(today.year, today.month);
        if (anchor.day <= inThisMonth) {
          return { year: today.year, month: today.month, day: anchor.day };
        }
      }
      // Roll forward until a month actually has that day — "the 31st" in
      // February is April, not an invalid date silently clamped to the 28th.
      let year = today.year;
      let month = today.month;
      for (let i = 0; i < 12; i++) {
        month += 1;
        if (month > 12) {
          month = 1;
          year += 1;
        }
        if (anchor.day <= daysInMonth(year, month)) {
          return { year, month, day: anchor.day };
        }
      }
      return "unresolvable";
    }

    case "monthDate": {
      let year = anchor.year;
      if (year === undefined) {
        year = today.year;
        if (
          anchor.month < today.month ||
          (anchor.month === today.month && anchor.day < today.day)
        ) {
          year += 1;
        }
      }
      return { year, month: anchor.month, day: anchor.day };
    }
  }
}

/**
 * Turn a parsed span into a concrete UTC interval.
 *
 * Returns `null` when the span cannot be resolved — deliberately, rather than
 * guessing. An unresolved time is a CLARIFY, and the dialogue layer asks the
 * user; a wrong guess would be committed silently.
 *
 * Every value not stated by the user is recorded in `assumptions`. The parse
 * card is a *verification* surface, so what the system invented has to be
 * visible, not buried.
 */
export function resolveTime(
  span: TimeSpan | undefined,
  ctx: ResolveContext,
): ResolvedTime | null {
  if (span === undefined) return null;

  const timezone = ctx.timezone;
  const nowMs = ctx.now instanceof Date ? ctx.now.getTime() : ctx.now;
  const nowParts = zonedPartsAt(nowMs, timezone);
  const today = {
    year: nowParts.year,
    month: nowParts.month,
    day: nowParts.day,
  };

  const assumptions: string[] = [];
  // Machine-readable twin of `assumptions`. A UI needs to know WHICH value was
  // invented in order to mark that chip; matching on the prose above is
  // fragile and was already wrong once — `"morning" taken as 09:00` and
  // `no time of day given — assumed 09:00` are the same fact in two wordings,
  // and a regex written for one silently missed the other.
  const assumed = {
    date: false,
    timeOfDay: false,
    duration: false,
    meridiem: false,
    timeZone: false,
  };

  /**
   * "in 2 hours" becomes a concrete date and clock here — the only place with
   * access to `now`. Parsing cannot do it, which is why the mention carries an
   * offset rather than an instant.
   *
   * Ignored when the utterance also named a date or a clock: "tomorrow in 2
   * hours" is incoherent, and the stated value is the one the user can see.
   * The result is exact, not rounded — 09:37 + 2h is 11:37, and quietly
   * tidying it to 11:30 would be inventing a time they did not ask for.
   */
  let offsetParts: { year: number; month: number; day: number } | undefined;
  let offsetClock: ClockTime | undefined;
  if (span.offsetMinutes !== undefined && !span.date && !span.clock) {
    const at = zonedPartsAt(
      nowMs + span.offsetMinutes * MS_PER_MINUTE,
      timezone,
    );
    offsetParts = { year: at.year, month: at.month, day: at.day };
    offsetClock = { hour: at.hour, minute: at.minute };
  }

  const resolvedDate = offsetParts ?? resolveDate(span.date, today);
  if (resolvedDate === "unresolvable") return null;

  // Time of day: an explicit clock wins; then a part-of-day default; then the
  // working-day default.
  let clock: ClockTime;
  if (offsetClock) {
    clock = offsetClock;
  } else if (span.clock) {
    clock = span.clock;
    // "half past two" gave the minutes exactly and the half of the day not at
    // all. The hour is this module's inference, so it is disclosed in the same
    // shape as every other invented value rather than passed off as stated.
    if (span.meridiemAssumed) {
      assumed.meridiem = true;
      assumptions.push(
        `"${span.meridiemPhrase}" taken as ${String(clock.hour).padStart(2, "0")}:${String(
          clock.minute,
        ).padStart(2, "0")}`,
      );
    }
  } else if (span.partOfDay) {
    clock = { hour: PART_OF_DAY_HOURS[span.partOfDay], minute: 0 };
    // "morning" narrows it, but 09:00 exactly is still this module's choice.
    assumed.timeOfDay = true;
    assumptions.push(
      `"${span.partOfDay}" taken as ${String(clock.hour).padStart(2, "0")}:00`,
    );
  } else if (resolvedDate) {
    clock = { hour: DEFAULT_HOUR, minute: 0 };
    assumed.timeOfDay = true;
    assumptions.push(
      `no time of day given — assumed ${String(DEFAULT_HOUR).padStart(2, "0")}:00`,
    );
  } else {
    // Neither a date nor a time. Nothing to resolve.
    return null;
  }

  let date = resolvedDate;
  if (!date) {
    // A clock time with no date: today if it is still ahead, otherwise
    // tomorrow. Scheduling into the past is never what "at 3pm" meant.
    const todayAt = zonedToUtcMs(
      today.year,
      today.month,
      today.day,
      clock.hour,
      clock.minute,
      timezone,
    );
    assumed.date = true;
    if (todayAt > nowMs) {
      date = today;
      assumptions.push("no date given — assumed today");
    } else {
      date = addDays(today.year, today.month, today.day, 1);
      assumptions.push(
        "no date given, and that time has passed — assumed tomorrow",
      );
    }
  }

  // A stated zone is not an INVENTED value, so it is not an `assumed` flag —
  // but the conversion has to be visible, or the card shows a time the user
  // never typed with nothing to explain it.
  if (span.zone && span.zone !== timezone) {
    assumptions.push(
      `“${span.zonePhrase}” is ${span.zone} — shown here in ${timezone}`,
    );
  }

  // A zone word this module will not guess at. IST is India, Ireland and
  // Israel; CST is US Central and China. The time falls back to the
  // calendar's zone — which has to be SAID, or the user reads their own
  // words back and assumes they were honoured.
  if (span.zoneAmbiguous && !span.zone) {
    assumed.timeZone = true;
    assumptions.push(
      `that timezone could mean several places — used ${timezone}`,
    );
  }

  const durationMinutes = span.durationMinutes ?? DEFAULT_DURATION_MINUTES;
  if (span.durationMinutes === undefined) {
    assumed.duration = true;
    assumptions.push(DURATION_ASSUMPTION);
  }

  /**
   * A stated zone decides which INSTANT the wall-clock time means.
   *
   * “3pm New York time” is 3pm in New York, not 3pm on the calendar. Only the
   * instant changes: `localDate` / `localTime` below still report the event in
   * the zone the calendar is DISPLAYING, because that is where the user will
   * see the block. Both halves are then shown — what they said, and where it
   * lands — and that pairing is the whole point.
   */
  const wallZone = span?.zone ?? timezone;
  const startMs = zonedToUtcMs(
    date.year,
    date.month,
    date.day,
    clock.hour,
    clock.minute,
    wallZone,
  );
  const endMs = startMs + durationMinutes * MS_PER_MINUTE;

  // Re-derive the calendar-local wall clock from the instant, so a stated
  // zone is reflected in what the card shows rather than only in the stored
  // value. Skipped when no zone was named, to keep the existing path exact.
  if (span?.zone && span.zone !== timezone) {
    const shown = zonedPartsAt(startMs, timezone);
    date = { year: shown.year, month: shown.month, day: shown.day };
    clock = { hour: shown.hour, minute: shown.minute };
  }

  const isPastRelativeWeekday = Boolean(
    span?.date?.kind === "relativeWeekday" &&
    span.date.direction === "this" &&
    span.date.weekday !== undefined &&
    weekdayOf(today.year, today.month, today.day) > span.date.weekday,
  );

  let pastDateStr: string | undefined;
  let upcomingDateStr: string | undefined;
  if (
    isPastRelativeWeekday &&
    span?.date?.kind === "relativeWeekday" &&
    span.date.weekday !== undefined
  ) {
    const cur = weekdayOf(today.year, today.month, today.day);
    const pastD = addDays(
      today.year,
      today.month,
      today.day,
      span.date.weekday - cur,
    );
    const upD = addDays(
      today.year,
      today.month,
      today.day,
      span.date.weekday - cur + 7,
    );
    pastDateStr = `${pastD.year}-${pad(pastD.month)}-${pad(pastD.day)}`;
    upcomingDateStr = `${upD.year}-${pad(upD.month)}-${pad(upD.day)}`;
  }

  // ── a calendar date that only resolved by adding a year ─────────────────
  //
  // "August 25th" on 30 August resolves to 2027 under the roll-forward rule.
  // Correct in the abstract, almost certainly not what was meant five days
  // after the fact — so it is flagged for the dialogue layer to ask about
  // rather than committed silently. Outside the window the rolled reading is
  // the honest one: "January 5th" in December really is next January.
  let staleYearRoll = false;
  let statedDateStr: string | undefined;
  if (span?.date?.kind === "monthDate" && span.date.year === undefined) {
    const stated = {
      year: today.year,
      month: span.date.month,
      day: span.date.day,
    };
    const rolledAYear = date.year === today.year + 1;
    if (rolledAYear && daysBetween(stated, today) <= RECENT_PAST_DAYS) {
      staleYearRoll = true;
      statedDateStr = `${stated.year}-${pad(stated.month)}-${pad(stated.day)}`;
    }
  }

  // ── landed in the past without being asked to ───────────────────────────
  //
  // A general backstop rather than a fix for one phrase. Most paths already
  // roll forward by themselves; this catches whatever does not — today with an
  // hour that has gone, and any future parsing path that resolves backwards by
  // accident — so the dialogue layer can ask once instead of each case needing
  // its own rule.
  const resolvedInPast = startMs < nowMs && !statesAPastDate(span);

  return {
    startISO: new Date(startMs).toISOString(),
    endISO: new Date(endMs).toISOString(),
    startMs,
    endMs,
    durationMinutes,
    timezone,
    assumptions,
    assumed,
    staleYearRoll,
    statedDate: statedDateStr,
    resolvedInPast,
    // Wall-clock values, so a UI can render "Wed 10:00 AM" without redoing the
    // timezone maths.
    localDate: `${date.year}-${pad(date.month)}-${pad(date.day)}`,
    localTime: `${pad(clock.hour)}:${pad(clock.minute)}`,
    weekday: WEEKDAYS[weekdayOf(date.year, date.month, date.day)],
    pastRelativeWeekday: isPastRelativeWeekday,
    pastDate: pastDateStr,
    upcomingDate: upcomingDateStr,
  };
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
