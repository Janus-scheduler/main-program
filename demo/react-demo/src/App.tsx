import { useState, useCallback, useEffect } from "react";
import "./App.css";

import { Sidebar } from "./components/Sidebar";
import { SchedulerView } from "./components/SchedulerView";
import type { ViewType } from "@janus-scheduler/react";
import { ErrorToast } from "./components/ErrorToast";
import { useSchedulerManager } from "./hooks/useSchedulerManager";
import type { HookError } from "./hooks/useSchedulerManager";
import {
  GoogleCalendarClient,
  GoogleWebSocketListener,
} from "@janus-scheduler/integrations";

const BACKEND_URL = "http://localhost:3001";

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
  const [googleConnected, setGoogleConnected] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("google_connected") === "true";
  });

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
  const manager = useSchedulerManager(handleHookError);

  // ── Handle OAuth callback redirect ──────────────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("google_connected");

    if (connected === "true") {
      const syncManager = window.__janusSyncManager;
      if (syncManager) syncManager.setConnected(true);
      // Clean URL
      window.history.replaceState({}, "", window.location.pathname);
    } else if (connected === "false") {
      console.error("[Janus] Google OAuth failed");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  // ── Load initial Google events and start WebSocket after connecting ─────────
  useEffect(() => {
    if (!googleConnected) return;

    const syncManager = window.__janusSyncManager;
    if (!syncManager) return;

    const client = new GoogleCalendarClient({ backendUrl: BACKEND_URL });

    // Load existing Google events into store, then push any local events
    // that were created before this connection existed (e.g. seed data) and
    // so never got a chance to sync.
    client
      .fetchInitialEvents()
      .then((events) => syncManager.loadInitialEvents(events))
      .then(() => syncManager.pushUnsyncedLocalEvents())
      .catch((err) => {
        console.error("[Janus] Failed to load initial Google events:", err);
      });

    // Start WebSocket listener for real-time Google → Janus updates
    const listener = new GoogleWebSocketListener(
      { backendUrl: BACKEND_URL },
      (message) => syncManager.handleGoogleChange(message),
    );
    listener.start();

    return () => listener.stop();
  }, [googleConnected]);

  // ── Check existing connection on mount ─────────────────────────────────────
  useEffect(() => {
    const client = new GoogleCalendarClient({ backendUrl: BACKEND_URL });
    client.isConnected().then((connected) => {
      if (connected) {
        setGoogleConnected(true);
        const syncManager = window.__janusSyncManager;
        if (syncManager) syncManager.setConnected(true);
      }
    });
  }, []);

  const handleGoogleConnect = () => {
    window.location.href = `${BACKEND_URL}/auth/google`;
  };

  const handleGoogleDisconnect = async () => {
    await fetch(`${BACKEND_URL}/auth/disconnect`, { method: "POST" });
    const syncManager = window.__janusSyncManager;
    if (syncManager) syncManager.setConnected(false);
    setGoogleConnected(false);
  };

  return (
    <div className="app-shell">
      <Sidebar />

      <main className="app-main">
        {/* Google Calendar connect button */}
        <div style={{ padding: "8px 16px" }}>
          {googleConnected ? (
            <button onClick={handleGoogleDisconnect}>
              Disconnect Google Calendar
            </button>
          ) : (
            <button onClick={handleGoogleConnect}>
              Connect Google Calendar
            </button>
          )}
        </div>

        <SchedulerView
          currentView={currentView}
          showScheduler={showScheduler}
          schedulerError={null}
          selectedEventId={selectedEventId}
          manager={manager}
          preventConflicts={preventConflicts}
          onViewChange={setCurrentView}
          onOpenScheduler={(eventId) => {
            setSelectedEventId(eventId ?? null);
            setShowScheduler(true);
          }}
          onCloseScheduler={() => {
            setShowScheduler(false);
            setSelectedEventId(null);
          }}
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
