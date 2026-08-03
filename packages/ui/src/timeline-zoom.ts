/**
 * timeline-zoom.ts
 *
 * Pure-logic zoom engine for the multi-scale timeline.
 * Defines zoom levels (5min → year), column generation,
 * and pixel ↔ timestamp conversion.
 *
 * Zero DOM / Lit dependency — fully testable in isolation.
 */

import { toFakeLocalDate } from "@janus-scheduler/core";

// ── Types ────────────────────────────────────────────────────────────────

export type ZoomUnit =
  | "5min"
  | "15min"
  | "30min"
  | "1hour"
  | "4hour"
  | "1day"
  | "1week"
  | "1month"
  | "1year";

export interface ZoomLevel {
  unit: ZoomUnit;
  /** Duration of one column in milliseconds (approximate for month/year) */
  unitMs: number;
  /** Switch TO this level when pxPerMs >= this threshold */
  minPxPerMs: number;
  /** Format the column header label */
  labelFormat: (date: Date) => string;
  /** Optional super-header label (parent grouping) */
  superLabelFormat?: (date: Date) => string;
  /** Snap granularity in ms for drag operations */
  snapMs: number;
}

export interface ColumnTick {
  /** Start timestamp of this column */
  startMs: number;
  /** Label for the column header */
  label: string;
  /** Pixel offset from viewStart */
  px: number;
  /** Width of this column in pixels */
  width: number;
}

export interface SuperLabel {
  /** Label text */
  label: string;
  /** Pixel offset from viewStart */
  px: number;
  /** Width in pixels */
  width: number;
}

// ── Constants ────────────────────────────────────────────────────────────

const MS_MIN = 60_000;
const MS_HOUR = 3_600_000;
const MS_DAY = 86_400_000;
const MS_WEEK = 604_800_000;
const MS_MONTH_AVG = 2_629_746_000; // ~30.44 days
const MS_YEAR_AVG = 31_556_952_000; // ~365.25 days

/** Default pxPerMs = 80px per hour */
export const DEFAULT_PX_PER_MS = 80 / MS_HOUR;

/** Zoom scaling factor per scroll tick (6% — smoother than 8%) */
export const ZOOM_SCALE_FACTOR = 0.06;

/** Fixed content half-width in pixels (10000px each side of center = 20000px total) */
export const CONTENT_HALF_WIDTH = 10_000;

// ── Formatters ───────────────────────────────────────────────────────────

const pad2 = (n: number) => n.toString().padStart(2, "0");

const SHORT_WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const SHORT_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function fmtTime(d: Date): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function fmtDayShort(d: Date): string {
  return `${SHORT_WEEKDAYS[d.getDay()]} ${d.getDate()}`;
}

