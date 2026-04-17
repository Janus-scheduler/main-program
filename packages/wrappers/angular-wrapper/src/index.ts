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
 *  – Components   : SchedulerComponent, TimelineComponent
 *  – Types        : TimelineEvent, TimelineResource (re-exported from @janus-scheduler/ui)
 */

// Components
export { SchedulerComponent } from "./lib/scheduler.component";
export { TimelineComponent } from "./lib/timeline.component";

// Types — re-exported so consumers don't need to import from @janus-scheduler/ui
export type { TimelineEvent, TimelineResource } from "./lib/types";
