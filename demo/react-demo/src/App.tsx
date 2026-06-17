import { useState, useCallback } from "react";
import "./App.css";

import { Sidebar } from "./components/Sidebar";
import { MobileHeader, MobileBottomNav } from "./components/MobileShell";
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
  // null = creating a new event; string = editing the event with this ID
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  // Auto-dismiss the error toast after 6 seconds
  const handleHookError = useCallback((err: HookError) => {
    setHookError(err);
    setTimeout(() => setHookError(null), 6000);
  }, []);

  // SchedulerManager is stable (created once via useMemo inside the hook)
  const manager = useSchedulerManager(handleHookError);

  return (
    <div className="app-shell">
      <Sidebar />

      <main className="app-main">
        <MobileHeader />

        <SchedulerView
          currentView={currentView}
          showScheduler={showScheduler}
          schedulerError={null}
          selectedEventId={selectedEventId}
          manager={manager}
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

        <MobileBottomNav />
      </main>
    </div>
  );
}

export default App;
