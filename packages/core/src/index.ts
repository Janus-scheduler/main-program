export { SchedulerManager } from "./services/SchedulerManager.service";
export type {
  SchedulerHooks,
  SchedulerConfig,
  UndoAction,
} from "./services/SchedulerManager.service";
export * from "./store";
export * from "./api/api.init";
export type {
  SchedulerState,
  SchedulerActions,
  SchedulerStore,
  EventDraft,
} from "./store/scheduler.store";

// ── Domain model classes (Option B: exported so hook consumers get rich objects) ──
export { Event } from "./models/events/event";
export { Resource } from "./models/resources/resources";
export { Assignment } from "./models/assignments/assignments";

// ── Input data shapes (used in SchedulerManager public method signatures) ──
export type { EventData } from "./types/event.types";
export type { ResourceData } from "./models/resources/resources";
export type { AssignmentData } from "./models/assignments/assignments";

// ── Timezone utilities ──
export {
  getBrowserTimezone,
  isoToZonedDisplay,
  zonedInputToISO,
  getUtcMsForZonedDatetime,
  toFakeLocalDate,
  formatTimezoneLabel,
  getAllTimezones,
} from "./utils/time";

export { expandEvents } from "./utils/recurrence";
export {
  computeTimelineConflicts,
  checkSlotConflict,
  checkDraftConflict,
} from "./utils/conflict";
export type { ConflictEvent, ConflictResource } from "./utils/conflict";
