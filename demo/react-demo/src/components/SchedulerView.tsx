import { useState } from "react";
import { Timeline, MonthGrid, Scheduler, AiBar } from "@janus-scheduler/react";
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
  preventConflicts: boolean;
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
  preventConflicts,
  onViewChange,
  onOpenScheduler,
  onCloseScheduler,
}: SchedulerViewProps) {
  const [tempEventData, setTempEventData] = useState<{
    startDate?: string;
    startTime?: string;
    endDate?: string;
    endTime?: string;
    participants?: string[];
    showConfirmOnCreate?: boolean;
  } | null>(null);

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
          preventConflicts={preventConflicts}
          onAddEvent={() => onOpenScheduler()}
          onEventClick={(ev) => onOpenScheduler(ev?.id)}
          onEventMove={({
            event,
            oldResourceId,
            newResourceId,
            newStartTime,
            newEndTime,
          }) => {
            const currentEvent = manager.getEvent(event.id);
            if (!currentEvent) return;
            const updatedResourceIds = currentEvent.resourceIds.map((id) =>
              id === oldResourceId ? newResourceId : id,
            );
            manager.updateEvent(event.id, {
              resourceIds: updatedResourceIds,
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
            const startStr = splitISO(startTime);
            const endStr = splitISO(endTime);
            setTempEventData({
              startDate: startStr.date,
              startTime: startStr.time,
              endDate: endStr.date,
              endTime: endStr.time,
              participants: [resourceId],
              showConfirmOnCreate: true,
            });
            onOpenScheduler();
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
          preventConflicts={preventConflicts}
          eventId={selectedEventId}
          error={schedulerError}
          title={
            storeEvent ? storeEvent.title : tempEventData ? "New Event" : ""
          }
          startDate={storeEvent ? startParts?.date : tempEventData?.startDate}
          startTime={storeEvent ? startParts?.time : tempEventData?.startTime}
          endDate={storeEvent ? endParts?.date : tempEventData?.endDate}
          endTime={storeEvent ? endParts?.time : tempEventData?.endTime}
          participants={
            storeEvent
              ? storeEvent.resourceIds
                ? storeEvent.resourceIds
                : undefined
              : tempEventData?.participants
          }
          description={storeEvent?.description}
          activeColor={storeEvent?.color}
          allDay={storeEvent?.allDay}
          recurrenceRule={storeEvent?.recurrenceRule}
          showConfirmOnCreate={
            !selectedEventId && !!tempEventData?.showConfirmOnCreate
          }
          onSave={(data) => {
            const today = new Date().toISOString().split("T")[0];
            try {
              if (data.id) {
                manager.updateEvent(data.id, {
                  title: data.title,
                  startTime: zonedInputToISO(
                    data.startDate || today,
                    data.startTime,
                    data.timezone,
                  ),
                  endTime: zonedInputToISO(
                    data.endDate || today,
                    data.endTime,
                    data.timezone,
                  ),
                  resourceIds: data.participants || ["r1"],
                  description: data.description,
                  status: "confirmed",
                  color: data.activeColor,
                  allDay: data.allDay,
                  recurrenceRule: data.recurrenceRule,
                });
              } else {
                manager.addEvent({
                  id: `evt_${Date.now()}`,
                  title: data.title || "New Event",
                  startTime: zonedInputToISO(
                    data.startDate || today,
                    data.startTime,
                    data.timezone,
                  ),
                  endTime: zonedInputToISO(
                    data.endDate || today,
                    data.endTime,
                    data.timezone,
                  ),
                  resourceIds: data.participants || ["r1"],
                  description: data.description,
                  status: "confirmed",
                  color: data.activeColor,
                  allDay: data.allDay,
                  recurrenceRule: data.recurrenceRule,
                });
                console.log("Event added:", data);
              }
              setTempEventData(null);
              onCloseScheduler();
            } catch (err: unknown) {
              console.error("Store rejected the event:", err);
            }
          }}
          onDelete={({ id }) => {
            if (id) manager.deleteEvent(id);
            setTempEventData(null);
            onCloseScheduler();
          }}
          onClose={() => {
            setTempEventData(null);
            onCloseScheduler();
          }}
        />
      )}
      <AiBar
        onAiSubmit={({ prompt }) => {
          console.log("AI prompt submitted:", prompt);
          // TODO: hook into your NLP integration here
        }}
      />
    </>
  );
}
