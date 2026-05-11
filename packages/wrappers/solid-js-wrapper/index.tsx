/* eslint-disable no-unassigned-vars */
import { onMount, onCleanup, createEffect, Component } from "solid-js";
import {
  JanusScheduler as JanusSchedulerWC,
  JanusTimeline as JanusTimelineWC,
  JanusMonthGrid as JanusMonthGridWC,
} from "@janus-scheduler/ui";
import type { TimelineEvent, TimelineResource } from "@janus-scheduler/ui";

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

// ----------------------------------------------------------------------
// Scheduler Wrapper
// ----------------------------------------------------------------------

export interface SchedulerProps {
  title?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  participants?: string[];
  description?: string;
  activeColor?: string;
  error?: string | null;
  onClose?: (e: Event) => void;
  onSave?: (e: CustomEvent) => void;
  onDelete?: (e: CustomEvent) => void;
}

export const Scheduler: Component<SchedulerProps> = (props) => {
  let ref!: HTMLElement;

  createEffect(() => {
    if (ref) {
      const el = ref as unknown as Record<string, unknown>;
      if (props.title !== undefined) el.title = props.title;
      if (props.date !== undefined) el.date = props.date;
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
    if (!ref) return;
    const attach = (
      eventName: string,
      handler?: ((e: Event) => void) | ((e: CustomEvent) => void),
    ) => {
      if (handler) {
        const h = handler as (e: Event) => void;
        ref!.addEventListener(eventName, h);
        onCleanup(() => ref!.removeEventListener(eventName, h));
      }
    };
    attach("close", props.onClose);
    attach("save", props.onSave);
    attach("delete", props.onDelete);
  });

  return <janus-scheduler ref={ref} />;
};

// ----------------------------------------------------------------------
// Timeline Wrapper
// ----------------------------------------------------------------------

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
    if (!ref) return;
    const attach = (
      eventName: string,
      handler?:
        | ((e: Event) => void)
        | ((e: CustomEvent) => void)
        | ((e: CustomEvent<TimelineEvent>) => void),
    ) => {
      if (handler) {
        const h = handler as (e: Event) => void;
        ref!.addEventListener(eventName, h);
        onCleanup(() => ref!.removeEventListener(eventName, h));
      }
    };
    attach("event-click", props.onEventClick);
    attach("add-event", props.onAddEvent);
    attach("event-move", props.onEventMove);
    attach("event-resize", props.onEventResize);
    attach("event-create", props.onEventCreate);
    attach("view-change", props.onViewChange);
  });

  return <janus-timeline ref={ref} />;
};

// ----------------------------------------------------------------------
// MonthGrid Wrapper
// ----------------------------------------------------------------------

export interface MonthGridProps {
  onEventClick?: (e: CustomEvent<unknown>) => void;
  onDayClick?: (e: CustomEvent) => void;
  onAddEvent?: (e: Event) => void;
  onViewChange?: (e: CustomEvent) => void;
}

export const MonthGrid: Component<MonthGridProps> = (props) => {
  let ref!: HTMLElement;

  onMount(() => {
    if (!ref) return;
    const attach = (
      eventName: string,
      handler?:
        | ((e: Event) => void)
        | ((e: CustomEvent) => void)
        | ((e: CustomEvent<unknown>) => void),
    ) => {
      if (handler) {
        const h = handler as (e: Event) => void;
        ref!.addEventListener(eventName, h);
        onCleanup(() => ref!.removeEventListener(eventName, h));
      }
    };
    attach("event-click", props.onEventClick);
    attach("day-click", props.onDayClick);
    attach("add-event", props.onAddEvent);
    attach("view-change", props.onViewChange);
  });

  return <janus-month-grid ref={ref} />;
};
