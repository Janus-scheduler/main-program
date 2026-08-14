<template>
  <!--
    SchedulerView — mounts the correct Janus web component based on currentView
    and wires all CustomEvent callbacks to SchedulerManager mutations.
    Functionally identical to React's SchedulerView.tsx and Angular's app.html.
  -->

  <div style="display: flex; flex-direction: row; height: 100%; width: 100%;">
    <div style="display: flex; flex-direction: column; flex: 1; min-width: 0; height: 100%;">
      <janus-topbar
    .navLabel="navData.navLabel"
    .dayName="navData.dayName"
    .shortDate="navData.shortDate"
    .view="currentView"
    .allowCreate="allowCreate"
    .zoomPercent="navData.zoomPercent"
    .zoomUnit="navData.zoomUnit"
    @prev-click="handlePrevClick"
    @next-click="handleNextClick"
    @today-click="handleTodayClick"
    @view-switch="handleViewChange"
    @toggle-create="handleToggleCreate"
  />

  <!-- Timeline view -->
  <janus-timeline
    v-if="currentView === 'Timeline'"
    ref="timelineEl"
    .allowCreate="allowCreate"
    @event-click="handleEventClick"
    @add-event="handleAddEvent"
    @event-move="handleEventMove"
    @event-resize="handleEventResize"
    @event-create="handleEventCreate"
    @view-change="handleViewChange"
    @nav-change="handleNavChange"
  />

  <!-- Month view -->
  <janus-month-grid
    v-if="currentView === 'Month'"
    ref="monthGridEl"
    @add-event="handleAddEvent"
    @event-click="handleEventClick"
    @view-change="handleViewChange"
    @nav-change="handleNavChange"
  />

  <!-- Scheduler modal -->
  <janus-scheduler
    v-if="showScheduler"
    .eventId="selectedEventId"
    .error="schedulerError"
    .title="storeEvent?.title"
    .startDate="startParts.date"
    .startTime="startParts.time"
    .endDate="endParts.date"
    .endTime="endParts.time"
    .participants="storeEvent?.resourceIds ? storeEvent.resourceIds : undefined"
    .description="storeEvent?.description"
    .activeColor="storeEvent?.color"
    .allDay="storeEvent?.allDay"
    .recurrenceRule="storeEvent?.recurrenceRule"
    @save="handleSave"
    @delete="handleDelete"
    @close="$emit('close-scheduler')"
  />

    </div>

    <div class="chat-sidebar">
      <div class="chat-sidebar__panel">
        <janus-chat
          .messages="chat.thread"
          :busy="chat.busy || engineState.status === 'loading'"
          :disabled="chat.busy || engineState.status === 'loading'"
          theme="light"
          show-close
          :placeholder="engineState.status === 'ready' ? 'Ask me to schedule something…' : 'Loading the language model…'"
          @chatSubmit="(e: CustomEvent) => chat.submit(e.detail.prompt)"
          @chatClarifyResponse="(e: CustomEvent) => chat.choose(e.detail.label)"
          @chatConfirm="chat.confirm"
          @chatUndo="(e: CustomEvent) => chat.undo(e.detail.messageId)"
          @chatEdit="chat.edit ? chat.edit() : chat.reset()"
        ></janus-chat>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, reactive } from "vue";
import { SchedulerManager } from "@janus-scheduler/core";
import type {
  EventMoveDetail,
  EventResizeDetail,
  EventCreateDetail,
  TimelineEvent,
  ViewType,
} from "@janus-scheduler/core";
import {
  isoToZonedDisplay,
  zonedInputToISO,
  schedulerStore,
} from "@janus-scheduler/core";

// Side-effect import: registers the custom elements
import "@janus-scheduler/ui";
import { useNlpEngine } from "../chat/useNlpEngine";
import { useJanusChat } from "../chat/useJanusChat";
import { catalogFromResources, commitSession } from "../chat/commitToScheduler";
import type { SessionRequirements, SessionState, PresentMessage } from "@janus-scheduler/nlp";

export type { ViewType };

const INTRO: PresentMessage = {
  id: "intro",
  role: "assistant",
  kind: "text",
  text: "Tell me what to schedule. I'll show you what I understood before anything is added.",
};

const REQUIRES: SessionRequirements = {
  add_event: ["when", "resource"],
  modify_event: ["when"],
};

const props = defineProps<{
  currentView: ViewType;
  showScheduler: boolean;
  schedulerError: string | null;
  selectedEventId: string | null;
  manager: SchedulerManager;
}>();

const engineState = useNlpEngine();
const catalog = computed(() => catalogFromResources(props.manager.getAllResources()));

