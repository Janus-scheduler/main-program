<template>
  <div class="app-shell">
    <Sidebar />

    <main class="app-main">
      <SchedulerView
        :current-view="currentView"
        :show-scheduler="showScheduler"
        :scheduler-error="hookError ? hookError.message : null"
        :selected-event-id="selectedEventId"
        :manager="manager"
        @view-change="currentView = $event"
        @open-scheduler="openScheduler"
        @close-scheduler="closeScheduler"
      />

      <ErrorToast
        v-if="hookError"
        :operation="hookError.operation"
        :message="hookError.message"
        @dismiss="hookError = null"
      />
    </main>
  </div>
</template>

<script setup lang="ts">
/**
 * App — root component and state coordinator.
 *
 * Owns three pieces of UI state:
 *  - currentView    : which Janus view is active (Timeline | Month)
 *  - showScheduler  : whether the event editor modal is open
 *  - hookError      : the last async hook failure (triggers ErrorToast)
 *
 * Data state (events, resources, assignments) lives in the Zustand store
 * managed by SchedulerManager — not in Vue state at all.
 */
import { ref } from "vue";

import Sidebar from "./components/Sidebar.vue";
import SchedulerView from "./components/SchedulerView.vue";
import type { ViewType } from "./components/SchedulerView.vue";
import ErrorToast from "./components/ErrorToast.vue";
import {
  useSchedulerManager,
  type HookError,
} from "./composables/useSchedulerManager";

const currentView = ref<ViewType>("Month");
const showScheduler = ref(false);
const hookError = ref<HookError | null>(null);
const selectedEventId = ref<string | null>(null);

// Auto-dismiss the error toast after 6 seconds
function handleHookError(err: HookError) {
  hookError.value = err;
  setTimeout(() => {
    hookError.value = null;
  }, 6000);
}

const manager = useSchedulerManager(handleHookError);

function openScheduler(eventId?: string) {
  selectedEventId.value = eventId ?? null;
  showScheduler.value = true;
}

function closeScheduler() {
  showScheduler.value = false;
  selectedEventId.value = null;
}
</script>
