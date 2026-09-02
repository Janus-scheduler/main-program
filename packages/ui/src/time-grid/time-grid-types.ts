// Re-uses TimelineEvent from timeline-types so events are the same shape across all views
export type { TimelineEvent } from "../timeline/timeline-types";

export type {
  TimeGridEvent,
  TimeGridEventResource,
  SlotSelectDetail,
  TimeGridEventMoveDetail,
  TimeGridEventResizeDetail,
  DayHeaderClickDetail,
} from "@janus-scheduler/core";
