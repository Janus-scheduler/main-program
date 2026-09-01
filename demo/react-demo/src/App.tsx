import { useState, useCallback, useEffect } from "react";
import "./App.css";

import { Sidebar } from "./components/Sidebar";
import { SchedulerView } from "./components/SchedulerView";
import { ChatGallery } from "./components/ChatGallery";
import { ChatLive } from "./components/ChatLive";
import type { ViewType, UndoAction, EventDraft } from "@janus-scheduler/react";
import { ConfirmDialog, isoToZonedDisplay } from "@janus-scheduler/react";
import { ErrorToast } from "./components/ErrorToast";
import { useSchedulerManager } from "./hooks/useSchedulerManager";
import type { HookError } from "./hooks/useSchedulerManager";

/**
 * `?chat=1` — the <janus-chat> fixture gallery (Step 4, static data).
 * `?chat=live` — the real classifier driving a real conversation (Step 5).
 *
 * A URL flag rather than a route: the demo has no router, and this is
 * temporary scaffolding for reviewing the chat work on its own. Step 6 wires
 * the chat into the app proper and this branch goes away.
 */
function chatModeRequested(): "gallery" | "live" | null {
  const flag = new URLSearchParams(window.location.search).get("chat");
  if (flag === "1") return "gallery";
  if (flag === "live") return "live";
  return null;
}

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

  // ONE conflict policy, for every surface.
  //
  // true  = block a double-booking outright (timeline, modal AND chat)
  // false = allow it, with the timeline's warning banners
  //
  // This used to be false here while <Timeline> hard-coded `true`, so the
  // timeline refused a clashing drag and the chat cheerfully created one.
  // Three surfaces enforcing three different rules is not a policy.
  const preventConflicts = true;

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
      // Don't intercept Ctrl+Z when the user is typing in a form control
      // or contentEditable element — let the browser handle standard text undo.
      const tag = (document.activeElement?.tagName ?? "").toLowerCase();
      const isEditable =
        tag === "input" ||
        tag === "textarea" ||
        tag === "select" ||
        document.activeElement?.getAttribute("contenteditable") === "true";

      if (isEditable) return;

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
  const eventToEventDraft = (e: any, overrideTz?: string): EventDraft => {
    // Use the provided timezone, or fall back to the scheduler's configured
    // display timezone so the undo dialog matches what the calendar shows
    // (getTimezone defaults to the browser timezone if none was forced).
    const tz = overrideTz || manager.getTimezone();
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

    if (action.type === "batchAddEvents") {
      // Batch undo — show count of events that will be removed.
      // fromDraft shows a summary placeholder, toDraft is null (all deleted).
      const count = action.ids.length;
      return {
        fromDraft: {
          id: null,
          title: `${count} imported event${count !== 1 ? "s" : ""}`,
          startDate: "",
          startTime: "",
          endDate: "",
          endTime: "",
          participants: [],
          activeColor: "orange",
          allDay: false,
          description: "All events from this bulk import will be removed.",
          timezone: manager.getTimezone(),
        },
        toDraft: null,
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

  const getUndoDialogText = (
    type: string,
  ): { title: string; subtitle: string } => {
    if (type === "addEvent") {
      return {
        title: "Undo: Remove Event",
        subtitle: "This event will be permanently deleted.",
      };
    }
    if (type === "deleteEvent") {
      return {
        title: "Undo: Restore Event",
        subtitle: "This deleted event will be restored to the calendar.",
      };
    }
    if (type === "batchAddEvents") {
      return {
        title: "Undo: Remove Imported Events",
        subtitle:
          "All events from this bulk import will be removed from the calendar.",
      };
    }
    return {
      title: "Undo: Revert Changes",
      subtitle: "The event will revert to its previous state.",
    };
  };

  // Read once on mount — the flag cannot change without a reload.
  const [chatMode] = useState(chatModeRequested);

  if (chatMode === "gallery") return <ChatGallery />;
  if (chatMode === "live") return <ChatLive />;

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
            title={getUndoDialogText(undoConfirmAction.type).title}
            subtitle={getUndoDialogText(undoConfirmAction.type).subtitle}
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
