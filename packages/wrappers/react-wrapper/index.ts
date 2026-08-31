import React, { useRef, useState, useEffect } from "react";
import { createComponent } from "@lit/react";
import {
  JanusScheduler as JanusSchedulerWC,
  JanusTimeline as JanusTimelineWC,
  JanusMonthGrid as JanusMonthGridWC,
  JanusDayGrid as JanusDayGridWC,
  JanusWeekGrid as JanusWeekGridWC,
  JanusYearGrid as JanusYearGridWC,
  JanusAiBar as JanusAiBarWC,
  JanusTopbar as JanusTopbarWC,
  JanusChat as JanusChatWC,
  type ChatMessage,
  type ChatChip,
  type ChatChipKind,
  type ChatChoice,
  type ChatParseCard,
  type ChatSuggestion,
  type ChatRole,
  type ChatSubmitDetail,
  type ChatActionDetail,
  type ChatClarifyResponseDetail,
  type ChatSuggestionDetail,
  JanusConfirmDialog as JanusConfirmDialogWC,
} from "@janus-scheduler/ui";

import {
  beginSession,
  provideAnswer,
  presentSession,
  summarise,
  ChatController,
  type SessionState,
  type JanusChatOptions,
} from "@janus-scheduler/nlp";

import {
  SchedulerManager,
  getBrowserTimezone,
  isoToZonedDisplay,
  zonedInputToISO,
  schedulerStore,
  Event,
  Resource,
  Assignment,
  type TimelineEvent,
  type TimelineResource,
  type EventMoveDetail,
  type EventResizeDetail,
  type EventCreateDetail,
  type SchedulerSaveData,
  type TimeGridEvent,
  type SlotSelectDetail,
  type TimeGridEventMoveDetail,
  type TimeGridEventResizeDetail,
  type ViewType,
  type EventDraft,
} from "@janus-scheduler/core";

// ─────────────────────────────────────────────────────────────────────────────
// Re-exports for host app consumers
// ─────────────────────────────────────────────────────────────────────────────

export type {
  ChatMessage,
  ChatChip,
  ChatChipKind,
  ChatChoice,
  ChatParseCard,
  ChatSuggestion,
  ChatRole,
  ChatSubmitDetail,
  ChatActionDetail,
  ChatClarifyResponseDetail,
  ChatSuggestionDetail,
};

export {
  SchedulerManager,
  getBrowserTimezone,
  isoToZonedDisplay,
  zonedInputToISO,
  schedulerStore,
  Event,
  Resource,
  Assignment,
};

export { presentSession, summarise, beginSession, provideAnswer };

export type {
  TimelineEvent,
  TimelineResource,
  EventMoveDetail,
  EventResizeDetail,
  EventCreateDetail,
  SchedulerSaveData,
  TimeGridEvent,
  SlotSelectDetail,
  TimeGridEventMoveDetail,
  TimeGridEventResizeDetail,
  ViewType,
  EventDraft,
  EventColor,
  SchedulerHooks,
  SchedulerConfig,
  UndoAction,
  SchedulerDeleteData,
  MonthEvent,
  TimeGridEventResource,
  EventData,
  ResourceData,
  AssignmentData,
} from "@janus-scheduler/core";

// ─────────────────────────────────────────────────────────────────────────────
// useJanusChat Hook & Types
// ─────────────────────────────────────────────────────────────────────────────

export interface JanusChatConversation {
  thread: ChatMessage[];
  busy: boolean;
  session: SessionState | null;
  submit: (text: string) => void;
  choose: (label: string) => void;
  confirm: () => void;
  undo: (messageId: string) => void;
  reset: () => void;
  edit?: () => void;
}

