/**
 * Angular Wrapper Types
 *
 * Re-exports the framework-agnostic types from @janus-scheduler/core
 * so consumers can import everything from @janus-scheduler/angular.
 */
export type {
  TimelineEvent,
  TimelineResource,
  EventMoveDetail,
  EventResizeDetail,
  EventCreateDetail,
  SchedulerSaveData,
  SchedulerDeleteData,
  EventColor,
  ViewType,
  EventData,
  ResourceData,
  AssignmentData,
} from "@janus-scheduler/core";

export { Event, Resource, Assignment } from "@janus-scheduler/core";
