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
export { YearGridComponent } from "./lib/year-grid.component";
export { AiBarComponent } from "./lib/ai-bar.component";
export { TopbarComponent } from "./lib/topbar.component";
export { ChatComponent } from "./lib/chat.component";
export { JanusChatService } from "./lib/chat.service";

// Core Utilities — Facade Pattern
export {
  SchedulerManager,
  getBrowserTimezone,
  isoToZonedDisplay,
  zonedInputToISO,
  schedulerStore,
} from "@janus-scheduler/core";
export type { SchedulerHooks } from "@janus-scheduler/core";

export {
  presentSession,
  summarise,
  beginSession,
  provideAnswer,
  ChatController,
  type EntityCatalog,
  type SessionContext,
  type SessionRequirements,
  type SessionState,
  type JanusChatOptions,
  type ConfirmOutcome,
  type NlpEngine,
} from "@janus-scheduler/nlp";

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

// <janus-chat> view-model types — from @janus-scheduler/ui, see lib/types.ts
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
} from "./lib/types";

// Domain model classes — re-exported for use in hook consumers (Option B)
export { Event, Resource, Assignment } from "./lib/types";
