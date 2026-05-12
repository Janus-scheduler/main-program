/**
 * @janus-scheduler/angular
 *
 * Angular wrapper for the Janus Scheduler UI web components.
 *
 * This package is a thin adapter that wraps the framework-agnostic
 * Lit-based web components from @janus-scheduler/ui, making them
 * easy to use with Angular bindings and signals.
 *
 * Public API surface:
 *  – Components   : SchedulerComponent, TimelineComponent, MonthGridComponent
 *  – Types        : TimelineEvent, TimelineResource, EventColor, ViewType, etc.
 *                   (re-exported from @janus-scheduler/core)
 */

// Components
export { SchedulerComponent } from "./lib/scheduler.component";
export { TimelineComponent } from "./lib/timeline.component";
export { MonthGridComponent } from "./lib/month-grid.component";

// Types — re-exported so consumers don't need to import from @janus-scheduler/core directly
export type {
  TimelineEvent,
  TimelineResource,
  SchedulerSaveData,
  SchedulerDeleteData,
  EventMoveDetail,
  EventResizeDetail,
  EventCreateDetail,
  EventColor,
  ViewType,
  EventData,
  ResourceData,
  AssignmentData,
} from "./lib/types";

// Domain model classes — re-exported for use in hook consumers (Option B)
export { Event, Resource, Assignment } from "./lib/types";
