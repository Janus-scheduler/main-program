import {
  onMount,
  onCleanup,
  createEffect,
  Component,
  createSignal,
} from "solid-js";
import {
  JanusScheduler as JanusSchedulerWC,
  JanusTimeline as JanusTimelineWC,
  JanusMonthGrid as JanusMonthGridWC,
  JanusAiBar as JanusAiBarWC,
  JanusTopbar as JanusTopbarWC,
  JanusChat as JanusChatWC,
  // `<janus-chat>`'s types describe what the component RENDERS, so they live
  // in @janus-scheduler/ui rather than core — see the export block below.
  type ChatRole,
  type ChatChipKind,
  type ChatChip,
  type ChatChange,
  type ChatParseCard,
  type ChatChoice,
  type ChatSuggestion,
  type ChatMessage,
  type ChatTextMessage,
  type ChatThinkingMessage,
  type ChatParseMessage,
  type ChatClarifyMessage,
  type ChatSuccessMessage,
  type ChatDividerMessage,
  type ChatSubmitDetail,
  type ChatActionDetail,
  type ChatClarifyResponseDetail,
  type ChatSuggestionDetail,
} from "@janus-scheduler/ui";
import type {
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

import {
  ChatController,
  type JanusChatOptions,
  type SessionState,
} from "@janus-scheduler/nlp";

export interface JanusChatConversation {
  thread: () => ChatMessage[];
  busy: () => boolean;
  session: () => SessionState | null;
  submit: (text: string) => void;
  choose: (label: string) => void;
  confirm: () => void;
  undo: (messageId: string) => void;
  reset: () => void;
}

export function createJanusChat(
  options: JanusChatOptions,
): JanusChatConversation {
  const controller = new ChatController(options);

  const [thread, setThread] = createSignal(controller.thread);
  const [busy, setBusy] = createSignal(controller.busy);
  const [session, setSession] = createSignal(controller.session);

  const unsubscribe = controller.subscribe(() => {
    setThread(controller.thread);
    setBusy(controller.busy);
    setSession(controller.session);
  });

  onCleanup(unsubscribe);

  return {
    thread: () => thread() as ChatMessage[],
    busy,
    session,
    submit: (text) => controller.submit(text),
    choose: (label) => controller.choose(label),
    confirm: () => controller.confirm(),
    undo: (id) => controller.undo(id),
    reset: () => controller.reset(),
  };
}

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
};

/**
 * `<janus-chat>` view-model types.
 *
 * From `@janus-scheduler/ui`, not `core`: they describe what the component
 * renders — bubbles, chips, cards — rather than domain state, and nothing in
 * `core` produces or consumes them. Re-exported here so the facade rule holds
 * and host apps import only from `@janus-scheduler/solid`.
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
};

export { Event, Resource, Assignment } from "@janus-scheduler/core";

declare module "solid-js" {
  namespace JSX {
    interface IntrinsicElements {
      "janus-scheduler": Record<string, unknown>;
      "janus-timeline": Record<string, unknown>;
      "janus-month-grid": Record<string, unknown>;
      "janus-ai-bar": Record<string, unknown>;
      "janus-topbar": Record<string, unknown>;
      "janus-chat": Record<string, unknown>;
    }
  }
}

// Ensure custom elements are registered
if (!customElements.get("janus-scheduler")) {
  customElements.define("janus-scheduler", JanusSchedulerWC);
}
if (!customElements.get("janus-timeline")) {
  customElements.define("janus-timeline", JanusTimelineWC);
}
if (!customElements.get("janus-month-grid")) {
  customElements.define("janus-month-grid", JanusMonthGridWC);
}
if (!customElements.get("janus-ai-bar")) {
  customElements.define("janus-ai-bar", JanusAiBarWC);
}
if (!customElements.get("janus-chat")) {
  customElements.define("janus-chat", JanusChatWC);
}
if (!customElements.get("janus-topbar")) {
  customElements.define("janus-topbar", JanusTopbarWC);
}

/**
 * <Scheduler> — Modal form for creating or editing a single event.
 *
 * Events:
 *  - onSave   → CustomEvent<SchedulerSaveData>    — user submitted the form
 *  - onDelete → CustomEvent<SchedulerDeleteData>  — user clicked Delete
 *  - onClose  → CustomEvent<void>                 — user dismissed the modal
 */
