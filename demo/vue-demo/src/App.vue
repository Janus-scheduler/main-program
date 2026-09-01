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
        :is-google-calendar-connected="googleConnected"
        @view-change="currentView = $event"
        @open-scheduler="openScheduler"
        @close-scheduler="closeScheduler"
        @connect-calendar="handleConnectCalendar"
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
import { ref, onMounted, onUnmounted, watch } from "vue";

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
const googleConnected = ref(false);

// Auto-dismiss the error toast after 6 seconds
function handleHookError(err: HookError) {
  hookError.value = err;
  setTimeout(() => {
    hookError.value = null;
  }, 6000);
}

const { manager, syncManager } = useSchedulerManager(handleHookError);

// ── Detect OAuth redirect / pick up an already-connected backend ────────────
// handleOAuthRedirect() detects `?google_connected=true|false` (present right
// after the OAuth callback) and cleans the URL; onStatusChange fires
// immediately with whatever status that just set (or false, if none), then
// again on every future change; refreshStatus() asks the backend directly,
// covering a plain reload with no redirect in progress but an
// already-connected backend from an earlier session.
let unsubscribeGoogleStatus: (() => void) | undefined;

onMounted(() => {
  syncManager.handleOAuthRedirect();
  unsubscribeGoogleStatus = syncManager.onStatusChange((connected) => {
    googleConnected.value = connected;
  });
  syncManager.refreshStatus();
});

onUnmounted(() => {
  unsubscribeGoogleStatus?.();
});

// ── Start real-time sync after connecting ───────────────────────────────────
// startRealtimeSync() owns the fetch→load→push sequencing and the WebSocket
// lifecycle; this watcher just decides *when* (connected) and owns cleanup
// timing. `cancelled` guards against the watcher's cleanup running (unmount,
// or googleConnected flipping again) before the async startRealtimeSync()
// call resolves — without it, a fast disconnect/reconnect could leak a
// WebSocket from a stale connection.
watch(
  googleConnected,
  (connected, _prev, onCleanup) => {
    if (!connected) return;

    let cancelled = false;
    let stop: (() => void) | undefined;

    syncManager.startRealtimeSync().then((stopFn) => {
      if (cancelled) {
        stopFn();
      } else {
        stop = stopFn;
      }
    });

    onCleanup(() => {
      cancelled = true;
      stop?.();
    });
  },
  { immediate: true },
);

function handleConnectCalendar() {
  if (googleConnected.value) {
    // disconnect() calls setConnected(false) internally, which broadcasts
    // to the onStatusChange subscription above — no need to set it here too.
    syncManager.disconnect();
  } else {
    syncManager.connect();
  }
}

function openScheduler(eventId?: string) {
  selectedEventId.value = eventId ?? null;
  showScheduler.value = true;
}

function closeScheduler() {
  showScheduler.value = false;
  selectedEventId.value = null;
}
</script>
