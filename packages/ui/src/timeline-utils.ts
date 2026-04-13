import { TimelineEvent } from "./timeline-types";

// ── Constants  ─────────────────────────────────────────────────────────
export const HOUR_START = 0;
export const HOUR_WIDTH = 80;
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

export function eventStyle(ev: TimelineEvent): string {
  const left = ((toMin(ev.startTime) - HOUR_START * 60) / 60) * HOUR_WIDTH + 2;
  const width =
    ((toMin(ev.endTime) - toMin(ev.startTime)) / 60) * HOUR_WIDTH - 6;
  return `left: ${left}px; width: ${width}px;`;
}

export function toDateStr(d: Date): string {
  return d.toISOString().split("T")[0];
}

export function nowLeft(): number {
  const now = new Date();
  return (
    ((now.getHours() * 60 + now.getMinutes() - HOUR_START * 60) / 60) *
    HOUR_WIDTH
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
