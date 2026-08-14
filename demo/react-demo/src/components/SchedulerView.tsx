import { useEffect, useRef, useState } from "react";
import { Timeline, MonthGrid, Scheduler, Topbar } from "@janus-scheduler/react";
import type { ViewType } from "@janus-scheduler/react";
import type { SchedulerManager } from "@janus-scheduler/react";
import {
  isoToZonedDisplay,
  zonedInputToISO,
  schedulerStore,
} from "@janus-scheduler/react";
import type { JanusTimeline, JanusMonthGrid } from "@janus-scheduler/ui";

import { loadDenseBenchmarkData } from "../utils/benchmarkDataGenerator";
import { ChatSidebar } from "./ChatDock";

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
 * Benchmark dataset size requested on the URL (`?resources=N` / `?count=N`),
 * or null when the param is absent or not a positive integer.
 */
function readBenchmarkCountFromUrl(): number | null {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get("resources") ?? params.get("count");
  if (!raw) return null;
  const count = parseInt(raw, 10);
  return Number.isNaN(count) || count <= 0 ? null : count;
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

  const timelineRef = useRef<
    | (JanusTimeline & {
        goToPrev: () => void;
        goToNext: () => void;
        goToToday: () => void;
        toggleCreate: () => void;
        goToDate: (date: string | number | Date) => void;
      })
    | null
  >(null);
  const monthGridRef = useRef<
    | (JanusMonthGrid & {
        goToPrev: () => void;
        goToNext: () => void;
        goToToday: () => void;
      })
    | null
  >(null);

  const [navData, setNavData] = useState({
    navLabel: "",
    dayName: "",
    shortDate: "",
    zoomPercent: 100,
    zoomUnit: "",
  });
  const [allowCreate, setAllowCreate] = useState(true);

  // Seed the store once for the URL-selected dataset (?resources=N or ?count=N).
  useEffect(() => {
    const count = readBenchmarkCountFromUrl();
    if (count !== null) loadDenseBenchmarkData(count);
  }, []);

  // Re-center timeline on current time whenever switching to Timeline view
  useEffect(() => {
    if (currentView === "Timeline") {
      timelineRef.current?.goToToday();
    }
  }, [currentView]);

  const handleNavChange = (detail: Record<string, unknown>) => {
    setNavData({
      navLabel: (detail.navLabel as string) || "",
      dayName: (detail.dayName as string) || "",
      shortDate: (detail.shortDate as string) || "",
      zoomPercent: (detail.zoomPercent as number) || 100,
      zoomUnit: (detail.zoomUnit as string) || "",
    });
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        height: "100%",
        width: "100%",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          minWidth: 0,
          height: "100%",
        }}
      >
        <Topbar
          navLabel={navData.navLabel}
          dayName={navData.dayName}
          shortDate={navData.shortDate}
          view={currentView}
          allowCreate={allowCreate}
          zoomPercent={navData.zoomPercent}
          zoomUnit={navData.zoomUnit}
          onPrevClick={() => {
            if (currentView === "Timeline") timelineRef.current?.goToPrev();
            else monthGridRef.current?.goToPrev();
          }}
          onNextClick={() => {
            if (currentView === "Timeline") timelineRef.current?.goToNext();
            else monthGridRef.current?.goToNext();
          }}
          onTodayClick={() => {
            if (currentView === "Timeline") timelineRef.current?.goToToday();
            else monthGridRef.current?.goToToday();
          }}
          onViewSwitch={(detail) => onViewChange(detail.view)}
          onToggleCreate={() => {
            if (currentView === "Timeline") timelineRef.current?.toggleCreate();
            setAllowCreate(!allowCreate);
          }}
        />
        {currentView === "Timeline" && (
          <Timeline
            ref={timelineRef}
            allowCreate={allowCreate}
            showFab={true}
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
            onNavChange={handleNavChange}
          />
        )}

        {currentView === "Month" && (
          <MonthGrid
            showFab={false}
            onAddEvent={() => onOpenScheduler()}
            onEventClick={(ev) => onOpenScheduler(ev?.id)}
            onDayClick={(detail) => {
              onViewChange("Timeline");
              setTimeout(() => {
                if (timelineRef.current && timelineRef.current.goToDate) {
                  timelineRef.current.goToDate(detail.date);
                }
              }, 100);
            }}
            onViewChange={(detail) => onViewChange(detail.view)}
            onNavChange={handleNavChange}
            ref={monthGridRef}
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
      </div>
      <ChatSidebar manager={manager} />
    </div>
  );
}
