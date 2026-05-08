import React from "react";
import { createComponent } from "@lit/react";
import {
  JanusScheduler as JanusSchedulerWC,
  JanusTimeline as JanusTimelineWC,
  JanusMonthGrid as JanusMonthGridWC,
} from "@janus-scheduler/ui";

// ─────────────────────────────────────────────────────────────────────────────
// Re-export core API so React consumers can import everything from one package:
//   import { Timeline, SchedulerManager, SchedulerHooks } from '@janus-scheduler/react'
// ─────────────────────────────────────────────────────────────────────────────
export { SchedulerManager } from "@janus-scheduler/core";
export type { SchedulerHooks } from "@janus-scheduler/core";

// ─────────────────────────────────────────────────────────────────────────────
// Re-export UI event-detail types so the host app can type its callbacks
// without importing from @janus-scheduler/ui directly.
//
// Usage:
//   const handleMove = (e: CustomEvent<EventMoveDetail>) => { ... }
// ─────────────────────────────────────────────────────────────────────────────
export type {
  TimelineEvent,
  TimelineResource,
  EventMoveDetail,
  EventResizeDetail,
  EventCreateDetail,
} from "@janus-scheduler/ui";

// Scheduler modal save-data shape (matches what the <janus-scheduler> "save" event emits)
export interface SchedulerSaveData {
  /** Present when editing an existing event; null/undefined when creating a new one. */
  id: string | null;
  title: string;
  date: string;
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
  participants: string[];
  description: string;
  activeColor: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Web Component → React bindings
//
// The Lit @customElement decorator auto-registers the web components when the
// module is imported — no manual customElements.define() is needed.
//
// Each `events` map converts a Web Component CustomEvent name to its
// React prop name. The host receives a native CustomEvent; use `.detail`
// to access the typed payload.
//
// Example:
//   <Timeline
//     onEventMove={(e: CustomEvent<EventMoveDetail>) => manager.updateEvent(...)}
//     onEventCreate={(e: CustomEvent<EventCreateDetail>) => manager.addEvent(...)}
//   />
// ─────────────────────────────────────────────────────────────────────────────

/**
 * <Scheduler> — Modal form for creating or editing a single event.
 *
 * Props:
 *  - eventId  — string | null. Pass the event's ID when opening in edit mode;
 *               omit or pass null for create mode.
 *
 * Events:
 *  - onSave   → CustomEvent<SchedulerSaveData>             — user submitted the form
 *                 detail.id is null (create) or the event ID (edit)
 *  - onDelete → CustomEvent<{ id: string | null; title: string }> — user clicked Delete
 *  - onClose  → CustomEvent<void>                          — user dismissed the modal
 */
export const Scheduler = createComponent({
  tagName: "janus-scheduler",
  elementClass: JanusSchedulerWC,
  react: React,
  events: {
    onClose: "close",
    onSave: "save",
    onDelete: "delete",
  },
});

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
export const Timeline = createComponent({
  tagName: "janus-timeline",
  elementClass: JanusTimelineWC,
  react: React,
  events: {
    onEventClick: "event-click",
    onViewChange: "view-change",
    onEventMove: "event-move",
    onEventResize: "event-resize",
    onEventCreate: "event-create",
    onAddEvent: "add-event",
  },
});

/**
 * <MonthGrid> — Monthly calendar view showing event chips per day.
 *
 * Events:
 *  - onEventClick → CustomEvent<TimelineEvent>        — user clicked an event chip
 *  - onDayClick   → CustomEvent<{ date: string }>     — user clicked an empty day cell
 *  - onAddEvent   → CustomEvent<void>                 — user clicked the + FAB
 *  - onViewChange → CustomEvent<{ view: "Timeline" | "Month" }> — user switched views
 *
 * The component reads directly from the Zustand store.
 */
export const MonthGrid = createComponent({
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