export interface SchedulerProps {
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
  preventConflicts?: boolean;
  showConfirmOnCreate?: boolean;
  onClose?: () => void;
  onSave?: (detail: SchedulerSaveData) => void;
  onDelete?: (detail: SchedulerDeleteData) => void;
}

export const Scheduler: Component<SchedulerProps> = (props) => {
  let ref!: HTMLElement;

  createEffect(() => {
    if (ref) {
      const el = ref as unknown as Record<string, unknown>;
      if (props.eventId !== undefined) el.eventId = props.eventId;
      if (props.title !== undefined) el.title = props.title;
      if (props.startDate !== undefined) el.startDate = props.startDate;
      if (props.endDate !== undefined) el.endDate = props.endDate;
      if (props.startTime !== undefined) el.startTime = props.startTime;
      if (props.endTime !== undefined) el.endTime = props.endTime;
      if (props.participants !== undefined)
        el.participants = props.participants;
      if (props.description !== undefined) el.description = props.description;
      if (props.activeColor !== undefined) el.activeColor = props.activeColor;
      if (props.error !== undefined) el.error = props.error;
      if (props.allDay !== undefined) el.allDay = props.allDay;
      if (props.recurrenceRule !== undefined)
        el.recurrenceRule = props.recurrenceRule;
      if (props.preventConflicts !== undefined)
        el.preventConflicts = props.preventConflicts;
      if (props.showConfirmOnCreate !== undefined)
        el.showConfirmOnCreate = props.showConfirmOnCreate;
    }
  });

  onMount(() => {
    const attach = <T,>(eventName: string, handler?: (detail: T) => void) => {
      if (handler) {
        const listener = (e: Event) => handler((e as CustomEvent).detail);
        ref?.addEventListener(eventName, listener);
        onCleanup(() => ref?.removeEventListener(eventName, listener));
      }
    };
    attach("close", props.onClose);
    attach("save", props.onSave);
    attach("delete", props.onDelete);
  });

  return (
    <janus-scheduler
      ref={(el: HTMLElement) => {
        ref = el;
      }}
    />
  );
};

/**
 * <Timeline> — Horizontal resource/time-axis view with drag-and-drop.
 *
 * Events:
 *  - onEventClick   → CustomEvent<TimelineEvent>       — user clicked an event chip
 *  - onAddEvent     → CustomEvent<void>                — user clicked the + FAB
 *  - onEventMove    → CustomEvent<EventMoveDetail>     — drag completed (move)
 *  - onEventResize  → CustomEvent<EventResizeDetail>   — drag completed (resize)
 *  - onEventCreate  → CustomEvent<EventCreateDetail>   — drag completed (new event)
 *
 * The component reads directly from the Zustand store, so you only need
 * to call manager.addEvent() / manager.updateEvent() — the UI updates automatically.
 */
export interface TimelineProps {
  resources?: TimelineResource[];
  view?: "Timeline" | "Month";
  currentDate?: Date;
  aiPrompt?: string;
  allowCreate?: boolean;
  showFab?: boolean;
  preventConflicts?: boolean;
  onEventClick?: (detail: TimelineEvent) => void;
  onAddEvent?: () => void;
  onEventMove?: (detail: EventMoveDetail) => void;
  onEventResize?: (detail: EventResizeDetail) => void;
  onEventCreate?: (detail: EventCreateDetail) => void;
  onViewChange?: (detail: { view: "Timeline" | "Month" }) => void;
  onNavChange?: (detail: Record<string, unknown>) => void;
  ref?: (el: HTMLElement) => void;
  onConflictDetected?: (detail: {
    message: string;
    action: string;
    detail: EventMoveDetail | EventResizeDetail | EventCreateDetail;
  }) => void;
}

