// Re-uses TimelineEvent from timeline-types so events are the same shape
// across both views — no duplication.
export type { TimelineEvent } from "./timeline-types";

export interface MonthEvent {
  id: string;
  title: string;
  color: "orange" | "blue" | "yellow" | "purple" | "green";
  date: string; // "YYYY-MM-DD"
  startTime?: string; // "HH:MM" 24h — optional, shown as label
  endTime?: string;
}
