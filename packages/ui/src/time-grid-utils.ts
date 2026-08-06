import type { TimeGridEvent, TimeGridEventResource } from "./time-grid-types";
import { toDateStr, todayStr, fmt12 } from "./month-grid-utils";
import {
  isoToZonedDisplay,
  expandEvents,
  type Event as CoreEvent,
  type EventColor,
} from "@janus-scheduler/core";

// Re-exported so the hour-grid views only ever reach for one utils module.
export { toDateStr, todayStr, fmt12 };

// ── Constants ──────────────────────────────────────────────────────────────────

export const MINUTES_PER_DAY = 1440;

/** Sunday-first, matching JS `Date.getDay()` indexing. */
export const DOW_SHORT = [
  "SUN",
  "MON",
  "TUE",
  "WED",
  "THU",
  "FRI",
  "SAT",
] as const;

export const DOW_LONG = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

// ── Types ──────────────────────────────────────────────────────────────────────

/** One column of an hour grid — a single calendar day. */
export interface TimeGridDay {
  date: Date;
  dateStr: string; // "YYYY-MM-DD"
  dayNum: number; // 1–31
  dowShort: string; // "WED"
  dowLong: string; // "Wednesday"
  isToday: boolean;
  isWeekend: boolean;
  /** Events with `allDay` set, or spanning the whole column. */
  allDayEvents: TimeGridEvent[];
  /** Timed events belonging to this column, already positioned. */
  timedEvents: PositionedEvent[];
}

/** A timed event with its geometry inside a day column resolved. */
export interface PositionedEvent {
  event: TimeGridEvent;
  /** Minutes from midnight, clamped to the visible window. */
  startMin: number;
  endMin: number;
  /** Offset from the top of the grid, in px. */
  top: number;
  /** Rendered height in px (never below a legible minimum). */
  height: number;
  /** Horizontal position within the column, in percent. */
  left: number;
  width: number;
  /** True when the event started before the visible window. */
  clipTop: boolean;
  /** True when the event ends after the visible window. */
  clipBottom: boolean;
}

// ── Time helpers ───────────────────────────────────────────────────────────────

/** "HH:MM" → minutes from midnight. Accepts the sentinel "24:00" (= 1440). */
export function minutesFromTimeStr(t: string): number {
  if (!t) return 0;
  const [h, m] = t.split(":").map(Number);
  if (Number.isNaN(h)) return 0;
  return h * 60 + (Number.isNaN(m) ? 0 : m);
}