export const Timeline: Component<TimelineProps> = (props) => {
  let ref!: HTMLElement;

  createEffect(() => {
    if (ref) {
      const el = ref as unknown as Record<string, unknown>;
      if (props.resources !== undefined) el.resources = props.resources;
      if (props.view !== undefined) el.view = props.view;
      if (props.currentDate !== undefined) el.currentDate = props.currentDate;
      if (props.aiPrompt !== undefined) el.aiPrompt = props.aiPrompt;
      if (props.allowCreate !== undefined) el.allowCreate = props.allowCreate;
      if (props.showFab !== undefined) el.showFab = props.showFab;
      if (props.preventConflicts !== undefined)
        el.preventConflicts = props.preventConflicts;
    }
  });

  onMount(() => {
    const attach = <T,>(eventName: string, handler?: (detail: T) => void) => {
      if (handler) {
        const listener = (e: Event) => handler((e as CustomEvent).detail);
        ref?.addEventListener(eventName, listener);
        onCleanup(() => ref?.removeEventListener(eventName, listener));
      }
    };

    const attachMoveResizeCreate = <
      T extends EventMoveDetail | EventResizeDetail | EventCreateDetail,
    >(
      eventName: string,
      handler?: (detail: T) => void,
    ) => {
      if (handler) {
        const listener = (e: Event) => {
          const detail = (e as CustomEvent).detail as T;
          if (props.preventConflicts && detail.hasConflict) {
            return;
          }
          handler(detail);
        };
        ref?.addEventListener(eventName, listener);
        onCleanup(() => ref?.removeEventListener(eventName, listener));
      }
    };

    attach("event-click", props.onEventClick);
    attach("add-event", props.onAddEvent);
    attachMoveResizeCreate("event-move", props.onEventMove);
    attachMoveResizeCreate("event-resize", props.onEventResize);
    attachMoveResizeCreate("event-create", props.onEventCreate);
    attach("view-change", props.onViewChange);
    attach("nav-change", props.onNavChange);
    attach("conflict-detected", props.onConflictDetected);
  });

  return (
    <janus-timeline
      ref={(el: HTMLElement) => {
        ref = el;
        if (props.ref) props.ref(el);
      }}
    />
  );
};

/**
 * <MonthGrid> — Monthly calendar view showing event chips per day.
 *
 * Events:
 *  - onEventClick → CustomEvent<TimelineEvent>                  — user clicked an event chip
 *  - onDayClick   → CustomEvent<{ date: string }>               — user clicked an empty day cell
 *  - onAddEvent   → CustomEvent<void>                           — user clicked the + FAB
 *  - onViewChange → CustomEvent<{ view: "Timeline" | "Month" }> — user switched views
 *
 * The component reads directly from the Zustand store.
 */
export interface MonthGridProps {
  showFab?: boolean;
  onEventClick?: (detail: TimelineEvent) => void;
  onDayClick?: (detail: { date: string }) => void;
  onAddEvent?: () => void;
  onViewChange?: (detail: { view: "Timeline" | "Month" }) => void;
  onNavChange?: (detail: Record<string, unknown>) => void;
  ref?: (el: HTMLElement) => void;
}

export const MonthGrid: Component<MonthGridProps> = (props) => {
  let ref!: HTMLElement;

  createEffect(() => {
    if (ref) {
      const el = ref as unknown as Record<string, unknown>;
      if (props.showFab !== undefined) el.showFab = props.showFab;
    }
  });

  onMount(() => {
    const attach = <T,>(eventName: string, handler?: (detail: T) => void) => {
      if (handler) {
        const listener = (e: Event) => handler((e as CustomEvent).detail);
        ref?.addEventListener(eventName, listener);
        onCleanup(() => ref?.removeEventListener(eventName, listener));
      }
    };
    attach("event-click", props.onEventClick);
    attach("day-click", props.onDayClick);
    attach("add-event", props.onAddEvent);
    attach("view-change", props.onViewChange);
    attach("nav-change", props.onNavChange);
  });

  return (
    <janus-month-grid
      ref={(el: HTMLElement) => {
        ref = el;
        if (props.ref) props.ref(el);
      }}
    />
  );
};

export interface AiBarProps {
  placeholder?: string;
  buttonLabel?: string;
  onAiSubmit?: (detail: { prompt: string }) => void;
  onAiInput?: (detail: { prompt: string }) => void;
}

export const AiBar: Component<AiBarProps> = (props) => {
  let ref!: HTMLElement;

  onMount(() => {
    const attach = <T,>(eventName: string, handler?: (detail: T) => void) => {
      if (handler) {
        const listener = (e: Event) => handler((e as CustomEvent).detail);
        ref?.addEventListener(eventName, listener);
        onCleanup(() => ref?.removeEventListener(eventName, listener));
      }
    };
    attach("ai-submit", props.onAiSubmit);
    attach("ai-input", props.onAiInput);
  });

  return (
    <janus-ai-bar
      ref={(el: HTMLElement) => {
        ref = el;
      }}
      placeholder={props.placeholder}
      button-label={props.buttonLabel}
    />
  );
};

