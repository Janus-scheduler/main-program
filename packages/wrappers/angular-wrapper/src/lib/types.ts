/**
 * Angular Wrapper Types
 *
 * Re-exports the framework-agnostic types from @janus-scheduler/ui
 * so consumers can import everything from @janus-scheduler/angular.
 */
export type {
  TimelineEvent,
  TimelineResource,
  EventMoveDetail,
  EventResizeDetail,
  EventCreateDetail,
} from "@janus-scheduler/ui";

export interface SchedulerSaveData {
  id?: string | null;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  participants: string[];
  description: string;
  activeColor: string;
}
