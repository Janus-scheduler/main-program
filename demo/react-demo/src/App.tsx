import { useState, useCallback, useEffect } from "react";
import "./App.css";

import { Sidebar } from "./components/Sidebar";
import { SchedulerView } from "./components/SchedulerView";
import type { ViewType, UndoAction, EventDraft } from "@janus-scheduler/react";
import { ConfirmDialog } from "@janus-scheduler/react";
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
  const [undoConfirmAction, setUndoConfirmAction] = useState<UndoAction | null>(
    null,
  );

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
  const { manager, syncBulkEvents, canUndo } =
    useSchedulerManager(handleHookError);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "z") {
        e.preventDefault();
        const action = manager.peekUndo();
        if (action) {
          setUndoConfirmAction(action);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [manager]);

  const handleUndoRequest = () => {
    const action = manager.peekUndo();
    if (action) setUndoConfirmAction(action);
  };

  const getUndoDraft = (action: UndoAction | null): EventDraft | null => {
    if (!action) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let baseData: any = null;

    if (action.type === "addEvent") {
      baseData = manager.getEvent(action.id);
    } else if (action.type === "deleteEvent") {
      baseData = action.previous;
    } else if (action.type === "updateEvent") {
      const current = manager.getEvent(action.id);
      baseData = { ...current, ...action.previous };
    }

    if (!baseData) return null;

    const startParts = baseData.startTime
      ? baseData.startTime.split("T")
      : ["", ""];
    const endParts = baseData.endTime ? baseData.endTime.split("T") : ["", ""];

    return {
      title: baseData.title || "",
      startDate: startParts[0] || "",
      startTime: startParts[1] ? startParts[1].slice(0, 5) : "",
      endDate: endParts[0] || "",
      endTime: endParts[1] ? endParts[1].slice(0, 5) : "",
      participants:
        baseData.resourceIds ||
        (baseData.resourceId ? [baseData.resourceId] : []),
      activeColor: baseData.color,
      allDay: baseData.allDay,
      description: baseData.description,
    };
  };

  const undoDraft = getUndoDraft(undoConfirmAction);

  return (
    <div className="app-shell">
      <Sidebar onSync={syncBulkEvents} />

      <main className="app-main">
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
          canUndo={canUndo}
          onUndo={handleUndoRequest}
        />

        {hookError && (
          <ErrorToast
            operation={hookError.operation}
            message={hookError.message}
            onDismiss={() => setHookError(null)}
          />
        )}

        {undoConfirmAction && undoDraft && (
          <ConfirmDialog
            title="Undo Action"
            subtitle={
              undoConfirmAction.type === "addEvent"
                ? "Are you sure you want to undo creating this event? It will be deleted."
                : undoConfirmAction.type === "deleteEvent"
                  ? "Are you sure you want to undo deleting this event? It will be restored."
                  : "Are you sure you want to undo updating this event? It will be reverted to its previous state."
            }
            confirmText="Undo"
            cancelText="Cancel"
            accentColor="orange"
            draft={undoDraft}
            onConfirm={() => {
              manager.undo();
              setUndoConfirmAction(null);
            }}
            onCancel={() => setUndoConfirmAction(null)}
          />
        )}
      </main>
    </div>
  );
}

export default App;
