/**
 * Color options for scheduler events.
 * Used in both TimelineEvent and MonthEvent.
 */
export type EventColor =
  | "orange"
  | "blue"
  | "yellow"
  | "purple"
  | "green"
  | "red"
  | "pink"
  | "indigo"
  | "cyan"
  | "teal";

/**
 * The two supported calendar views.
 */
export type ViewType = "Timeline" | "Month";

export interface TimelineEvent {
  id: string;
  title: string;
  resourceId?: string; // Helpful for mapping back to resource
  startTime: string; // "HH:MM" 24h
  endTime: string; // "HH:MM" 24h
  /** Unix timestamp in ms — used for absolute positioning */
  startMs: number;
  /** Unix timestamp in ms — used for absolute positioning */
  endMs: number;
  color: EventColor;
  date?: string;
  allDay?: boolean;
  recurrenceRule?: string;
}

export interface TimelineResource {
  id: string;
  name: string;
  subtitle: string;
  avatarType: "initials" | "icon" | "image";
  avatar?: string;
  avatarIcon?: "room" | "equipment";
  groupLabel?: string;
  events: TimelineEvent[];
}

export interface EventMoveDetail {
  event: TimelineEvent;
  oldResourceId: string;
  newResourceId: string;
  newStartTime: string;
  newEndTime: string;
  hasConflict?: boolean;
  conflictMessage?: string;
}

export interface EventResizeDetail {
  event: TimelineEvent;
  resourceId: string;
  newStartTime: string;
  newEndTime: string;
  hasConflict?: boolean;
  conflictMessage?: string;
}

export interface EventCreateDetail {
  resourceId: string;
  startTime: string;
  endTime: string;
  date: string;
  hasConflict?: boolean;
  conflictMessage?: string;
}

export interface MonthEvent {
  id: string;
  title: string;
  color: EventColor;
  date: string; // "YYYY-MM-DD"
  startTime?: string; // "HH:MM" 24h — optional
  endTime?: string;
  allDay?: boolean;
  recurrenceRule?: string;
  isMultiDay?: boolean;
  spanPosition?: "start" | "middle" | "end" | "single";
  startDate?: string;
  endDate?: string;
}
export interface SchedulerSaveData {
  /** Present when editing an existing event; null/undefined when creating a new one. */
  id: string | null;
  title: string;
  startDate: string;
  startTime: string; // "HH:MM" in the selected timezone
  endDate: string;
  endTime: string; // "HH:MM" in the selected timezone
  participants: string[];
  description: string;
  activeColor: string;
  /** IANA timezone the user was viewing when they entered the times. */
  timezone: string;
  allDay?: boolean;
  recurrenceRule?: string;
}

export interface SchedulerDeleteData {
  id: string | null;
  title: string;
}

export interface JanusEventMap {
  "event-click": TimelineEvent;
  "add-event": void;
  "day-click": { date: string };
  "view-change": { view: ViewType };
  "allow-create-change": { allowCreate: boolean };
  "event-move": EventMoveDetail;
  "event-resize": EventResizeDetail;
  "event-create": EventCreateDetail;
  save: SchedulerSaveData;
  delete: SchedulerDeleteData;
  close: void;
}
