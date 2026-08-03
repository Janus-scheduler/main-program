import { useState, useCallback, useEffect } from "react";
import "./App.css";

import { Sidebar } from "./components/Sidebar";
import { SchedulerView } from "./components/SchedulerView";
import type { ViewType } from "@janus-scheduler/react";
import { ErrorToast } from "./components/ErrorToast";
import { useSchedulerManager } from "./hooks/useSchedulerManager";
import type { HookError } from "./hooks/useSchedulerManager";

/**
 * App — root component and state coordinator.
 *
 * Owns three pieces of UI state:
 *  - currentView    : which Janus view is active (Timeline | Month)
 *  - showScheduler  : whether the event editor modal is open
 *  - hookError      : the last async hook failure (triggers ErrorToast)
 *
 * Data state (events, resources, assignments) lives in the Zustand store
 * managed by SchedulerManager — not in React state at all.
 */
function App() {
  const [currentView, setCurrentView] = useState<ViewType>("Month");
  const [showScheduler, setShowScheduler] = useState(false);
  const [hookError, setHookError] = useState<HookError | null>(null);
  const [googleConnected, setGoogleConnected] = useState(false);

  // Set to true to strictly block resource scheduling conflicts, or false to allow double-booking with visual warning banners.
  const preventConflicts = false;

  // null = creating a new event; string = editing the event with this ID
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  // Auto-dismiss the error toast after 6 seconds
  const handleHookError = useCallback((err: HookError) => {
    setHookError(err);
    setTimeout(() => setHookError(null), 6000);
  }, []);

  // SchedulerManager is stable (created once via useMemo inside the hook)
  const { manager, syncManager } = useSchedulerManager(handleHookError);

  // ── Detect OAuth redirect / pick up an already-connected backend ────────────
  // handleOAuthRedirect() detects `?google_connected=true|false` (present
  // right after the OAuth callback) and cleans the URL; onStatusChange fires
  // immediately with whatever status that just set (or false, if none), then
  // again on every future change; refreshStatus() asks the backend directly,
  // covering a plain reload with no redirect in progress but an
  // already-connected backend from an earlier session.
  useEffect(() => {
    syncManager.handleOAuthRedirect();
    const unsubscribe = syncManager.onStatusChange(setGoogleConnected);
    syncManager.refreshStatus();
    return unsubscribe;
  }, [syncManager]);

  // ── Start real-time sync after connecting ───────────────────────────────────
  // startRealtimeSync() owns the fetch→load→push sequencing and the
  // WebSocket lifecycle; this effect just decides *when* (connected) and
  // owns React's cleanup timing. `cancelled` guards against the effect
  // tearing down (unmount, or googleConnected flipping again) before the
  // async startRealtimeSync() call resolves — without it, a fast
  // disconnect/reconnect could leak a WebSocket from a stale connection.
  useEffect(() => {
    if (!googleConnected) return;

    let cancelled = false;
    let stop: (() => void) | undefined;

    syncManager.startRealtimeSync().then((stopFn) => {
      if (cancelled) {
        stopFn();
      } else {
        stop = stopFn;
      }
    });

    return () => {
      cancelled = true;
      stop?.();
    };
  }, [googleConnected, syncManager]);

  const handleConnectCalendar = () => {
    if (googleConnected) {
      // disconnect() calls setConnected(false) internally, which broadcasts
      // to the onStatusChange subscription above — no need to set it here too.
      syncManager.disconnect();
    } else {
      syncManager.connect();
    }
  };

  return (
    <div className="app-shell">
      <Sidebar />

      <main className="app-main">
        <SchedulerView
          currentView={currentView}
          showScheduler={showScheduler}
          schedulerError={null}
          selectedEventId={selectedEventId}
          manager={manager}
          preventConflicts={preventConflicts}
          isGoogleCalendarConnected={googleConnected}
          onViewChange={setCurrentView}
          onOpenScheduler={(eventId) => {
            setSelectedEventId(eventId ?? null);
            setShowScheduler(true);
          }}
          onCloseScheduler={() => {
            setShowScheduler(false);
            setSelectedEventId(null);
          }}
          onConnectCalendar={handleConnectCalendar}
        />

        {hookError && (
          <ErrorToast
            operation={hookError.operation}
            message={hookError.message}
            onDismiss={() => setHookError(null)}
          />
        )}
      </main>
    </div>
  );
}

export default App;
