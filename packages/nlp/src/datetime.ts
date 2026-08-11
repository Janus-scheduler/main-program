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
  // "10am", "10:30 pm", "3 PM"
  { kind: "clock", re: /\b(\d{1,2})(?::(\d{2}))?\s?(am|pm)\b/gi },
  { kind: "noon", re: /\bnoon\b/gi },
  { kind: "midnight", re: /\bmidnight\b/gi },
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
  { kind: "tonight", re: /\btonight\b/gi },
  // durations
  { kind: "duration", re: /\ban?\s+hour(\s+later)?\b/gi },
  { kind: "duration", re: /\ba\s+day\b/gi },
  { kind: "duration", re: /\b(\d+)\s+(minutes?|mins?|hours?|hrs?)\b/gi },
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

/**
 * Every time phrase in `text`, with its character span.
 *
 * Overlapping matches are resolved by preferring the earlier start, then the
 * longer span — so "next monday" is one `relativeWeekday`, not a `relativeUnit`
 * plus a stray `weekday`.
 */
export function extractTimeMentions(text: string): TimeMention[] {
  const found: TimeMention[] = [];

  for (const { kind, re } of MENTION_PATTERNS) {
    // Fresh instance per call: these are /g regexes and `exec` is stateful.
    // Sharing them across calls would make results depend on call order.
    const rx = new RegExp(re.source, re.flags);
    let m: RegExpExecArray | null;
    while ((m = rx.exec(text)) !== null) {
      // Zero-length matches would loop forever; none of the patterns above can
      // produce one, but the guard costs nothing and removes the class of bug.
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
    case "clock":
      return {
        ...base,
        kind,
        clock: {
          hour: to24Hour(Number(m[1]), m[3]),
          minute: m[2] ? Number(m[2]) : 0,
        },
      };
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
    case "duration":
      return { ...base, kind, durationMinutes: durationOf(m) };
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
      case "clock":
      case "noon":
      case "midnight":
        span.clock ??= m.clock;
        break;
      case "today":
        span.date ??= { kind: "today" };
        break;
      case "tomorrow":
        span.date ??= { kind: "tomorrow" };
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
  const assumed = { date: false, timeOfDay: false, duration: false };

  const resolvedDate = resolveDate(span.date, today);
  if (resolvedDate === "unresolvable") return null;

  // Time of day: an explicit clock wins; then a part-of-day default; then the
  // working-day default.
  let clock: ClockTime;
  if (span.clock) {
    clock = span.clock;
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

  const durationMinutes = span.durationMinutes ?? DEFAULT_DURATION_MINUTES;
  if (span.durationMinutes === undefined) {
    assumed.duration = true;
    assumptions.push(
      `no duration given — assumed ${DEFAULT_DURATION_MINUTES} minutes`,
    );
  }

  const startMs = zonedToUtcMs(
    date.year,
    date.month,
    date.day,
    clock.hour,
    clock.minute,
    timezone,
  );
  const endMs = startMs + durationMinutes * MS_PER_MINUTE;

  return {
    startISO: new Date(startMs).toISOString(),
    endISO: new Date(endMs).toISOString(),
    startMs,
    endMs,
    durationMinutes,
    timezone,
    assumptions,
    assumed,
    // Wall-clock values, so a UI can render "Wed 10:00 AM" without redoing the
    // timezone maths.
    localDate: `${date.year}-${pad(date.month)}-${pad(date.day)}`,
    localTime: `${pad(clock.hour)}:${pad(clock.minute)}`,
    weekday: WEEKDAYS[weekdayOf(date.year, date.month, date.day)],
  };
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
