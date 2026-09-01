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
  MonthEvent,
  DayClickDetail,
  DayHeaderClickDetail,
  MonthSlotSelectDetail,
  MonthMoreClickDetail,
  TimeGridEvent,
  TimeGridEventResource,
  SlotSelectDetail,
  TimeGridEventMoveDetail,
  TimeGridEventResizeDetail,
  EventColor,
  ViewType,
  EventData,
  ResourceData,
  AssignmentData,
  ResourceTypeConfig,
} from "@janus-scheduler/core";

export { Event, Resource, Assignment } from "@janus-scheduler/core";

/**
 * `<janus-chat>` view-model types.
 *
 * These come from `@janus-scheduler/ui`, not `core`: they describe what the
 * component RENDERS — bubbles, chips, cards — rather than domain state, and
 * nothing in `core` produces or consumes them. Re-exported here so the facade
 * rule still holds and host apps import only from `@janus-scheduler/angular`.
 */
export type {
  ChatRole,
  ChatChipKind,
  ChatChip,
  ChatChange,
  ChatParseCard,
  ChatChoice,
  ChatSuggestion,
  ChatMessage,
  ChatTextMessage,
  ChatThinkingMessage,
  ChatParseMessage,
  ChatClarifyMessage,
  ChatSuccessMessage,
  ChatDividerMessage,
  ChatSubmitDetail,
  ChatActionDetail,
  ChatClarifyResponseDetail,
  ChatSuggestionDetail,
} from "@janus-scheduler/ui";