function fmtWeek(d: Date): string {
  // ISO week number
  const oneJan = new Date(d.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((d.getTime() - oneJan.getTime()) / MS_DAY) + 1;
  const weekNum = Math.ceil(dayOfYear / 7);
  return `W${weekNum}`;
}

function fmtMonth(d: Date): string {
  return SHORT_MONTHS[d.getMonth()];
}

function fmtYear(d: Date): string {
  return `${d.getFullYear()}`;
}

function fmtMonthYear(d: Date): string {
  return `${SHORT_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function fmtDayFull(d: Date): string {
  return `${SHORT_WEEKDAYS[d.getDay()]}, ${SHORT_MONTHS[d.getMonth()]} ${d.getDate()}`;
}

// ── Zoom Levels (ordered most zoomed-in → most zoomed-out) ───────────
//
// Threshold logic: switch TO level N when columns of level N+1 (coarser)
// would be wider than ~120px.  This ensures:
//   - Default (80px/hr) → "1hour" columns at 80px each  ✓
//   - Zoom in past 120px/hr → switch to "30min" at 60px each  ✓
//   - Zoom out below ~30px/hr → switch to "4hour" at 120px each  ✓

export const ZOOM_LEVELS: ZoomLevel[] = [
  {
    unit: "5min",
    unitMs: 5 * MS_MIN,
    minPxPerMs: 120 / (15 * MS_MIN), // when 15min cols > 120px → show 5min
    labelFormat: fmtTime,
    superLabelFormat: fmtDayFull,
    snapMs: MS_MIN,
  },
  {
    unit: "15min",
    unitMs: 15 * MS_MIN,
    minPxPerMs: 120 / (30 * MS_MIN), // when 30min cols > 120px → show 15min
    labelFormat: fmtTime,
    superLabelFormat: fmtDayFull,
    snapMs: 5 * MS_MIN,
  },
  {
    unit: "30min",
    unitMs: 30 * MS_MIN,
    minPxPerMs: 120 / MS_HOUR, // when 1hr cols > 120px → show 30min
    labelFormat: fmtTime,
    superLabelFormat: fmtDayFull,
    snapMs: 5 * MS_MIN,
  },
  {
    unit: "1hour",
    unitMs: MS_HOUR,
    minPxPerMs: 120 / (4 * MS_HOUR), // when 4hr cols > 120px → show 1hr
    labelFormat: fmtTime,
    superLabelFormat: fmtDayFull,
    snapMs: 15 * MS_MIN,
  },
  {
    unit: "4hour",
    unitMs: 4 * MS_HOUR,
    minPxPerMs: 120 / MS_DAY, // when day cols > 120px → show 4hr
    labelFormat: fmtTime,
    superLabelFormat: fmtDayFull,
    snapMs: 30 * MS_MIN,
  },
  {
    unit: "1day",
    unitMs: MS_DAY,
    minPxPerMs: 120 / MS_WEEK, // when week cols > 120px → show days
    labelFormat: fmtDayShort,
    superLabelFormat: fmtMonthYear,
    snapMs: MS_HOUR,
  },
  {
    unit: "1week",
    unitMs: MS_WEEK,
    minPxPerMs: 120 / MS_MONTH_AVG,
    labelFormat: fmtWeek,
    superLabelFormat: fmtMonthYear,
    snapMs: MS_DAY,
  },
  {
    unit: "1month",
    unitMs: MS_MONTH_AVG,
    minPxPerMs: 120 / MS_YEAR_AVG,
    labelFormat: fmtMonth,
    superLabelFormat: fmtYear,
    snapMs: MS_DAY,
  },
  {
    unit: "1year",
    unitMs: MS_YEAR_AVG,
    minPxPerMs: 0, // catch-all for the most zoomed-out
    labelFormat: fmtYear,
    snapMs: MS_MONTH_AVG,
  },
];

// ── Core Functions ───────────────────────────────────────────────────────

/**
 * Given the current pixels-per-millisecond, find the active zoom level.
 */
export function getActiveZoomLevel(pxPerMs: number): ZoomLevel {
  for (const level of ZOOM_LEVELS) {
    if (pxPerMs >= level.minPxPerMs) {
      return level;
    }
  }
  return ZOOM_LEVELS[ZOOM_LEVELS.length - 1];
}

/**
 * Convert a timestamp (ms) to a pixel offset from viewStartMs.
 */
export function timestampToPx(
  tsMs: number,
  viewStartMs: number,
  pxPerMs: number,
): number {
  return (tsMs - viewStartMs) * pxPerMs;
}

/**
 * Convert a pixel offset to a timestamp (ms).
 */
export function pxToTimestamp(
  px: number,
  viewStartMs: number,
  pxPerMs: number,
): number {
  return viewStartMs + px / pxPerMs;
}

/**
 * Snap a timestamp to the nearest boundary of the given granularity.
 */
export function snapTimestamp(tsMs: number, snapMs: number): number {
  return Math.round(tsMs / snapMs) * snapMs;
}

/**
 * Snap a timestamp DOWN to the start of the given unit.
 * For calendar-aware units (day, week, month, year), this aligns to
 * midnight / start-of-week / start-of-month / start-of-year.
 */
export function floorToUnit(tsMs: number, unit: ZoomUnit): number {
  const d = new Date(tsMs);
  switch (unit) {
    case "5min":
      d.setMinutes(Math.floor(d.getMinutes() / 5) * 5, 0, 0);
      return d.getTime();
    case "15min":
      d.setMinutes(Math.floor(d.getMinutes() / 15) * 15, 0, 0);
      return d.getTime();
    case "30min":
      d.setMinutes(Math.floor(d.getMinutes() / 30) * 30, 0, 0);
      return d.getTime();
    case "1hour":
      d.setMinutes(0, 0, 0);
      return d.getTime();
    case "4hour":
      d.setHours(Math.floor(d.getHours() / 4) * 4, 0, 0, 0);
      return d.getTime();
    case "1day":
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    case "1week": {
      d.setHours(0, 0, 0, 0);
      const dayOfWeek = d.getDay(); // 0=Sun
      d.setDate(d.getDate() - dayOfWeek); // floor to Sunday
      return d.getTime();
    }
    case "1month":
      d.setDate(1);
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    case "1year":
      d.setMonth(0, 1);
      d.setHours(0, 0, 0, 0);
      return d.getTime();
  }
}

/**
 * Advance a timestamp by one unit.
 * Calendar-aware: adding 1 month to Jan 31 → Feb 28, etc.
 */
export function advanceByUnit(tsMs: number, unit: ZoomUnit): number {
  const d = new Date(tsMs);
  switch (unit) {
    case "5min":
      return tsMs + 5 * MS_MIN;
    case "15min":
      return tsMs + 15 * MS_MIN;
    case "30min":
      return tsMs + 30 * MS_MIN;
    case "1hour":
      return tsMs + MS_HOUR;
    case "4hour":
      return tsMs + 4 * MS_HOUR;
    case "1day":
      return tsMs + MS_DAY;
    case "1week":
      return tsMs + MS_WEEK;
    case "1month":
      d.setMonth(d.getMonth() + 1);
      return d.getTime();
    case "1year":
      d.setFullYear(d.getFullYear() + 1);
      return d.getTime();
  }
}

/**
 * Generate column ticks from viewStart to viewEnd at the given zoom level.
 * Caps at 300 columns for safety.
 */
export function generateColumns(
  viewStartMs: number,
  viewEndMs: number,
  pxPerMs: number,
  level: ZoomLevel,
  timezone?: string,
): ColumnTick[] {
  const columns: ColumnTick[] = [];
  let cursor = floorToUnit(viewStartMs, level.unit);
  let safety = 0;
  while (cursor < viewEndMs && safety < 2500) {
    const nextCursor = advanceByUnit(cursor, level.unit);
    const px = (cursor - viewStartMs) * pxPerMs;
    const width = (nextCursor - cursor) * pxPerMs;
    if (width > 0.5) {
      const d = timezone ? toFakeLocalDate(cursor, timezone) : new Date(cursor);
      columns.push({ startMs: cursor, label: level.labelFormat(d), px, width });
    }
    cursor = nextCursor;
    safety++;
  }
  return columns;
}

/**
 * Generate super-labels (parent-level grouping) for the visible columns.
 * E.g., when showing hour columns, super-labels show "Wed, May 7".
 */
export function generateSuperLabels(
  viewStartMs: number,
  viewEndMs: number,
  pxPerMs: number,
  level: ZoomLevel,
  timezone?: string,
): SuperLabel[] {
  if (!level.superLabelFormat) return [];
  const parentUnit = getSuperUnit(level.unit);
  if (!parentUnit) return [];

  const labels: SuperLabel[] = [];
  let cursor = floorToUnit(viewStartMs, parentUnit);
  let safety = 0;
  while (cursor < viewEndMs && safety < 2500) {
    const nextCursor = advanceByUnit(cursor, parentUnit);
    const clippedStart = Math.max(cursor, viewStartMs);
    const clippedEnd = Math.min(nextCursor, viewEndMs);
    const px = (clippedStart - viewStartMs) * pxPerMs;
    const width = (clippedEnd - clippedStart) * pxPerMs;
    if (width > 1) {
      const d = timezone ? toFakeLocalDate(cursor, timezone) : new Date(cursor);
      labels.push({ label: level.superLabelFormat(d), px, width });
    }
    cursor = nextCursor;
    safety++;
  }
  return labels;
}

/**
 * Get the parent unit for super-label grouping.
 */
function getSuperUnit(unit: ZoomUnit): ZoomUnit | null {
  switch (unit) {
    case "5min":
    case "15min":
    case "30min":
    case "1hour":
    case "4hour":
      return "1day";
    case "1day":
    case "1week":
      return "1month";
    case "1month":
      return "1year";
    case "1year":
      return null;
  }
}

/**
 * Get the navigation step for prev/next buttons based on zoom level.
 */
export function getNavStepMs(level: ZoomLevel): number {
  switch (level.unit) {
    case "5min":
    case "15min":
    case "30min":
    case "1hour":
    case "4hour":
      return MS_DAY;
    case "1day":
      return MS_WEEK;
    case "1week":
      return MS_MONTH_AVG;
    case "1month":
      return MS_YEAR_AVG;
    case "1year":
      return 5 * MS_YEAR_AVG;
  }
}

/**
 * Format a date for the nav bar based on the current zoom level.
 */
export function formatNavDate(
  centerMs: number,
  level: ZoomLevel,
  timezone?: string,
): string {
  const d = timezone ? toFakeLocalDate(centerMs, timezone) : new Date(centerMs);
  switch (level.unit) {
    case "5min":
    case "15min":
    case "30min":
    case "1hour":
    case "4hour":
      return d.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      });
    case "1day":
    case "1week":
      return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    case "1month":
      return `${d.getFullYear()}`;
    case "1year":
      return `${d.getFullYear() - 5} – ${d.getFullYear() + 5}`;
  }
}

/**
 * Compute the min/max bounds for pxPerMs.
 * Min = most zoomed out (10% of default zoom)
 * Max = most zoomed in (5 min columns at ~200px)
 */
export const MIN_PX_PER_MS = DEFAULT_PX_PER_MS * 0.1;
export const MAX_PX_PER_MS = 200 / (5 * MS_MIN);
