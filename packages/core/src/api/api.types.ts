export interface TimelineEvent {
  id: string;
  title: string;
  startTime: string; // "HH:MM" 24h
  endTime: string; // "HH:MM" 24h
  color: "orange" | "blue" | "yellow" | "purple" | "green";
  date?: string;
}

export interface TimelineResource {
  id: string;
  name: string;
  subtitle: string;
  avatarType: "initials" | "icon";
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
}

export interface EventResizeDetail {
  event: TimelineEvent;
  resourceId: string;
  newStartTime: string;
  newEndTime: string;
}

export interface EventCreateDetail {
  resourceId: string;
  startTime: string;
  endTime: string;
  date: string;
}

export interface MonthEvent {
  id: string;
  title: string;
  color: "orange" | "blue" | "yellow" | "purple" | "green";
  date: string; // "YYYY-MM-DD"
  startTime?: string; // "HH:MM" 24h — optional
  endTime?: string;
}

export interface SchedulerSaveData {
  /** Present when editing an existing event; null/undefined when creating a new one. */
  id: string | null;
  title: string;
  startDate: string;
  startTime: string; // "HH:MM"
  endDate: string;
  endTime: string;
  participants: string[];
  description: string;
  activeColor: string;
}

export interface SchedulerDeleteData {
  id: string | null;
  title: string;
}

export interface JanusEventMap {
  "event-click": TimelineEvent;
  "add-event": void;
  "day-click": { date: string };
  "view-change": { view: "Timeline" | "Month" };
  "event-move": EventMoveDetail;
  "event-resize": EventResizeDetail;
  "event-create": EventCreateDetail;
  save: SchedulerSaveData;
  delete: SchedulerDeleteData;
  close: void;
}