const chatOptions = computed(() => ({
  engine: engineState.value.status === "ready" ? engineState.value.engine : null,
  catalog: catalog.value,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  intro: INTRO,
  requires: REQUIRES,
  fallbackResourceName: props.manager.getAllResources()[0]?.name,
  onConfirm: (state: SessionState) => {
    const resources = props.manager.getAllResources();
    const result = commitSession(props.manager, state, resources[0]?.id);
    return result.ok
      ? { ok: true, message: result.summary, undo: result.undo }
      : { ok: false, message: result.message };
  }
}));

const chat = useJanusChat(() => chatOptions.value);

const emit = defineEmits<{
  "view-change": [view: ViewType];
  "open-scheduler": [eventId?: string];
  "close-scheduler": [];
}>();

const storeEvent = computed(() =>
  props.selectedEventId ? props.manager.getEvent(props.selectedEventId) : null
);

const timelineEl = ref<any>(null);
const monthGridEl = ref<any>(null);

const allowCreate = ref(false);
const navData = reactive({
  navLabel: "",
  dayName: "",
  shortDate: "",
  zoomPercent: 100,
  zoomUnit: "",
});

function handleNavChange(e: Event) {
  const detail = (e as CustomEvent<any>).detail;
  navData.navLabel = detail.navLabel || "";
  navData.dayName = detail.dayName || "";
  navData.shortDate = detail.shortDate || "";
  navData.zoomPercent = detail.zoomPercent || 100;
  navData.zoomUnit = detail.zoomUnit || "";
}

function handlePrevClick() {
  if (props.currentView === "Timeline") {
    timelineEl.value?.goToPrev();
  } else {
    monthGridEl.value?.goToPrev();
  }
}

function handleNextClick() {
  if (props.currentView === "Timeline") {
    timelineEl.value?.goToNext();
  } else {
    monthGridEl.value?.goToNext();
  }
}

function handleTodayClick() {
  if (props.currentView === "Timeline") {
    timelineEl.value?.goToToday();
  } else {
    monthGridEl.value?.goToToday();
  }
}

function handleToggleCreate() {
  if (props.currentView === "Timeline") {
    timelineEl.value?.toggleCreate();
  }
  allowCreate.value = !allowCreate.value;
}

// Convert a UTC ISO string → local { date, time } using the store's selected timezone.
const splitISO = (iso: string | undefined) => {
  if (!iso) return { date: undefined, time: undefined };
  const { date, time } = isoToZonedDisplay(iso, schedulerStore.getState().timezone);
  return { date, time };
};

const startParts = computed(() => splitISO(storeEvent.value?.startTime));
const endParts = computed(() => splitISO(storeEvent.value?.endTime));

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
        startTime: zonedInputToISO(data.startDate || today, data.startTime, data.timezone),
        endTime: zonedInputToISO(data.endDate || today, data.endTime, data.timezone),
        resourceIds: data.participants || ["r1"],
        description: data.description,
        status: "confirmed",
        color: data.activeColor,
        allDay: data.allDay,
        recurrenceRule: data.recurrenceRule,
      });
    } else {
      props.manager.addEvent({
        id: `evt_${Date.now()}`,
        title: data.title,
        startTime: zonedInputToISO(data.startDate || today, data.startTime, data.timezone),
        endTime: zonedInputToISO(data.endDate || today, data.endTime, data.timezone),
        resourceIds: data.participants || ["r1"],
        description: data.description,
        status: "confirmed",
        color: data.activeColor,
        allDay: data.allDay,
        recurrenceRule: data.recurrenceRule,
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
  const { event, oldResourceId, newResourceId, newStartTime, newEndTime } = (
    e as CustomEvent<EventMoveDetail>
  ).detail;
  const currentEvent = props.manager.getEvent(event.id);
  if (!currentEvent) return;
  const updatedResourceIds = currentEvent.resourceIds.map(
    (id) => (id === oldResourceId ? newResourceId : id)
  );
  props.manager.updateEvent(event.id, {
    resourceIds: updatedResourceIds,
    startTime: newStartTime,
    endTime: newEndTime,
  });
}

// ── Timeline: drag-and-drop resize ──────────────────────────────────────
function handleEventResize(e: Event) {
  const { event, newStartTime, newEndTime } = (
    e as CustomEvent<EventResizeDetail>
  ).detail;
  props.manager.updateEvent(event.id, {
    startTime: newStartTime,
    endTime: newEndTime,
  });
}

// ── Timeline: drag-to-create ────────────────────────────────────────────
function handleEventCreate(e: Event) {
  const { resourceId, startTime, endTime } = (
    e as CustomEvent<EventCreateDetail>
  ).detail;
  props.manager.addEvent({
    id: `evt_${Date.now()}`,
    title: "New Event",
    startTime,
    endTime,
    resourceIds: [resourceId],
    status: "confirmed",
  });
}


</script>
