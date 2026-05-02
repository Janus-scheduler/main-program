import { useCallback } from "react";
import { Timeline, MonthGrid, Scheduler } from "@janus-scheduler/react";

// ─── Why we import these types ────────────────────────────────────────────────
//
// The <Timeline> and <MonthGrid> components are Lit Web Components wrapped
// with @lit/react's createComponent(). When the user interacts with them
// (drags an event, resizes, draws a new one), the Web Component fires a
// native browser CustomEvent on the DOM.
//
// React's synthetic event system does NOT understand CustomEvents — it only
// knows about standard DOM events (click, input, etc.). So @lit/react passes
// the raw Event object to your callback prop.
//
// Without these types, TypeScript only knows the callback receives `Event`,
// and accessing `.detail` would be an error. By casting to
// `CustomEvent<EventMoveDetail>`, we tell TypeScript exactly what shape
// `.detail` has — giving us autocomplete and compile-time safety.
//
// EventMoveDetail   → { event, oldResourceId, newResourceId, newStartTime, newEndTime }
// EventResizeDetail → { event, resourceId, newStartTime, newEndTime }
// EventCreateDetail → { resourceId, startTime, endTime, date }
//
// These types originate in @janus-scheduler/ui (timeline-types.ts) and are
// re-exported from @janus-scheduler/react as a convenience so the host app
// has a single import point.
// ─────────────────────────────────────────────────────────────────────────────
import type {
  EventMoveDetail,
  EventResizeDetail,
  EventCreateDetail,
} from "@janus-scheduler/react";
import type { SchedulerManager } from "@janus-scheduler/react";

export type ViewType = "Timeline" | "Month";

interface SchedulerViewProps {
  /** Currently active view — controls which Janus component is mounted */
  currentView: ViewType;
  /** Whether to show the Scheduler modal */
  showScheduler: boolean;
  /** Inline error passed into the Scheduler modal (synchronous store errors) */
  schedulerError: string | null;
  /** The SchedulerManager instance — used to mutate store state */
  manager: SchedulerManager;
  onViewChange: (view: ViewType) => void;
  onOpenScheduler: () => void;
  onCloseScheduler: () => void;
}

/**
 * SchedulerView
 *
 * Mounts the correct Janus component based on `currentView` and wires all
 * event callbacks to `manager` mutations.
 *
 * This component is the bridge between the Web Component event system and
 * the SchedulerManager API:
 *
 *   User drags event
 *     → <janus-timeline> fires CustomEvent("event-move", { detail: EventMoveDetail })
 *     → @lit/react calls onEventMove(e: Event)
 *     → we cast e to CustomEvent<EventMoveDetail> to safely read .detail
 *     → we call manager.updateEvent() which writes to Zustand
 *     → Zustand notifies <janus-timeline> subscription
 *     → UI re-renders with the new position
 */
export function SchedulerView({
  currentView,
  showScheduler,
  schedulerError,
  manager,
  onViewChange,
  onOpenScheduler,
  onCloseScheduler,
}: SchedulerViewProps) {
  // ── Shared: open the modal ─────────────────────────────────────────────
  const handleAddEvent = useCallback(() => {
    onOpenScheduler();
  }, [onOpenScheduler]);

  const handleEventClick = useCallback(
    (_e: Event) => {
      console.log(_e);
      onOpenScheduler();
    },
    [onOpenScheduler],
  );

  // ── MonthGrid: view switch ─────────────────────────────────────────────
  const handleViewChange = useCallback(
    (e: Event) => {
      const view = (e as CustomEvent<{ view: ViewType }>).detail.view;
      onViewChange(view);
    },
    [onViewChange],
  );

  // ── Scheduler modal: save ──────────────────────────────────────────────
  // Reads the modal's form payload and calls manager.addEvent().
  // The onEventAdd hook (configured in useSchedulerManager) fires
  // asynchronously after this returns.
  const handleSave = useCallback(
    (e: Event) => {
      const data = (e as CustomEvent).detail;
      const today = new Date().toISOString().split("T")[0];
      try {
        manager.addEvent({
          id: `evt_${Date.now()}`,
          title: data.title,
          startTime: `${data.date || today}T${data.startTime}:00Z`,
          endTime: `${data.date || today}T${data.endTime}:00Z`,
          resourceId: data.participants?.[0] || "r1",
          description: data.description,
          status: "confirmed",
        });
        onCloseScheduler();
      } catch (err: unknown) {
        // Synchronous store validation errors surface here (e.g. startTime > endTime).
        // Async hook failures go through onError in useSchedulerManager instead.
        console.error("Store rejected the event:", err);
      }
    },
    [manager, onCloseScheduler],
  );

  const handleDelete = useCallback(
    (e: Event) => {
      const { id } = (e as CustomEvent).detail;
      if (id) manager.deleteEvent(id);
      onCloseScheduler();
    },
    [manager, onCloseScheduler],
  );

  // ── Timeline: drag-and-drop ────────────────────────────────────────────
  //
  // All three callbacks below follow the same pattern:
  //   1. Cast `e` (raw DOM Event) → CustomEvent<SpecificDetailType>
  //   2. Destructure .detail to get typed fields
  //   3. Convert "HH:MM" time strings → full ISO 8601 timestamps
  //      (the Web Component works with display times; the store needs ISO)
  //   4. Call manager.updateEvent() / manager.addEvent()

  const handleEventMove = useCallback(
    (e: Event) => {
      const { event, newResourceId, newStartTime, newEndTime } = (
        e as CustomEvent<EventMoveDetail>
      ).detail;
      const today = event.date || new Date().toISOString().split("T")[0];
      manager.updateEvent(event.id, {
        resourceId: newResourceId,
        startTime: `${today}T${newStartTime}:00Z`,
        endTime: `${today}T${newEndTime}:00Z`,
      });
    },
    [manager],
  );

  const handleEventResize = useCallback(
    (e: Event) => {
      const { event, newStartTime, newEndTime } = (
        e as CustomEvent<EventResizeDetail>
      ).detail;
      const today = event.date || new Date().toISOString().split("T")[0];
      manager.updateEvent(event.id, {
        startTime: `${today}T${newStartTime}:00Z`,
        endTime: `${today}T${newEndTime}:00Z`,
      });
    },
    [manager],
  );

  const handleEventCreate = useCallback(
    (e: Event) => {
      const { resourceId, startTime, endTime, date } = (
        e as CustomEvent<EventCreateDetail>
      ).detail;
      const today = date || new Date().toISOString().split("T")[0];
      manager.addEvent({
        id: `evt_${Date.now()}`,
        title: "New Event",
        startTime: `${today}T${startTime}:00Z`,
        endTime: `${today}T${endTime}:00Z`,
        resourceId,
        status: "confirmed",
      });
    },
    [manager],
  );

  return (
    <>
      {currentView === "Timeline" && (
        <Timeline
          onAddEvent={handleAddEvent}
          onEventClick={handleEventClick}
          onEventMove={handleEventMove}
          onEventResize={handleEventResize}
          onEventCreate={handleEventCreate}
        />
      )}

      {currentView === "Month" && (
        <MonthGrid
          onAddEvent={handleAddEvent}
          onEventClick={handleEventClick}
          onViewChange={handleViewChange}
        />
      )}

      {showScheduler && (
        <Scheduler
          error={schedulerError}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={onCloseScheduler}
        />
      )}
    </>
  );
}
