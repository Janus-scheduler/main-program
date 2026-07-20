import { useState, useCallback, useEffect } from "react";
import "./App.css";

import { Sidebar } from "./components/Sidebar";
import { SchedulerView } from "./components/SchedulerView";
import type { ViewType, UndoAction, EventDraft } from "@janus-scheduler/react";
import { ConfirmDialog, isoToZonedDisplay } from "@janus-scheduler/react";
import { ErrorToast } from "./components/ErrorToast";
import { useSchedulerManager } from "./hooks/useSchedulerManager";
import type { HookError } from "./hooks/useSchedulerManager";

const getUndoTitle = (type: string) => {
  switch (type) {
    case "addEvent":
      return "Undo: Remove Event";
    case "deleteEvent":
      return "Undo: Restore Event";
    default:
      return "Undo: Revert Changes";
  }
};

const getUndoSubtitle = (type: string) => {
  switch (type) {
    case "addEvent":
      return "This event will be permanently deleted.";
    case "deleteEvent":
      return "This deleted event will be restored to the calendar.";
    default:
      return "The event will revert to its previous state.";
  }
};

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const eventToEventDraft = (e: any): EventDraft => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const startObj = e.startTime
      ? isoToZonedDisplay(e.startTime, tz)
      : { date: "", time: "" };
    const endObj = e.endTime
      ? isoToZonedDisplay(e.endTime, tz)
      : { date: "", time: "" };

    return {
      id: e.id || null,
      title: e.title || "",
      startDate: startObj.date,
      startTime: startObj.time,
      endDate: endObj.date,
      endTime: endObj.time,
      participants: e.resourceIds || (e.resourceId ? [e.resourceId] : []),
      activeColor: e.color || "orange",
      allDay: e.allDay || false,
      description: e.description || "",
      timezone: tz,
    };
  };

  const getUndoFromTo = (
    action: UndoAction | null,
  ): { fromDraft: EventDraft | null; toDraft: EventDraft | null } => {
    if (!action) return { fromDraft: null, toDraft: null };

    if (action.type === "addEvent") {
      // The event currently EXISTS → it will be DELETED after undo
      const current = manager.getEvent(action.id);
      return {
        fromDraft: current ? eventToEventDraft(current) : null,
        toDraft: null,
      };
    }

    if (action.type === "deleteEvent") {
      // The event currently DOESN'T EXIST → it will be RESTORED after undo
      return {
        fromDraft: null,
        toDraft: eventToEventDraft(action.previous),
      };
    }

    // updateEvent — show the current state vs. what it will revert to
    const current = manager.getEvent(action.id);
    return {
      fromDraft: current ? eventToEventDraft(current) : null,
      toDraft: current
        ? eventToEventDraft({ ...current, ...action.previous })
        : null,
    };
  };

  const { fromDraft: undoFromDraft, toDraft: undoToDraft } =
    getUndoFromTo(undoConfirmAction);

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

        {undoConfirmAction && (undoFromDraft || undoToDraft) && (
          <ConfirmDialog
            title={getUndoTitle(undoConfirmAction.type)}
            subtitle={getUndoSubtitle(undoConfirmAction.type)}
            confirmText="Undo"
            cancelText="Cancel"
            accentColor="orange"
            fromDraft={undoFromDraft}
            toDraft={undoToDraft}
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
