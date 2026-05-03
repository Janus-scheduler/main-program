import { useCallback } from "react";
import { Timeline, MonthGrid, Scheduler } from "@janus-scheduler/react";
import type {
  EventMoveDetail,
  EventResizeDetail,
  EventCreateDetail,
  TimelineEvent,
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
  /**
   * ID of the event being edited, or null when creating a new one.
   * Forwarded to <Scheduler eventId> so the web component can include it
   * in its onSave / onDelete payloads.
   */
  selectedEventId: string | null;
  /** The SchedulerManager instance — used to mutate store state */
  manager: SchedulerManager;
  /**
   * @param eventId - string when opening in edit mode (event was clicked),
   *                  undefined/null when opening in create mode (FAB was clicked).
   */
  onViewChange: (view: ViewType) => void;
  onOpenScheduler: (eventId?: string) => void;
  onCloseScheduler: () => void;
}

/**
 * SchedulerView
 *
 * Mounts the correct Janus component based on `currentView` and wires all
 * event callbacks to `manager` mutations.
 *
 * Event flow for a drag-and-drop move:
 *   User drags event
 *     → <janus-timeline> fires CustomEvent("event-move", { detail: EventMoveDetail })
 *     → @lit/react calls onEventMove(e: Event)
 *     → we cast e to CustomEvent<EventMoveDetail> to safely read .detail
 *     → we call manager.updateEvent() which writes to Zustand
 *     → Zustand notifies <janus-timeline> subscription
 *     → UI re-renders with the new position
 *
 * Event flow for delete:
 *   User clicks Delete in the Scheduler modal
 *     → <janus-scheduler> fires CustomEvent("delete", { detail: { id, title } })
 *     → handleDelete reads detail.id (the eventId passed via the eventId prop)
 *     → manager.deleteEvent(id) removes it from the store
 */
export function SchedulerView({
  currentView,
  showScheduler,
  schedulerError,
  selectedEventId,
  manager,
  onViewChange,
  onOpenScheduler,
  onCloseScheduler,
}: SchedulerViewProps) {
  // ── Open modal for NEW event (FAB / + button) ───────────────────────────
  const handleAddEvent = useCallback(() => {
    onOpenScheduler(); // no eventId → create mode
  }, [onOpenScheduler]);

  // ── Open modal for EXISTING event (click on an event chip) ─────────────
  // The TimelineEvent detail contains the event id — extract it and pass it
  // to onOpenScheduler so App can track which event is being edited and
  // forward it to <Scheduler eventId={...}>.
  const handleEventClick = useCallback(
    (e: Event) => {
      const ev = (e as CustomEvent<TimelineEvent>).detail;
      onOpenScheduler(ev?.id); // string → edit mode
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
  // detail.id distinguishes create (null) from edit (string).
  const handleSave = useCallback(
    (e: Event) => {
      const data = (e as CustomEvent).detail;
      const today = new Date().toISOString().split("T")[0];
      try {
        if (data.id) {
          // ── Edit mode: update the existing event ──────────────────────
          manager.updateEvent(data.id, {
            title: data.title,
            startTime: `${data.date || today}T${data.startTime}:00Z`,
            endTime: `${data.date || today}T${data.endTime}:00Z`,
            resourceId: data.participants?.[0] || "r1",
            description: data.description,
            status: "confirmed",
          });
        } else {
          // ── Create mode: add a new event ──────────────────────────────
          manager.addEvent({
            id: `evt_${Date.now()}`,
            title: data.title,
            startTime: `${data.date || today}T${data.startTime}:00Z`,
            endTime: `${data.date || today}T${data.endTime}:00Z`,
            resourceId: data.participants?.[0] || "r1",
            description: data.description,
            status: "confirmed",
          });
        }
        onCloseScheduler();
      } catch (err: unknown) {
        // Synchronous store errors (e.g. invalid time range) surface here.
        // Async hook failures go through onError in useSchedulerManager.
        console.error("Store rejected the event:", err);
      }
    },
    [manager, onCloseScheduler],
  );

  // ── Scheduler modal: delete ────────────────────────────────────────────
  // detail.id is the eventId that was passed to <Scheduler eventId={...}>.
  // Before this fix, detail only contained { title }, making id always
  // undefined and the delete a no-op.
  const handleDelete = useCallback(
    (e: Event) => {
      const { id } = (e as CustomEvent<{ id: string | null; title: string }>)
        .detail;
      if (id) manager.deleteEvent(id);
      onCloseScheduler();
    },
    [manager, onCloseScheduler],
  );

  // ── Timeline: drag-and-drop ────────────────────────────────────────────
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
          onViewChange={handleViewChange}
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
          // eventId tells the web component which event is being edited.
          // null/undefined → create mode. string → edit mode.
          // The component includes this in its onSave and onDelete payloads.
          eventId={selectedEventId}
          error={schedulerError}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={onCloseScheduler}
        />
      )}
    </>
  );
}
