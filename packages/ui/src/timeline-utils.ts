import { TimelineEvent } from "./timeline-types";

// ── Constants  ─────────────────────────────────────────────────────────
export const HOUR_START = 0;
export const DEFAULT_HOUR_WIDTH = 80;
export const MIN_HOUR_WIDTH = 40;
export const MAX_HOUR_WIDTH = 300;
export const ZOOM_FACTOR = 0.08; // 8% per scroll tick
/** @deprecated Use DEFAULT_HOUR_WIDTH and pass hourWidth dynamically */
export const HOUR_WIDTH = DEFAULT_HOUR_WIDTH;
export const VISIBLE_HOURS = Array.from({ length: 24 }, (_, i) => i);
export const AVATAR_PALETTE = [
  "#f97316",
  "#3b82f6",
  "#10b981",
  "#8b5cf6",
  "#f59e0b",
  "#ec4899",
];

// ── Helpers ───────────────────────────────────────────────────────────
export function toMin(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export function fmt12(t: string): string {
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${m.toString().padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function avatarColor(id: string): string {
  let h = 0;
  for (const c of id) h = (h * 31 + (c.codePointAt(0) ?? 0)) & 0xffff;
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length];
}

export function eventStyle(
  ev: TimelineEvent,
  hourWidth: number = DEFAULT_HOUR_WIDTH,
): string {
  const left = ((toMin(ev.startTime) - HOUR_START * 60) / 60) * hourWidth + 2;
  const width =
    ((toMin(ev.endTime) - toMin(ev.startTime)) / 60) * hourWidth - 6;
  return `left: ${left}px; width: ${width}px;`;
}

export function toDateStr(d: Date): string {
  // Use LOCAL date components so the date string always matches what the
  // user sees on their calendar, regardless of timezone.
  // toISOString() would convert a local-midnight Date to UTC, shifting the
  // date back by one day for any UTC+ timezone (e.g. IST UTC+5:30).
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function nowLeft(hourWidth: number = DEFAULT_HOUR_WIDTH): number {
  const now = new Date();
  return (
    ((now.getHours() * 60 + now.getMinutes() - HOUR_START * 60) / 60) *
    hourWidth
  );
}

export function formatDateFull(d: Date): string {
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateShort(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ── Drag-and-drop constants ───────────────────────────────────────────
export const ROW_HEIGHT = 72;
export const GROUP_LABEL_HEIGHT = 32;
export const HOUR_HEADER_HEIGHT = 40;
export const SNAP_MINUTES = 15;
export const DRAG_THRESHOLD = 5;

// ── Drag-and-drop helpers ─────────────────────────────────────────────
export function pxToMinutes(
  px: number,
  hourWidth: number = DEFAULT_HOUR_WIDTH,
): number {
  return (px / hourWidth) * 60;
}

export function minutesToPx(
  min: number,
  hourWidth: number = DEFAULT_HOUR_WIDTH,
): number {
  return (min / 60) * hourWidth;
}

export function snapMinutes(min: number, snap: number = SNAP_MINUTES): number {
  return Math.round(min / snap) * snap;
}

export function minutesToTimeStr(totalMin: number): string {
  const clamped = Math.max(0, Math.min(totalMin, 24 * 60 - 1));
  const h = Math.floor(clamped / 60);
  const m = Math.round(clamped % 60);
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}
