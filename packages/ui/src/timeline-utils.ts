/**
 * timeline-utils.ts
 *
 * Display-only helpers used by the timeline component.
 * All zoom/positioning math is now in timeline-zoom.ts.
 */

// ── Constants ─────────────────────────────────────────────────────────
export const AVATAR_PALETTE = [
  "#f97316",
  "#3b82f6",
  "#10b981",
  "#8b5cf6",
  "#f59e0b",
  "#ec4899",
];

// ── Layout constants (used by resource column & drag) ─────────────────
export const ROW_HEIGHT = 72;
export const GROUP_LABEL_HEIGHT = 32;
export const HOUR_HEADER_HEIGHT = 40;
export const SUPER_HEADER_HEIGHT = 24;
export const DRAG_THRESHOLD = 5;

// ── Display Helpers ──────────────────────────────────────────────────

/** Format "HH:MM" to "h:MM AM/PM" */
export function fmt12(t: string): string {
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${m.toString().padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

/** Get 1–2 character initials from a name */
export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/** Deterministic avatar color from id */
export function avatarColor(id: string): string {
  let h = 0;
  for (const c of id) h = (h * 31 + (c.codePointAt(0) ?? 0)) & 0xffff;
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length];
}

/** Convert a Date to local "YYYY-MM-DD" string */
export function toDateStr(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/** Format date for full nav display */
export function formatDateFull(d: Date): string {
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/** Format date for short nav display (mobile) */
export function formatDateShort(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Convert a timestamp to "HH:MM" string */
export function msToTimeStr(ms: number): string {
  const d = new Date(ms);
  const h = d.getHours();
  const m = d.getMinutes();
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

/** Convert a timestamp to an ISO date-time string for the store */
export function msToISOString(ms: number): string {
  return new Date(ms).toISOString();
}
