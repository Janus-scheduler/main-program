/**
 * `@janus-scheduler/app` — the batteries-included tier.
 *
 * Importing this module registers `<janus-app>`, a single element that mounts
 * the topbar, all five views and the event editor, and wires every drag,
 * resize, create, save and delete to a `SchedulerManager` for you.
 *
 *   import "@janus-scheduler/app";
 *   <janus-app></janus-app>
 *
 * React users want `@janus-scheduler/app/react` instead, which adds typed props
 * and unwrapped event callbacks.
 *
 * For full control over layout and wiring, use the framework wrapper directly
 * (`@janus-scheduler/react`, `/angular`, `/solid`) and compose the individual
 * `<janus-timeline>`, `<janus-month-grid>`, … components yourself.
 */
export { JanusApp } from "./janus-app";

export type {
  JanusAppChangeDetail,
  JanusAppChangeType,
  JanusAppData,
  JanusAppErrorDetail,
  JanusAppViewChangeDetail,
} from "./app-types";

// ── Facade re-exports ────────────────────────────────────────────────────────
// Per docs/ARCHITECTURE_FACADE.md a consumer should never have to reach into
// @janus-scheduler/core. Everything needed to drive <janus-app> is re-exported
// here so `@janus-scheduler/app` is a single front door.
export {
  SchedulerManager,
  schedulerStore,
  getBrowserTimezone,
  isoToZonedDisplay,
  zonedInputToISO,
  Event,
  Resource,
  Assignment,
} from "@janus-scheduler/core";

export type {
  EventData,
  ResourceData,
  AssignmentData,
  ResourceTypeConfig,
  SchedulerConfig,
  SchedulerHooks,
  SchedulerSaveData,
  SchedulerDeleteData,
  TimelineEvent,
  TimelineResource,
  EventColor,
  ViewType,
} from "@janus-scheduler/core";