export function useJanusChat(options: JanusChatOptions): JanusChatConversation {
  const controllerRef = useRef<ChatController | null>(null);

  if (!controllerRef.current) {
    controllerRef.current = new ChatController(options);
  }

  const controller = controllerRef.current;

  // Keep options up to date (e.g. when engine becomes ready)
  controller.updateOptions(options);

  const [state, setState] = useState<{
    thread: ChatMessage[];
    busy: boolean;
    session: SessionState | null;
  }>({
    thread: controller.thread as unknown as ChatMessage[],
    busy: controller.busy,
    session: controller.session,
  });

  useEffect(() => {
    const unsubscribe = controller.subscribe(() => {
      setState({
        thread: controller.thread as unknown as ChatMessage[],
        busy: controller.busy,
        session: controller.session,
      });
    });
    return unsubscribe;
  }, [controller]);

  return {
    thread: state.thread as ChatMessage[],
    busy: state.busy,
    session: state.session,
    submit: (text: string) => controller.submit(text),
    choose: (label: string) => controller.choose(label),
    confirm: () => controller.confirm(),
    undo: (id: string) => controller.undo(id),
    reset: () => controller.reset(),
    edit: () => controller.edit(),
  };
}

function withDetail<T>(cb?: (detail: T) => void) {
  return cb
    ? (e: globalThis.Event) => cb((e as CustomEvent<T>).detail)
    : undefined;
}

function withVoid(cb?: () => void) {
  return cb ? () => cb() : undefined;
}

// ─────────────────────────────────────────────────────────────────────────────
// Web Component → React bindings
// ─────────────────────────────────────────────────────────────────────────────

const _Scheduler = createComponent({
  tagName: "janus-scheduler",
  elementClass: JanusSchedulerWC,
  react: React,
  events: {
    onClose: "close",
    onSave: "save",
    onDelete: "delete",
  },
});

export interface SchedulerProps extends React.HTMLAttributes<HTMLElement> {
  eventId?: string | null;
  title?: string;
  startDate?: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  participants?: string[];
  description?: string;
  activeColor?: string;
  error?: string | null;
  allDay?: boolean;
  recurrenceRule?: string;
  timezone?: string;
  preventConflicts?: boolean;
  showConfirmOnCreate?: boolean;
  onClose?: () => void;
  onSave?: (detail: SchedulerSaveData) => void;
  onDelete?: (detail: { id: string | null; title: string }) => void;
}

export function Scheduler(props: SchedulerProps): React.JSX.Element {
  return React.createElement(_Scheduler, {
    ...props,
    onClose: props.onClose ? () => props.onClose!() : undefined,
    onSave: props.onSave
      ? (e: globalThis.Event) =>
          props.onSave!((e as CustomEvent<SchedulerSaveData>).detail)
      : undefined,
    onDelete: props.onDelete
      ? (e: globalThis.Event) =>
          props.onDelete!(
            (e as CustomEvent<{ id: string | null; title: string }>).detail,
          )
      : undefined,
  });
}

const _Timeline = createComponent({
  tagName: "janus-timeline",
  elementClass: JanusTimelineWC,
  react: React,
  events: {
    onEventClick: "event-click",
    onEventMove: "event-move",
    onEventResize: "event-resize",
    onEventCreate: "event-create",
    onAddEvent: "add-event",
    onViewChange: "view-change",
    onNavChange: "nav-change",
    onConflictDetected: "conflict-detected",
  },
});

export interface TimelineProps extends React.HTMLAttributes<HTMLElement> {
  resources?: TimelineResource[];
  view?: ViewType;
  currentDate?: Date;
  aiPrompt?: string;
  allowCreate?: boolean;
  showFab?: boolean;
  preventConflicts?: boolean;
  timezone?: string;
  onEventClick?: (detail: TimelineEvent) => void;
  onEventMove?: (detail: EventMoveDetail) => void;
  onEventResize?: (detail: EventResizeDetail) => void;
  onEventCreate?: (detail: EventCreateDetail) => void;
  onAddEvent?: () => void;
  onViewChange?: (detail: { view: ViewType }) => void;
  onNavChange?: (detail: Record<string, unknown>) => void;
  onConflictDetected?: (detail: {
    message: string;
    action: string;
    detail: EventMoveDetail | EventResizeDetail | EventCreateDetail;
  }) => void;
}

