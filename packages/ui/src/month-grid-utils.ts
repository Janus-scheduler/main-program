import { MonthEvent } from "./month-grid-types";

// ── Constants ──────────────────────────────────────────────────────────────────
export const WEEK_DAYS = [
  "MON",
  "TUE",
  "WED",
  "THU",
  "FRI",
  "SAT",
  "SUN",
] as const;

// ── Types ──────────────────────────────────────────────────────────────────────
export interface CalendarDay {
  date: Date;
  dateStr: string; // "YYYY-MM-DD"
  dayNum: number; // 1–31
  isCurrentMonth: boolean;
  isToday: boolean;
  events: MonthEvent[];
}

// ── Date helpers ───────────────────────────────────────────────────────────────

/** "YYYY-MM-DD" from a Date */
export function toDateStr(d: Date): string {
  return d.toISOString().split("T")[0];
}

/** Today as "YYYY-MM-DD" */
export function todayStr(): string {
  return toDateStr(new Date());
}

/**
 * Build the 6-row × 7-col calendar grid for a given year/month.
 * Week starts on Monday (matching the design image).
 * Days from prev/next month fill the edges (isCurrentMonth = false).
 */
export function buildCalendarGrid(
  year: number,
  month: number, // 0-based (Jan = 0)
  events: MonthEvent[],
): CalendarDay[][] {
  const today = todayStr();

  // Map events by date for O(1) lookup
  const eventMap = new Map<string, MonthEvent[]>();
  for (const ev of events) {
    const arr = eventMap.get(ev.date) ?? [];
    arr.push(ev);
    eventMap.set(ev.date, arr);
  }

  // First day of month
  const firstOfMonth = new Date(year, month, 1);

  // Monday-based offset: Mon=0 … Sun=6
  // JS getDay(): Sun=0, Mon=1 … Sat=6
  const jsDay = firstOfMonth.getDay(); // 0=Sun … 6=Sat
  const offset = jsDay === 0 ? 6 : jsDay - 1; // convert to Mon-based

  // Build flat list of days (always 6 weeks = 42 cells)
  const days: CalendarDay[] = [];
  const startDate = new Date(year, month, 1 - offset);

  for (let i = 0; i < 42; i++) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + i);
    const dateStr = toDateStr(date);
    days.push({
      date,
      dateStr,
      dayNum: date.getDate(),
      isCurrentMonth: date.getMonth() === month,
      isToday: dateStr === today,
      events: eventMap.get(dateStr) ?? [],
    });
  }

  // Split into 6 rows of 7
  const grid: CalendarDay[][] = [];
  for (let row = 0; row < 6; row++) {
    grid.push(days.slice(row * 7, row * 7 + 7));
  }

  // Drop the 6th row if it contains no current-month days
  if (grid[5].every((d) => !d.isCurrentMonth)) {
    grid.pop();
  }

  return grid;
}

/** "May 2026" style header label */
export function formatMonthYear(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

/** fmt12 reused from timeline-utils pattern */
export function fmt12(t: string): string {
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${m.toString().padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}