export interface TopbarProps {
  navLabel?: string;
  dayName?: string;
  shortDate?: string;
  view?: "Timeline" | "Month";
  allowCreate?: boolean;
  zoomPercent?: number;
  zoomUnit?: string;
  onPrevClick?: () => void;
  onNextClick?: () => void;
  onTodayClick?: () => void;
  onViewSwitch?: (detail: { view: "Timeline" | "Month" }) => void;
  onToggleCreate?: () => void;
}

export const Topbar: Component<TopbarProps> = (props) => {
  let ref!: HTMLElement;

  createEffect(() => {
    if (ref) {
      const el = ref as unknown as Record<string, unknown>;
      if (props.navLabel !== undefined) el.navLabel = props.navLabel;
      if (props.dayName !== undefined) el.dayName = props.dayName;
      if (props.shortDate !== undefined) el.shortDate = props.shortDate;
      if (props.view !== undefined) el.view = props.view;
      if (props.allowCreate !== undefined) el.allowCreate = props.allowCreate;
      if (props.zoomPercent !== undefined) el.zoomPercent = props.zoomPercent;
      if (props.zoomUnit !== undefined) el.zoomUnit = props.zoomUnit;
    }
  });

  onMount(() => {
    const attach = <T,>(eventName: string, handler?: (detail: T) => void) => {
      if (handler) {
        const listener = (e: Event) => handler((e as CustomEvent).detail);
        ref?.addEventListener(eventName, listener);
        onCleanup(() => ref?.removeEventListener(eventName, listener));
      }
    };
    attach("prev-click", props.onPrevClick);
    attach("next-click", props.onNextClick);
    attach("today-click", props.onTodayClick);
    attach("view-switch", props.onViewSwitch);
    attach("toggle-create", props.onToggleCreate);
  });

  return (
    <janus-topbar
      ref={(el: HTMLElement) => {
        ref = el;
      }}
    />
  );
};

// ── <janus-chat> ──────────────────────────────────────────────────────────

export interface ChatProps {
  messages?: ChatMessage[];
  suggestions?: ChatSuggestion[];
  heading?: string;
  subheading?: string;
  placeholder?: string;
  value?: string;
  busy?: boolean;
  showClose?: boolean;
  showVoice?: boolean;
  /** `"light"` (default) · `"dark"` · `"auto"` follows the OS. */
  theme?: "light" | "dark" | "auto";
  onChatSubmit?: (detail: ChatSubmitDetail) => void;
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
 * Solid binding for `<janus-chat>`.
 *
 * `messages` and `suggestions` are arrays of objects, so they are assigned as
 * PROPERTIES inside a `createEffect` rather than passed as JSX attributes —
 * an attribute would stringify them to "[object Object]". `theme` reflects to
 * an attribute on the element itself, so it can go either way; it is set as a
 * property here for consistency with everything else.
 */
export const Chat: Component<ChatProps> = (props) => {
  let ref!: HTMLElement;

  createEffect(() => {
    if (!ref) return;
    const el = ref as unknown as Record<string, unknown>;
    if (props.messages !== undefined) el.messages = props.messages;
    if (props.suggestions !== undefined) el.suggestions = props.suggestions;
    if (props.heading !== undefined) el.heading = props.heading;
    if (props.subheading !== undefined) el.subheading = props.subheading;
    if (props.placeholder !== undefined) el.placeholder = props.placeholder;
    if (props.value !== undefined) el.value = props.value;
    if (props.busy !== undefined) el.busy = props.busy;
    if (props.showClose !== undefined) el.showClose = props.showClose;
    if (props.showVoice !== undefined) el.showVoice = props.showVoice;
    if (props.theme !== undefined) el.theme = props.theme;
  });

  onMount(() => {
    const attach = <T,>(eventName: string, handler?: (detail: T) => void) => {
      if (handler) {
        const listener = (e: Event) => handler((e as CustomEvent).detail);
        ref?.addEventListener(eventName, listener);
        onCleanup(() => ref?.removeEventListener(eventName, listener));
      }
    };
    attach("chat-submit", props.onChatSubmit);
    attach("chat-confirm", props.onChatConfirm);
    attach("chat-edit", props.onChatEdit);
    attach("chat-clarify-response", props.onChatClarifyResponse);
    attach("chat-undo", props.onChatUndo);
    attach("chat-view", props.onChatView);
    attach("chat-suggestion-select", props.onChatSuggestionSelect);
    attach("chat-input", props.onChatInput);
    attach("chat-close", props.onChatClose);
  });

  return (
    <janus-chat
      ref={(el: HTMLElement) => {
        ref = el;
      }}
    />
  );
};
