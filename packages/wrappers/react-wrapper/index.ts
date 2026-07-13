import React from "react";
import { createComponent } from "@lit/react";
import {
  JanusScheduler as JanusSchedulerWC,
  JanusTimeline as JanusTimelineWC,
  JanusMonthGrid as JanusMonthGridWC,
  JanusAiBar as JanusAiBarWC,
} from "@janus-scheduler/ui";

// ─────────────────────────────────────────────────────────────────────────────
// Re-export core API so React consumers can import everything from one package:
//   import { Timeline, SchedulerManager, SchedulerHooks } from '@janus-scheduler/react'
// ─────────────────────────────────────────────────────────────────────────────
export {
  SchedulerManager,
  getBrowserTimezone,
  isoToZonedDisplay,
  zonedInputToISO,
  schedulerStore,
} from "@janus-scheduler/core";

import type {
  SchedulerHooks,
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

export type {
  SchedulerHooks,
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

// ─────────────────────────────────────────────────────────────────────────────
// Re-export UI event-detail types so the host app can type its callbacks
// without importing from @janus-scheduler/ui directly.
// ─────────────────────────────────────────────────────────────────────────────

export { Event, Resource, Assignment } from "@janus-scheduler/core";

// ─────────────────────────────────────────────────────────────────────────────
// Web Component → React bindings
//
// The Lit @customElement decorator auto-registers the web components when the
// module is imported — no manual customElements.define() is needed.
//
// We internally use `@lit/react` to map the custom elements to React, and then
// we wrap those in functional components to "unwrap" the CustomEvent objects.
// This allows the React consumer to receive the pure data payload rather than
// having to access `e.detail`.
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
      ? (e: Event) =>
          props.onSave!((e as CustomEvent<SchedulerSaveData>).detail)
      : undefined,
    onDelete: props.onDelete
      ? (e: Event) =>
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
    onConflictDetected: "conflict-detected",
  },
});

export interface TimelineProps extends React.HTMLAttributes<HTMLElement> {
  resources?: TimelineResource[];
  view?: "Timeline" | "Month";
  currentDate?: Date;
  aiPrompt?: string;
  preventConflicts?: boolean;
  onEventClick?: (detail: TimelineEvent) => void;
  onEventMove?: (detail: EventMoveDetail) => void;
  onEventResize?: (detail: EventResizeDetail) => void;
  onEventCreate?: (detail: EventCreateDetail) => void;
  onAddEvent?: () => void;
  onViewChange?: (detail: { view: "Timeline" | "Month" }) => void;
  onConflictDetected?: (detail: {
    message: string;
    action: string;
    detail: any;
  }) => void;
}

function withConflictBypass<T>(
  prevent: boolean | undefined,
  callback?: (detail: T) => void,
) {
  if (!callback) return undefined;
  return (e: Event) => {
    const detail = (e as CustomEvent).detail;
    if (prevent && detail?.hasConflict) {
      return;
    }
    callback(detail);
  };
}

export function Timeline(props: TimelineProps): React.JSX.Element {
  return React.createElement(_Timeline, {
    ...props,
    onConflictDetected: props.onConflictDetected
      ? (e: Event) => props.onConflictDetected!((e as CustomEvent).detail)
      : undefined,
    onEventClick: props.onEventClick
      ? (e: Event) =>
          props.onEventClick!((e as CustomEvent<TimelineEvent>).detail)
      : undefined,
    onEventMove: withConflictBypass(props.preventConflicts, props.onEventMove),
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
      ? (e: Event) =>
          props.onViewChange!(
            (e as CustomEvent<{ view: "Timeline" | "Month" }>).detail,
          )
      : undefined,
  });
}

const _MonthGrid = createComponent({
  tagName: "janus-month-grid",
  elementClass: JanusMonthGridWC,
  react: React,
  events: {
    onEventClick: "event-click",
    onDayClick: "day-click",
    onAddEvent: "add-event",
    onViewChange: "view-change",
  },
});

export interface MonthGridProps extends React.HTMLAttributes<HTMLElement> {
  onEventClick?: (detail: TimelineEvent) => void;
  onDayClick?: (detail: { date: string }) => void;
  onAddEvent?: () => void;
  onViewChange?: (detail: { view: "Timeline" | "Month" }) => void;
}

export function MonthGrid(props: MonthGridProps): React.JSX.Element {
  return React.createElement(_MonthGrid, {
    ...props,
    onEventClick: props.onEventClick
      ? (e: Event) =>
          props.onEventClick!((e as CustomEvent<TimelineEvent>).detail)
      : undefined,
    onDayClick: props.onDayClick
      ? (e: Event) =>
          props.onDayClick!((e as CustomEvent<{ date: string }>).detail)
      : undefined,
    onAddEvent: props.onAddEvent ? () => props.onAddEvent!() : undefined,
    onViewChange: props.onViewChange
      ? (e: Event) =>
          props.onViewChange!(
            (e as CustomEvent<{ view: "Timeline" | "Month" }>).detail,
          )
      : undefined,
  });
}

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
      ? (e: Event) =>
          props.onAiSubmit!((e as CustomEvent<{ prompt: string }>).detail)
      : undefined,
    onAiInput: props.onAiInput
      ? (e: Event) =>
          props.onAiInput!((e as CustomEvent<{ prompt: string }>).detail)
      : undefined,
  });
}
