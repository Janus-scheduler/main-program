import { Timeline, MonthGrid, Scheduler } from "@janus-scheduler/react";
import type { ViewType } from "@janus-scheduler/react";
import type { SchedulerManager } from "@janus-scheduler/react";
import {
  isoToZonedDisplay,
  zonedInputToISO,
  schedulerStore,
} from "@janus-scheduler/react";

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
  // ── Helper to split ISO ────────────────────────────────────────────────
  // Convert a UTC ISO string → local { date, time } for display in the modal.
  // Uses the store's selected timezone for consistent display.
  const splitISO = (iso: string) => {
    if (!iso) return { date: "", time: "" };
    return isoToZonedDisplay(iso, schedulerStore.getState().timezone);
  };

  const storeEvent = selectedEventId ? manager.getEvent(selectedEventId) : null;
  const startParts = storeEvent ? splitISO(storeEvent.startTime) : null;
  const endParts = storeEvent ? splitISO(storeEvent.endTime) : null;

  return (
    <>
      {currentView === "Timeline" && (
        <Timeline
          onAddEvent={() => onOpenScheduler()}
          onEventClick={(ev) => onOpenScheduler(ev?.id)}
          onEventMove={({ event, newResourceId, newStartTime, newEndTime }) => {
            manager.updateEvent(event.id, {
              resourceId: newResourceId,
              startTime: newStartTime,
              endTime: newEndTime,
            });
          }}
          onEventResize={({ event, newStartTime, newEndTime }) => {
            manager.updateEvent(event.id, {
              startTime: newStartTime,
              endTime: newEndTime,
            });
          }}
          onEventCreate={({ resourceId, startTime, endTime }) => {
            manager.addEvent({
              id: `evt_${Date.now()}`,
              title: "New Event",
              startTime,
              endTime,
              resourceId,
              status: "confirmed",
            });
          }}
          onViewChange={(detail) => onViewChange(detail.view)}
        />
      )}

      {currentView === "Month" && (
        <MonthGrid
          onAddEvent={() => onOpenScheduler()}
          onEventClick={(ev) => onOpenScheduler(ev?.id)}
          onViewChange={(detail) => onViewChange(detail.view)}
        />
      )}

      {showScheduler && (
        <Scheduler
          // eventId tells the web component which event is being edited.
          // null/undefined → create mode. string → edit mode.
          // The component includes this in its onSave and onDelete payloads.
          eventId={selectedEventId}
          error={schedulerError}
          title={storeEvent?.title}
          startDate={startParts?.date}
          startTime={startParts?.time}
          endDate={endParts?.date}
          endTime={endParts?.time}
          participants={
            storeEvent?.resourceId ? [storeEvent.resourceId] : undefined
          }
          description={storeEvent?.description}
          onSave={(data) => {
            const today = new Date().toISOString().split("T")[0];
            try {
              if (data.id) {
                manager.updateEvent(data.id, {
                  title: data.title || "Untitled Event",
                  startTime: zonedInputToISO(
                    data.startDate || today,
                    data.startTime || "09:00",
                    data.timezone,
                  ),
                  endTime: zonedInputToISO(
                    data.endDate || today,
                    data.endTime || "10:00",
                    data.timezone,
                  ),
                  resourceId: data.participants?.[0] || "r1",
                  description: data.description || "",
                  status: "confirmed",
                });
              } else {
                const newEventPayload = {
                  id: `evt_${Date.now()}`,
                  title: data.title || "Untitled Event",
                  startTime: zonedInputToISO(
                    data.startDate || today,
                    data.startTime || "09:00",
                    data.timezone,
                  ),
                  endTime: zonedInputToISO(
                    data.endDate || today,
                    data.endTime || "10:00",
                    data.timezone,
                  ),
                  resourceId: data.participants?.[0] || "r1",
                  description: data.description || "",
                  status: "confirmed" as const,
                };
                manager.addEvent(newEventPayload);
              }
              onCloseScheduler();
            } catch (err: unknown) {
              console.error("Store rejected the event:", err);
            }
          }}
          onDelete={({ id }) => {
            if (id) manager.deleteEvent(id);
            onCloseScheduler();
          }}
          onClose={onCloseScheduler}
        />
      )}
    </>
  );
}
