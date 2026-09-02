// Re-uses TimelineEvent from timeline-types so events are the same shape across both views
export type { TimelineEvent } from "../timeline/timeline-types";

export type {
  MonthEvent,
  DayClickDetail,
  DayHeaderClickDetail,
  MonthSlotSelectDetail,
  MonthMoreClickDetail,
} from "@janus-scheduler/core";
