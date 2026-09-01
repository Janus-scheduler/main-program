/**
 * Color options for scheduler events.
 * Used in both TimelineEvent and MonthEvent.
 */
export type EventColor =
  | "primary"
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
 * The supported calendar views.
 *
 * "Day" and "Week" are the hour-grid (time-grid) views; "Month" is the
 * calendar grid; "Timeline" is the horizontal resource/time-axis view;
 * "Year" is the yearly grid view.
 */
export type ViewType = "Timeline" | "Month" | "Week" | "Day" | "Year";

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
  avatarIcon?: string;
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

/**
 * Detailed payload emitted when a day cell, header, or overflow link is clicked in Month Grid.
 */
export interface DayClickDetail {
  /** "YYYY-MM-DD" */
  date: string;
  /** Exact click target source */
  source?: "header" | "cell" | "more";
  /** All month events occurring on this date */
  events?: MonthEvent[];
  /** The native browser click event if available */
  jsEvent?: MouseEvent;
}

/**
 * Payload emitted when a day header/number badge is clicked (typically navigates to Day View).
 */
export interface DayHeaderClickDetail {
  /** "YYYY-MM-DD" */
  date: string;
  jsEvent?: MouseEvent;
}

/**
 * Payload emitted when an empty slot or cell body in the Month Grid is clicked to create an event.
 */
export interface MonthSlotSelectDetail {
  /** "YYYY-MM-DD" */
  date: string;
  jsEvent?: MouseEvent;
}

/**
 * Payload emitted when the "+N more" overflow indicator on a Month Grid day cell is clicked.
 */
export interface MonthMoreClickDetail {
  /** "YYYY-MM-DD" */
  date: string;
  /** All events occurring on this day */
  events: MonthEvent[];
  /** Number of hidden events that could not fit in the cell row */
  hiddenCount: number;
  jsEvent?: MouseEvent;
}
/**
 * A resource attached to an hour-grid event, resolved down to just what the
 * event card needs to draw an avatar.
 *
 * Kept deliberately smaller than `TimelineResource`: the hour-grid views have
 * no resource axis, so they never need a resource's own event list.
 */
export interface TimeGridEventResource {
  id: string;
  name: string;
  /** Image URL, when the resource has one. */
  avatar?: string;
  type?: "person" | "room" | "equipment";
}

/**
 * One event segment as rendered by the hour-grid views (`<janus-day-grid>` /
 * `<janus-week-grid>`).
 *
 * A single stored event produces one segment per calendar day it touches, with
 * `startTime`/`endTime` already clamped to that day — so the view can position
 * it without doing any timezone maths of its own.
 */
export interface TimeGridEvent {
  id: string;
  title: string;
  color: EventColor;
  /** "YYYY-MM-DD" — the day column this segment belongs to. */
  date: string;
  /** "HH:MM" 24h, clamped to `date`. "00:00" when the event started earlier. */
  startTime: string;
  /** "HH:MM" 24h, clamped to `date`. "24:00" when the event ends later. */
  endTime: string;
  allDay?: boolean;
  recurrenceRule?: string;
  isMultiDay?: boolean;
  spanPosition?: "start" | "middle" | "end" | "single";
  /** "YYYY-MM-DD" of the underlying event's first day. */
  startDate?: string;
  /** "YYYY-MM-DD" of the underlying event's last day. */
  endDate?: string;
  /** Unix ms of the underlying (unclamped) event start. */
  startMs?: number;
  /** Unix ms of the underlying (unclamped) event end. */
  endMs?: number;
  /**
   * Resources assigned to this event, resolved from the store's resource map.
   * Rendered as round avatars on the event card.
   */
  resources?: TimeGridEventResource[];
}

/**
 * Fired when the user clicks/drags an empty region of an hour grid.
 * Times are "HH:MM" in the scheduler's display timezone.
 */
export interface SlotSelectDetail {
  date: string; // "YYYY-MM-DD"
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
}

/**
 * Fired when the user drags an event to a new time (and, in `<janus-week-grid>`,
 * a new day column) in an hour grid.
 *
 * Unlike Timeline's `EventMoveDetail`, there is no resource axis here — moving
 * an event only ever changes its date/time. Times are "HH:MM" in the
 * scheduler's display timezone, matching {@link SlotSelectDetail}.
 */
export interface TimeGridEventMoveDetail {
  event: TimeGridEvent;
  /** "YYYY-MM-DD" the event lived on before the drag. */
  oldDate: string;
  /** "YYYY-MM-DD" it was dropped on — equal to `oldDate` outside Week view. */
  newDate: string;
  newStartTime: string; // "HH:MM"
  newEndTime: string; // "HH:MM"
}

/**
 * Fired when the user drags an event's top or bottom edge to change its
 * duration in an hour grid. Resizing never changes the date.
 */
export interface TimeGridEventResizeDetail {
  event: TimeGridEvent;
  date: string; // "YYYY-MM-DD"
  newStartTime: string; // "HH:MM"
  newEndTime: string; // "HH:MM"
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
  "slot-select": SlotSelectDetail;
  "view-change": { view: ViewType };
  "allow-create-change": { allowCreate: boolean };
  "event-move": EventMoveDetail;
  "event-resize": EventResizeDetail;
  "event-create": EventCreateDetail;
  save: SchedulerSaveData;
  delete: SchedulerDeleteData;
  close: void;
}

export interface ResourceTypeConfig {
  [type: string]: {
    label: string;
    subtitle: string;
    icon?: string;
    order: number;
  };
}
