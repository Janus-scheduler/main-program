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

export { SchedulerManager } from "@janus-scheduler/core";
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
  onClose?: (e: CustomEvent<void>) => void;
  onSave?: (e: CustomEvent<SchedulerSaveData>) => void;
  onDelete?: (e: CustomEvent<SchedulerDeleteData>) => void;
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
    const attach = (eventName: string, handler?: (e: Event) => void) => {
      if (handler) {
        ref?.addEventListener(eventName, handler);
        onCleanup(() => ref?.removeEventListener(eventName, handler));
      }
    };
    attach("close", props.onClose as (e: Event) => void);
    attach("save", props.onSave as (e: Event) => void);
    attach("delete", props.onDelete as (e: Event) => void);
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
  onEventClick?: (e: CustomEvent<TimelineEvent>) => void;
  onAddEvent?: (e: Event) => void;
  onEventMove?: (e: CustomEvent) => void;
  onEventResize?: (e: CustomEvent) => void;
  onEventCreate?: (e: CustomEvent) => void;
  onViewChange?: (e: CustomEvent) => void;
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
    const attach = (eventName: string, handler?: (e: Event) => void) => {
      if (handler) {
        ref?.addEventListener(eventName, handler);
        onCleanup(() => ref?.removeEventListener(eventName, handler));
      }
    };
    attach("event-click", props.onEventClick as (e: Event) => void);
    attach("add-event", props.onAddEvent as (e: Event) => void);
    attach("event-move", props.onEventMove as (e: Event) => void);
    attach("event-resize", props.onEventResize as (e: Event) => void);
    attach("event-create", props.onEventCreate as (e: Event) => void);
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
  onEventClick?: (e: CustomEvent<TimelineEvent>) => void;
  onDayClick?: (e: CustomEvent<{ date: string }>) => void;
  onAddEvent?: (e: CustomEvent<void>) => void;
  onViewChange?: (e: CustomEvent<{ view: "Timeline" | "Month" }>) => void;
}

export const MonthGrid: Component<MonthGridProps> = (props) => {
  let ref!: HTMLElement;

  onMount(() => {
    const attach = (eventName: string, handler?: (e: Event) => void) => {
      if (handler) {
        ref?.addEventListener(eventName, handler);
        onCleanup(() => ref?.removeEventListener(eventName, handler));
      }
    };
    attach("event-click", props.onEventClick as (e: Event) => void);
    attach("day-click", props.onDayClick as (e: Event) => void);
    attach("add-event", props.onAddEvent as (e: Event) => void);
    attach("view-change", props.onViewChange as (e: Event) => void);
  });

  return (
    <janus-month-grid
      ref={(el: HTMLElement) => {
        ref = el;
      }}
    />
  );
};