function withConflictBypass<T>(
  prevent: boolean | undefined,
  callback?: (detail: T) => void,
) {
  if (!callback) return undefined;
  return (e: globalThis.Event) => {
    const detail = (e as CustomEvent).detail;
    if (prevent && detail?.hasConflict) {
      return;
    }
    callback(detail);
  };
}

export const Timeline = React.forwardRef<JanusTimelineWC, TimelineProps>(
  (props, ref) => {
    return React.createElement(_Timeline, {
      ...props,
      ref,
      onConflictDetected: props.onConflictDetected
        ? (e: globalThis.Event) =>
            props.onConflictDetected!((e as CustomEvent).detail)
        : undefined,
      onEventClick: props.onEventClick
        ? (e: globalThis.Event) =>
            props.onEventClick!((e as CustomEvent<TimelineEvent>).detail)
        : undefined,
      onEventMove: withConflictBypass(
        props.preventConflicts,
        props.onEventMove,
      ),
      onEventResize: withConflictBypass(
        props.preventConflicts,
        props.onEventResize,
      ),
      onEventCreate: withConflictBypass(
        props.preventConflicts,
        props.onEventCreate,
      ),
      onAddEvent: props.onAddEvent ? () => props.onAddEvent!() : undefined,
      onViewChange: props.onViewChange
        ? (e: globalThis.Event) =>
            props.onViewChange!((e as CustomEvent<{ view: ViewType }>).detail)
        : undefined,
      onNavChange: props.onNavChange
        ? (e: globalThis.Event) =>
            props.onNavChange!(
              (e as CustomEvent<Record<string, unknown>>).detail,
            )
        : undefined,
    });
  },
);

const _MonthGrid = createComponent({
  tagName: "janus-month-grid",
  elementClass: JanusMonthGridWC,
  react: React,
  events: {
    onEventClick: "event-click",
    onDayClick: "day-click",
    onAddEvent: "add-event",
    onViewChange: "view-change",
    onNavChange: "nav-change",
  },
});

export interface MonthGridProps extends React.HTMLAttributes<HTMLElement> {
  showFab?: boolean;
  timezone?: string;
  onEventClick?: (detail: TimelineEvent) => void;
  onDayClick?: (detail: { date: string }) => void;
  onAddEvent?: () => void;
  onViewChange?: (detail: { view: ViewType }) => void;
  onNavChange?: (detail: Record<string, unknown>) => void;
}

