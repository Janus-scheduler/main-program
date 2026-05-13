import { onMount, onCleanup, createEffect, Component } from "solid-js";
import {
  JanusScheduler as JanusSchedulerWC,
  JanusTimeline as JanusTimelineWC,
  JanusMonthGrid as JanusMonthGridWC,
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

export { Event, Resource, Assignment } from "@janus-scheduler/core";

declare module "solid-js" {
  namespace JSX {
    interface IntrinsicElements {
      "janus-scheduler": Record<string, unknown>;
      "janus-timeline": Record<string, unknown>;
      "janus-month-grid": Record<string, unknown>;
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
  onEventClick?: (detail: TimelineEvent) => void;
  onAddEvent?: () => void;
  onEventMove?: (detail: EventMoveDetail) => void;
  onEventResize?: (detail: EventResizeDetail) => void;
  onEventCreate?: (detail: EventCreateDetail) => void;
  onViewChange?: (detail: { view: "Timeline" | "Month" }) => void;
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
    attach("add-event", props.onAddEvent);
    attach("event-move", props.onEventMove);
    attach("event-resize", props.onEventResize);
    attach("event-create", props.onEventCreate);
    attach("view-change", props.onViewChange);
  });

  return (
    <janus-timeline
      ref={(el: HTMLElement) => {
        ref = el;
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
  onEventClick?: (detail: TimelineEvent) => void;
  onDayClick?: (detail: { date: string }) => void;
  onAddEvent?: () => void;
  onViewChange?: (detail: { view: "Timeline" | "Month" }) => void;
}

export const MonthGrid: Component<MonthGridProps> = (props) => {
  let ref!: HTMLElement;

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
  });

  return (
    <janus-month-grid
      ref={(el: HTMLElement) => {
        ref = el;
      }}
    />
  );
};