/** Minutes from midnight → "HH:MM". */
export function timeStrFromMinutes(min: number): string {
  const clamped = Math.max(0, Math.min(MINUTES_PER_DAY, Math.round(min)));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** 8 → "8 AM", 12 → "12 PM", 0 → "12 AM". */
export function formatHourLabel(hour: number): string {
  const h = hour % 24;
  const suffix = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12} ${suffix}`;
}

/** The hour marks rendered down the gutter, e.g. [0, 1, … 23] for a full day. */
export function buildHourMarks(startHour: number, endHour: number): number[] {
  const marks: number[] = [];
  for (let h = startHour; h < endHour; h++) marks.push(h);
  return marks;
}

/** Minutes from midnight for right now, or null when `dateStr` isn't today. */
export function nowMinutesFor(dateStr: string): number | null {
  const now = new Date();
  if (toDateStr(now) !== dateStr) return null;
  return now.getHours() * 60 + now.getMinutes();
}

// ── Range builders ─────────────────────────────────────────────────────────────

/**
 * First day of the week containing `date`.
 * `weekStartsOn` uses JS day indexing (0 = Sunday, 1 = Monday).
 */
export function startOfWeek(date: Date, weekStartsOn = 1): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diff = (d.getDay() - weekStartsOn + 7) % 7;
  d.setDate(d.getDate() - diff);
  return d;
}

/** `count` consecutive bare day columns starting at `start`. */
export function buildDayRange(start: Date, count: number): TimeGridDay[] {
  const today = todayStr();
  const days: TimeGridDay[] = [];
  for (let i = 0; i < count; i++) {
    const date = new Date(
      start.getFullYear(),
      start.getMonth(),
      start.getDate() + i,
    );
    const dateStr = toDateStr(date);
    const dow = date.getDay();
    days.push({
      date,
      dateStr,
      dayNum: date.getDate(),
      dowShort: DOW_SHORT[dow],
      dowLong: DOW_LONG[dow],
      isToday: dateStr === today,
      isWeekend: dow === 0 || dow === 6,
      allDayEvents: [],
      timedEvents: [],
    });
  }
  return days;
}

// ── Store → view-model mapping ─────────────────────────────────────────────────

/**
 * Expand the store's events into per-day {@link TimeGridEvent} segments for the
 * window `[rangeStartMs, rangeEndMs]`, with all times resolved in `timezone`.
 *
 * Multi-day events yield one segment per day they touch, clamped to that day —
 * so a view never has to reason about events that overflow its column.
 *
 * @param resourceMap resources keyed by id, used to resolve each event's
 *   `resourceIds` into the avatar data the event card renders. Omit to skip
 *   resource resolution entirely.
 */
export function buildTimeGridEvents(
  rawEvents: CoreEvent[],
  timezone: string,
  rangeStartMs: number,
  rangeEndMs: number,
  resourceMap?: Map<string, TimeGridEventResource>,
): TimeGridEvent[] {
  const expanded = expandEvents(rawEvents, rangeStartMs, rangeEndMs);

  const segments: TimeGridEvent[] = [];

  for (const e of expanded) {
    const start = isoToZonedDisplay(e.startTime, timezone);
    const end = isoToZonedDisplay(e.endTime, timezone);
    const startMs = new Date(e.startTime).getTime();
    const endMs = new Date(e.endTime).getTime();

    // `resourceIds` is the modern field; `resourceId` is the legacy single-
    // resource form still emitted by expandEvents for older event records.
    const ids = e.resourceIds?.length
      ? e.resourceIds
      : e.resourceId
        ? [e.resourceId]
        : [];
    const resources = resourceMap
      ? ids
          .map((id) => resourceMap.get(id))
          .filter((r): r is TimeGridEventResource => r !== undefined)
      : undefined;

    const isMultiDay = start.date !== end.date;

    // Walk calendar dates at local noon so DST transitions can't skip a day.
    const [sy, sm, sd] = start.date.split("-").map(Number);
    const cursor = new Date(sy, sm - 1, sd, 12, 0, 0);
    const [ey, em, ed] = end.date.split("-").map(Number);
    const last = new Date(ey, em - 1, ed, 12, 0, 0);

    // Guard against a malformed event (end before start) looping forever.
    if (cursor > last) continue;

    while (cursor <= last) {
      const dateStr = toDateStr(cursor);
      const isFirst = dateStr === start.date;
      const isLast = dateStr === end.date;

      const segStart = isFirst ? start.time : "00:00";
      const segEnd = isLast ? end.time : "24:00";

      // An event ending exactly at midnight spills a zero-length segment onto
      // the following day — drop it rather than render an empty sliver.
      const isEmptyTail = isLast && !isFirst && segEnd === "00:00";

      if (!isEmptyTail) {
        let spanPosition: TimeGridEvent["spanPosition"] = "single";
        if (isMultiDay) {
          if (isFirst) spanPosition = "start";
          else if (isLast) spanPosition = "end";
          else spanPosition = "middle";
        }

        segments.push({
          id: e.id,
          title: e.title,
          color: (e.color || "primary") as EventColor,
          date: dateStr,
          startTime: segStart,
          endTime: segEnd,
          allDay: e.allDay,
          recurrenceRule: e.recurrenceRule,
          isMultiDay,
          spanPosition,
          startDate: start.date,
          endDate: end.date,
          startMs,
          endMs,
          resources,
        });
      }

      cursor.setDate(cursor.getDate() + 1);
    }
  }

  return segments;
}

/**
 * Split `events` across `days`, positioning the timed ones.
 *
 * @param windowStartMin  first visible minute of the day (e.g. 0)
 * @param windowEndMin    last visible minute (e.g. 1440)
 * @param pxPerMinute     vertical scale of the grid
 */
export function assignEventsToDays(
  days: TimeGridDay[],
  events: TimeGridEvent[],
  windowStartMin: number,
  windowEndMin: number,
  pxPerMinute: number,
): void {
  const byDate = new Map<string, TimeGridEvent[]>();
  for (const ev of events) {
    const arr = byDate.get(ev.date);
    if (arr) arr.push(ev);
    else byDate.set(ev.date, [ev]);
  }

  for (const day of days) {
    const dayEvents = byDate.get(day.dateStr) ?? [];
    const allDay: TimeGridEvent[] = [];
    const timed: TimeGridEvent[] = [];

    for (const ev of dayEvents) {
      // Explicit all-day events, and multi-day middles, live in the pinned row.
      if (ev.allDay || ev.spanPosition === "middle") allDay.push(ev);
      else timed.push(ev);
    }

    day.allDayEvents = allDay;
    day.timedEvents = layoutDayEvents(
      timed,
      windowStartMin,
      windowEndMin,
      pxPerMinute,
    );
  }
}

/**
 * Lay out one day's timed events, side-by-side where they overlap.
 *
 * Events are grouped into clusters of transitively overlapping events; within a
 * cluster each event takes the leftmost free column and every event shares the
 * width equally. This is the same model Google Calendar and Outlook use.
 */
export function layoutDayEvents(
  events: TimeGridEvent[],
  windowStartMin: number,
  windowEndMin: number,
  pxPerMinute: number,
): PositionedEvent[] {
  /** Anything shorter than this is unreadable, so we floor the rendered height. */
  const MIN_HEIGHT_PX = 18;

  const prepared = events
    .map((event) => {
      const rawStart = minutesFromTimeStr(event.startTime);
      const rawEnd = Math.max(
        minutesFromTimeStr(event.endTime),
        rawStart + 1, // zero-length events still need a visible sliver
      );
      return { event, rawStart, rawEnd };
    })
    // Drop events entirely outside the visible window.
    .filter((p) => p.rawEnd > windowStartMin && p.rawStart < windowEndMin)
    .sort((a, b) => a.rawStart - b.rawStart || b.rawEnd - a.rawEnd);

  const positioned: PositionedEvent[] = [];

  // Walk the sorted list, closing off a cluster whenever a gap appears.
  let cluster: typeof prepared = [];
  let clusterEnd = -Infinity;

  const flush = () => {
    if (cluster.length === 0) return;

    // Greedy column packing: reuse the first column that has ended.
    const columnEnds: number[] = [];
    const columnOf = new Map<(typeof cluster)[number], number>();

    for (const item of cluster) {
      let col = columnEnds.findIndex((end) => end <= item.rawStart);
      if (col === -1) {
        col = columnEnds.length;
        columnEnds.push(item.rawEnd);
      } else {
        columnEnds[col] = item.rawEnd;
      }
      columnOf.set(item, col);
    }

    const colCount = columnEnds.length;

    for (const item of cluster) {
      const col = columnOf.get(item) ?? 0;
      const startMin = Math.max(item.rawStart, windowStartMin);
      const endMin = Math.min(item.rawEnd, windowEndMin);

      positioned.push({
        event: item.event,
        startMin,
        endMin,
        top: (startMin - windowStartMin) * pxPerMinute,
        height: Math.max(MIN_HEIGHT_PX, (endMin - startMin) * pxPerMinute),
        left: (col / colCount) * 100,
        width: (1 / colCount) * 100,
        clipTop: item.rawStart < windowStartMin,
        clipBottom: item.rawEnd > windowEndMin,
      });
    }

    cluster = [];
    clusterEnd = -Infinity;
  };

  for (const item of prepared) {
    if (cluster.length > 0 && item.rawStart >= clusterEnd) flush();
    cluster.push(item);
    clusterEnd = Math.max(clusterEnd, item.rawEnd);
  }
  flush();

  return positioned;
}

// ── Label formatting ───────────────────────────────────────────────────────────

/** "Wednesday, July 15, 2026" — the Day view's nav label. */
export function formatDayLabel(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * "July 12 – 18, 2026" — the Week view's nav label. Collapses the repeated
 * month and year when the week doesn't straddle a boundary.
 */
export function formatWeekLabel(start: Date, end: Date): string {
  const sameYear = start.getFullYear() === end.getFullYear();
  const sameMonth = sameYear && start.getMonth() === end.getMonth();

  // Composed by hand: Intl produces nonsense ("2026 (day: 29)") for partial
  // option combinations such as { day, year } with no month.
  const monthOf = (d: Date) => d.toLocaleDateString("en-US", { month: "long" });

  const startPart = sameYear
    ? `${monthOf(start)} ${start.getDate()}`
    : `${monthOf(start)} ${start.getDate()}, ${start.getFullYear()}`;
  const endPart = sameMonth
    ? `${end.getDate()}, ${end.getFullYear()}`
    : `${monthOf(end)} ${end.getDate()}, ${end.getFullYear()}`;

  return `${startPart} – ${endPart}`;
}

/** "Jun 12" — the compact label the topbar shows on mobile. */
export function formatShortDate(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** "10:00 AM – 11:00 AM", or "10:00 AM" when the event has no useful end. */
export function formatEventTimeRange(ev: TimeGridEvent): string {
  if (ev.allDay) return "All-day";
  const start = fmt12(ev.startTime);
  const end = ev.endTime === "24:00" ? "12:00 AM" : fmt12(ev.endTime);
  return `${start} – ${end}`;
}