export const MonthGrid = React.forwardRef<JanusMonthGridWC, MonthGridProps>(
  (props, ref) => {
    return React.createElement(_MonthGrid, {
      ...props,
      ref,
      onEventClick: props.onEventClick
        ? (e: globalThis.Event) =>
            props.onEventClick!((e as CustomEvent<TimelineEvent>).detail)
        : undefined,
      onDayClick: props.onDayClick
        ? (e: globalThis.Event) =>
            props.onDayClick!((e as CustomEvent<{ date: string }>).detail)
        : undefined,
      onAddEvent: props.onAddEvent ? () => props.onAddEvent!() : undefined,
      onViewChange: props.onViewChange
        ? (e: globalThis.Event) =>
            props.onViewChange!((e as CustomEvent<{ view: ViewType }>).detail)
        : undefined,
      onNavChange: props.onNavChange
        ? (e: globalThis.Event) =>
            props.onNavChange!(
              (e as CustomEvent<Record<string, unknown>>).detail,
            )
        : undefined,
    });
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// Hour-grid views (Day / Week)
//
// Both web components share the same props and events, so they share one
// props interface and one binding factory here too.
// ─────────────────────────────────────────────────────────────────────────────

export interface TimeGridProps extends React.HTMLAttributes<HTMLElement> {
  /** Externally supplied events. Omit to read from the shared store. */
  events?: TimeGridEvent[];
  showFab?: boolean;
  /** Emit `onSlotSelect` when an empty slot is clicked. Default: true */
  allowCreate?: boolean;
  /** First hour rendered (0–23). Default: 0 */
  startHour?: number;
  /** Last hour rendered, exclusive (1–24). Default: 24 */
  endHour?: number;
  /** Granularity of click-to-create, in minutes. Default: 30 */
  slotMinutes?: number;
  /** Duration applied to a slot selection, in minutes. Default: 60 */
  defaultDuration?: number;
  /** Hour scrolled into view on first paint. Default: 8 */
  scrollToHour?: number;
  /** First day of the week — 0 = Sunday, 1 = Monday. Default: 1 */
  weekStartsOn?: number;
  onEventClick?: (detail: TimeGridEvent) => void;
  onDayClick?: (detail: { date: string }) => void;
  onSlotSelect?: (detail: SlotSelectDetail) => void;
  onEventMove?: (detail: TimeGridEventMoveDetail) => void;
  onEventResize?: (detail: TimeGridEventResizeDetail) => void;
  onAddEvent?: () => void;
  onViewChange?: (detail: { view: ViewType }) => void;
  onNavChange?: (detail: Record<string, unknown>) => void;
}

const timeGridEvents = {
  onEventClick: "event-click",
  onDayClick: "day-click",
  onSlotSelect: "slot-select",
  onEventMove: "event-move",
  onEventResize: "event-resize",
  onAddEvent: "add-event",
  onViewChange: "view-change",
  onNavChange: "nav-change",
} as const;

/** Shared unwrapping of the CustomEvents both hour-grid views fire. */
function timeGridHandlers(props: TimeGridProps) {
  return {
    onEventClick: withDetail(props.onEventClick),
    onDayClick: withDetail(props.onDayClick),
    onSlotSelect: withDetail(props.onSlotSelect),
    onEventMove: withDetail(props.onEventMove),
    onEventResize: withDetail(props.onEventResize),
    onAddEvent: withVoid(props.onAddEvent),
    onViewChange: withDetail(props.onViewChange),
    onNavChange: withDetail(props.onNavChange),
  };
}

const _DayGrid = createComponent({
  tagName: "janus-day-grid",
  elementClass: JanusDayGridWC,
  react: React,
  events: timeGridEvents,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const DayGrid = React.forwardRef<any, TimeGridProps>((props, ref) => {
  return React.createElement(_DayGrid, {
    ...props,
    ref,
    ...timeGridHandlers(props),
  });
});

const _WeekGrid = createComponent({
  tagName: "janus-week-grid",
  elementClass: JanusWeekGridWC,
  react: React,
  events: timeGridEvents,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const WeekGrid = React.forwardRef<any, TimeGridProps>((props, ref) => {
  return React.createElement(_WeekGrid, {
    ...props,
    ref,
    ...timeGridHandlers(props),
  });
});

const _YearGrid = createComponent({
  tagName: "janus-year-grid",
  elementClass: JanusYearGridWC,
  react: React,
  events: {
    onDayClick: "day-click",
    onNavChange: "nav-change",
    onViewChange: "view-change",
  },
});

export interface YearGridProps extends React.HTMLAttributes<HTMLElement> {
  viewYear?: number;
  onDayClick?: (detail: { date: string }) => void;
  onNavChange?: (detail: Record<string, unknown>) => void;
  onViewChange?: (detail: { view: ViewType }) => void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const YearGrid = React.forwardRef<any, YearGridProps>((props, ref) => {
  return React.createElement(_YearGrid, {
    ...props,
    ref,
    onDayClick: props.onDayClick
      ? (e: globalThis.Event) =>
          props.onDayClick!((e as CustomEvent<{ date: string }>).detail)
      : undefined,
    onNavChange: props.onNavChange
      ? (e: globalThis.Event) =>
          props.onNavChange!((e as CustomEvent<Record<string, unknown>>).detail)
      : undefined,
    onViewChange: props.onViewChange
      ? (e: globalThis.Event) =>
          props.onViewChange!((e as CustomEvent<{ view: ViewType }>).detail)
      : undefined,
  });
});

const _AiBar = createComponent({
  tagName: "janus-ai-bar",
  elementClass: JanusAiBarWC,
  react: React,
  events: {
    onAiSubmit: "ai-submit",
    onAiInput: "ai-input",
  },
});

export interface AiBarProps extends React.HTMLAttributes<HTMLElement> {
  placeholder?: string;
  value?: string;
  buttonLabel?: string;
  onAiSubmit?: (detail: { prompt: string }) => void;
  onAiInput?: (detail: { prompt: string }) => void;
}

export function AiBar(props: AiBarProps): React.JSX.Element {
  return React.createElement(_AiBar, {
    ...props,
    onAiSubmit: props.onAiSubmit
      ? (e: globalThis.Event) =>
          props.onAiSubmit!((e as CustomEvent<{ prompt: string }>).detail)
      : undefined,
    onAiInput: props.onAiInput
      ? (e: globalThis.Event) =>
          props.onAiInput!((e as CustomEvent<{ prompt: string }>).detail)
      : undefined,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Chat Wrapper
// ─────────────────────────────────────────────────────────────────────────────

const _Chat = createComponent({
  tagName: "janus-chat",
  elementClass: JanusChatWC,
  react: React,
  events: {
    onChatSubmit: "chat-submit",
    onChatConfirm: "chat-confirm",
    onChatEdit: "chat-edit",
    onChatClarifyResponse: "chat-clarify-response",
    onChatUndo: "chat-undo",
    onChatView: "chat-view",
    onChatSuggestionSelect: "chat-suggestion-select",
    onChatInput: "chat-input",
    onChatClose: "chat-close",
  },
});

export interface ChatProps extends React.HTMLAttributes<HTMLElement> {
  messages?: ChatMessage[];
  suggestions?: ChatSuggestion[];
  heading?: string;
  subheading?: string;
  placeholder?: string;
  value?: string;
  /**
   * Colour scheme. Defaults to `"light"` to match the rest of the Janus
   * components, which are light-only — `"auto"` follows `prefers-color-scheme`
   * and should be used only when the host app is itself dark-aware.
   */
  theme?: "light" | "dark" | "auto";
  showClose?: boolean;
  showVoice?: boolean;
  disabled?: boolean;
  /** Appends the animated thinking bubble while classification is in flight. */
  busy?: boolean;
  onChatSubmit?: (detail: ChatSubmitDetail) => void;
  /** The user approved the parse card. Nothing is written until you act on it. */
  onChatConfirm?: (detail: ChatActionDetail) => void;
  onChatEdit?: (detail: ChatActionDetail) => void;
  onChatClarifyResponse?: (detail: ChatClarifyResponseDetail) => void;
  onChatUndo?: (detail: ChatActionDetail) => void;
  onChatView?: (detail: ChatActionDetail) => void;
  onChatSuggestionSelect?: (detail: ChatSuggestionDetail) => void;
  onChatInput?: (detail: ChatSubmitDetail) => void;
  onChatClose?: () => void;
}

/**
 * Unwraps every `CustomEvent` so consumers receive `detail` directly.
 */
export const Chat = React.forwardRef<JanusChatWC, ChatProps>((props, ref) => {
  const unwrapped: Record<string, unknown> = { ...props, ref };

  const handlers: Array<[keyof ChatProps, ((d: never) => void) | undefined]> = [
    ["onChatSubmit", props.onChatSubmit as (d: never) => void],
    ["onChatConfirm", props.onChatConfirm as (d: never) => void],
    ["onChatEdit", props.onChatEdit as (d: never) => void],
    [
      "onChatClarifyResponse",
      props.onChatClarifyResponse as (d: never) => void,
    ],
    ["onChatUndo", props.onChatUndo as (d: never) => void],
    ["onChatView", props.onChatView as (d: never) => void],
    [
      "onChatSuggestionSelect",
      props.onChatSuggestionSelect as (d: never) => void,
    ],
    ["onChatInput", props.onChatInput as (d: never) => void],
  ];

  for (const [name, handler] of handlers) {
    unwrapped[name] = handler
      ? (e: globalThis.Event) => handler((e as CustomEvent).detail as never)
      : undefined;
  }

  // `chat-close` carries no payload, so it takes no argument.
  unwrapped.onChatClose = props.onChatClose
    ? () => props.onChatClose!()
    : undefined;

  return React.createElement(_Chat, unwrapped);
});
Chat.displayName = "Chat";

// ─────────────────────────────────────────────────────────────────────────────
// Topbar Wrapper
// ─────────────────────────────────────────────────────────────────────────────

const _Topbar = createComponent({
  tagName: "janus-topbar",
  elementClass: JanusTopbarWC,
  react: React,
  events: {
    onPrevClick: "prev-click",
    onNextClick: "next-click",
    onTodayClick: "today-click",
    onViewSwitch: "view-switch",
    onToggleCreate: "toggle-create",
    onUndoClick: "undo-click",
    onBenchmarkClick: "benchmark-click",
  },
});

export interface TopbarProps extends React.HTMLAttributes<HTMLElement> {
  navLabel?: string;
  dayName?: string;
  shortDate?: string;
  view?: ViewType;
  /** Which view tabs to show, in order. Default: Day, Week, Month, Timeline. */
  views?: ViewType[];
  allowCreate?: boolean;
  canUndo?: boolean;
  zoomPercent?: number;
  zoomUnit?: string;
  showBenchmarkBtn?: boolean;
  isBenchmarkActive?: boolean;
  benchmarkLabel?: string;
  onPrevClick?: () => void;
  onNextClick?: () => void;
  onTodayClick?: () => void;
  onViewSwitch?: (detail: { view: ViewType }) => void;
  onToggleCreate?: () => void;
  onUndoClick?: () => void;
  onBenchmarkClick?: () => void;
}

export function Topbar(props: TopbarProps): React.JSX.Element {
  return React.createElement(_Topbar, {
    ...props,
    onPrevClick: withVoid(props.onPrevClick),
    onNextClick: withVoid(props.onNextClick),
    onTodayClick: withVoid(props.onTodayClick),
    onViewSwitch: withDetail(props.onViewSwitch),
    onToggleCreate: withVoid(props.onToggleCreate),
    onUndoClick: withVoid(props.onUndoClick),
    onBenchmarkClick: withVoid(props.onBenchmarkClick),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// ConfirmDialog Wrapper
// ─────────────────────────────────────────────────────────────────────────────

const _ConfirmDialog = createComponent({
  tagName: "janus-confirm-dialog",
  elementClass: JanusConfirmDialogWC,
  react: React,
  events: {
    onConfirm: "confirm",
    onCancel: "cancel",
  },
});

export interface ConfirmDialogProps extends React.HTMLAttributes<HTMLElement> {
  title?: string;
  subtitle?: string;
  confirmText?: string;
  cancelText?: string;
  accentColor?: string;
  /** Single draft — used for event-creation confirmation (legacy) */
  draft?: EventDraft | null;
  /** Before-state for undo comparison */
  fromDraft?: EventDraft | null;
  /** After-state for undo comparison */
  toDraft?: EventDraft | null;
  resolveResourceName?: (id: string) => string;
  onConfirm?: () => void;
  onCancel?: () => void;
}

export function ConfirmDialog(props: ConfirmDialogProps): React.JSX.Element {
  return React.createElement(_ConfirmDialog, {
    ...props,
    onConfirm: props.onConfirm ? () => props.onConfirm!() : undefined,
    onCancel: props.onCancel ? () => props.onCancel!() : undefined,
  });
}
