/**
 * @janus-scheduler/angular
 *
 * Angular wrapper for the Janus Scheduler core library.
 *
 * Public API surface:
 *  – Components   : SchedulerComponent, EventCardComponent
 *  – Service      : SchedulerService
 *  – NgModule     : SchedulerModule  (for module-based apps)
 *  – Types        : all interfaces/types
 */

// Components
export { SchedulerComponent } from "./lib/scheduler.component";
export { EventCardComponent } from "./lib/event-card.component";

// Service
export { SchedulerService } from "./lib/scheduler.service";

// NgModule (backwards-compatible)
export { SchedulerModule } from "./lib/scheduler.module";

// Types — re-exported so consumers don't need to import from deep paths
export type {
  JanusEventData,
  JanusResourceData,
  JanusAssignmentData,
  SchedulerConfig,
  SchedulerState,
  SchedulerView,
  EventClickPayload,
  EventCreatePayload,
  EventUpdatePayload,
  EventDeletePayload,
  ResourceClickPayload,
} from "./lib/types";
