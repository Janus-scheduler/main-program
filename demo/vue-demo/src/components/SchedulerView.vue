<template>
  <!--
    SchedulerView — mounts the correct Janus web component based on currentView
    and wires all CustomEvent callbacks to SchedulerManager mutations.
    Functionally identical to React's SchedulerView.tsx and Angular's app.html.
  -->

  <!-- Timeline view -->
  <janus-timeline
    v-if="currentView === 'Timeline'"
    @event-click="handleEventClick"
    @add-event="handleAddEvent"
    @event-move="handleEventMove"
    @event-resize="handleEventResize"
    @event-create="handleEventCreate"
    @view-change="handleViewChange"
  />

  <!-- Month view -->
  <janus-month-grid
    v-if="currentView === 'Month'"
    @add-event="handleAddEvent"
    @event-click="handleEventClick"
    @view-change="handleViewChange"
  />

  <!-- Scheduler modal -->
  <janus-scheduler
    v-if="showScheduler"
    :event-id="selectedEventId"
    :error="schedulerError"
    @save="handleSave"
    @delete="handleDelete"
    @close="$emit('close-scheduler')"
  />
</template>

<script setup lang="ts">
import { SchedulerManager } from "@janus-scheduler/core";
import type {
  EventMoveDetail,
  EventResizeDetail,
  EventCreateDetail,
  TimelineEvent,
} from "@janus-scheduler/ui";

// Side-effect import: registers the custom elements
import "@janus-scheduler/ui";

export type ViewType = "Timeline" | "Month";

const props = defineProps<{
  currentView: ViewType;
  showScheduler: boolean;
  schedulerError: string | null;
  selectedEventId: string | null;
  manager: SchedulerManager;
}>();

const emit = defineEmits<{
  "view-change": [view: ViewType];
  "open-scheduler": [eventId?: string];
  "close-scheduler": [];
}>();

// ── Open modal for NEW event (FAB / + button) ────────────────────────────
function handleAddEvent() {
  emit("open-scheduler"); // no eventId → create mode
}

// ── Open modal for EXISTING event (click on an event chip) ───────────────
function handleEventClick(e: Event) {
  const ev = (e as CustomEvent<TimelineEvent>).detail;
  emit("open-scheduler", ev?.id); // string → edit mode
}

// ── View switch ─────────────────────────────────────────────────────────
function handleViewChange(e: Event) {
  const view = (e as CustomEvent<{ view: ViewType }>).detail.view;
  emit("view-change", view);
}

// ── Scheduler modal: save ───────────────────────────────────────────────
function handleSave(e: Event) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (e as CustomEvent<any>).detail;
  const today = new Date().toISOString().split("T")[0];
  try {
    if (data.id) {
      props.manager.updateEvent(data.id, {
        title: data.title,
        startTime: `${data.date || today}T${data.startTime}:00Z`,
        endTime: `${data.date || today}T${data.endTime}:00Z`,
        resourceId: data.participants?.[0] || "r1",
        description: data.description,
        status: "confirmed",
      });
    } else {
      props.manager.addEvent({
        id: `evt_${Date.now()}`,
        title: data.title,
        startTime: `${data.date || today}T${data.startTime}:00Z`,
        endTime: `${data.date || today}T${data.endTime}:00Z`,
        resourceId: data.participants?.[0] || "r1",
        description: data.description,
        status: "confirmed",
      });
    }
    emit("close-scheduler");
  } catch (err: unknown) {
    console.error("Store rejected the event:", err);
  }
}

// ── Scheduler modal: delete ─────────────────────────────────────────────
function handleDelete(e: Event) {
  const { id } = (e as CustomEvent<{ id: string | null; title: string }>)
    .detail;
  if (id) props.manager.deleteEvent(id);
  emit("close-scheduler");
}

// ── Timeline: drag-and-drop move ────────────────────────────────────────
function handleEventMove(e: Event) {
  const { event, newResourceId, newStartTime, newEndTime } = (
    e as CustomEvent<EventMoveDetail>
  ).detail;
  const today = event.date || new Date().toISOString().split("T")[0];
  props.manager.updateEvent(event.id, {
    resourceId: newResourceId,
    startTime: `${today}T${newStartTime}:00Z`,
    endTime: `${today}T${newEndTime}:00Z`,
  });
}

// ── Timeline: drag-and-drop resize ──────────────────────────────────────
function handleEventResize(e: Event) {
  const { event, newStartTime, newEndTime } = (
    e as CustomEvent<EventResizeDetail>
  ).detail;
  const today = event.date || new Date().toISOString().split("T")[0];
  props.manager.updateEvent(event.id, {
    startTime: `${today}T${newStartTime}:00Z`,
    endTime: `${today}T${newEndTime}:00Z`,
  });
}

// ── Timeline: drag-to-create ────────────────────────────────────────────
function handleEventCreate(e: Event) {
  const { resourceId, startTime, endTime, date } = (
    e as CustomEvent<EventCreateDetail>
  ).detail;
  const today = date || new Date().toISOString().split("T")[0];
  props.manager.addEvent({
    id: `evt_${Date.now()}`,
    title: "New Event",
    startTime: `${today}T${startTime}:00Z`,
    endTime: `${today}T${endTime}:00Z`,
    resourceId,
    status: "confirmed",
  });
}
</script>
