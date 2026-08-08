import { useEffect, useRef, useState } from "react";
import {
  Timeline,
  MonthGrid,
  DayGrid,
  WeekGrid,
  Scheduler,
  AiBar,
  Topbar,
  isoToZonedDisplay,
  zonedInputToISO,
  schedulerStore,
} from "@janus-scheduler/react";
import type { ViewType, SchedulerManager } from "@janus-scheduler/react";

import { loadDenseBenchmarkData } from "../utils/benchmarkDataGenerator";

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
  canUndo?: boolean;
  onUndo?: () => void;
}

/**
 * Benchmark dataset size requested on the URL (`?resources=N` / `?count=N`),
 * or null when the param is absent or not a positive integer.
 */
function readBenchmarkCountFromUrl(): number | null {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get("resources") ?? params.get("count");
  if (!raw) return null;
  const count = Number.parseInt(raw, 10);
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
  canUndo,
  onUndo,
}: Readonly<SchedulerViewProps>) {
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
    HTMLElement & {
      goToPrev: () => void;
      goToNext: () => void;
      goToToday: () => void;
      toggleCreate: () => void;
      goToDate: (date: string | number | Date) => void;
    }
  >(null);
  const monthGridRef = useRef<
    HTMLElement & {
      goToPrev: () => void;
      goToNext: () => void;
      goToToday: () => void;
    }
  >(null);

  /** Day and Week grids share the same imperative navigation API. */
  type TimeGridHandle = HTMLElement & {
    goToPrev: () => void;
    goToNext: () => void;
    goToToday: () => void;
    goToDate: (date: string | number | Date) => void;
  };
  const dayGridRef = useRef<TimeGridHandle>(null);
  const weekGridRef = useRef<TimeGridHandle>(null);

  /**
   * The nav surface every view exposes. `goToDate` is optional because Month
   * navigates by month rather than by day.
   */
  type NavHandle = HTMLElement & {
    goToPrev: () => void;
    goToNext: () => void;
    goToToday: () => void;
    goToDate?: (date: string | number | Date) => void;
  };

  /** The nav-capable component currently on screen, or null if none is. */
  const activeNavRef = (): NavHandle | null => {
    if (currentView === "Timeline") return timelineRef.current;
    if (currentView === "Month") return monthGridRef.current;
    if (currentView === "Day") return dayGridRef.current;
    return weekGridRef.current;
  };

  /**
   * Date a view-switch should land on, set by a day-click in another view.
   * A ref (not state) so the useEffect below can't read a stale value.
   */
  const pendingDate = useRef<string | null>(null);

  // After a view switch, navigate the newly mounted view to the pending date
  // (set by a day-click in another view).
  useEffect(() => {
    const target = pendingDate.current;
    pendingDate.current = null; // consume it

    // Timeline does not start on today's date the way the calendar views do,
    // so it needs an explicit reset whenever it is mounted without a target —
    // otherwise it opens on a stale window and appears to have no events.
    const needsTodayReset = !target && currentView === "Timeline";
    if (!target && !needsTodayReset) return;

    // The new view mounts on the next tick, so resolve the ref inside the
    // timeout rather than capturing a ref that is still null right now.
    const timer = setTimeout(() => {
      const el = activeNavRef();
      if (!el) return;
      // Month has no goToDate — it navigates by month, not by day.
      if (target) el.goToDate?.(target);
      else el.goToToday();
    }, 50);
    return () => clearTimeout(timer);
    // activeNavRef reads refs only — currentView is the real dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentView]);

  const [navData, setNavData] = useState({
    navLabel: "",
    dayName: "",
    shortDate: "",
    zoomPercent: 100,
    zoomUnit: "",
  });
  const [allowCreate, setAllowCreate] = useState(false);

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

  /**
   * Day / Week grids report slot selections already split into date + time in
   * the display timezone, so they can be handed straight to the modal —
   * unlike Timeline's onEventCreate, which reports ISO instants.
   */
  const handleSlotSelect = (detail: {
    date: string;
    startTime: string;
    endTime: string;
  }) => {
    setTempEventData({
      startDate: detail.date,
      startTime: detail.startTime,
      endDate: detail.date,
      endTime: detail.endTime,
      // Day/Week have no resource axis, so the user picks participants in the
      // modal — leave it undefined rather than forcing an empty selection.
      showConfirmOnCreate: true,
    });
    onOpenScheduler();
  };

  /**
   * Day / Week grids report drag results as wall-clock date+time (like
   * onSlotSelect), not ISO instants like Timeline — so both handlers convert
   * via `zonedInputToISO` before writing to the store.
   */
  const handleTimeGridMove = ({
    event,
    newDate,
    newStartTime,
    newEndTime,
  }: {
    event: { id: string };
    newDate: string;
    newStartTime: string;
    newEndTime: string;
  }) => {
    const tz = schedulerStore.getState().timezone;
    manager.updateEvent(event.id, {
      startTime: zonedInputToISO(newDate, newStartTime, tz),
      endTime: zonedInputToISO(newDate, newEndTime, tz),
    });
  };

  const handleTimeGridResize = ({
    event,
    date,
    newStartTime,
    newEndTime,
  }: {
    event: { id: string };
    date: string;
    newStartTime: string;
    newEndTime: string;
  }) => {
    const tz = schedulerStore.getState().timezone;
    manager.updateEvent(event.id, {
      startTime: zonedInputToISO(date, newStartTime, tz),
      endTime: zonedInputToISO(date, newEndTime, tz),
    });
  };

  let schedulerTitle = "";
  if (storeEvent) {
    schedulerTitle = storeEvent.title;
  } else if (tempEventData) {
    schedulerTitle = "New Event";
  }

  let schedulerParticipants = tempEventData?.participants;
  if (storeEvent) {
    schedulerParticipants = storeEvent.resourceIds || undefined;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Topbar
        navLabel={navData.navLabel}
        dayName={navData.dayName}
        shortDate={navData.shortDate}
        view={currentView}
        allowCreate={allowCreate}
        canUndo={canUndo}
        zoomPercent={navData.zoomPercent}
        zoomUnit={navData.zoomUnit}
        onPrevClick={() => activeNavRef()?.goToPrev()}
        onNextClick={() => activeNavRef()?.goToNext()}
        onTodayClick={() => activeNavRef()?.goToToday()}
        onViewSwitch={(detail) => onViewChange(detail.view)}
        onToggleCreate={() => {
          if (currentView === "Timeline") timelineRef.current?.toggleCreate();
          setAllowCreate(!allowCreate);
        }}
        onUndoClick={() => {
          if (onUndo) onUndo();
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
            pendingDate.current = detail.date; // store, don't use a floating setTimeout
            onViewChange("Day");
          }}
          onViewChange={(detail) => onViewChange(detail.view)}
          onNavChange={handleNavChange}
          ref={monthGridRef}
        />
      )}

      {currentView === "Week" && (
        <WeekGrid
          ref={weekGridRef}
          showFab={true}
          allowCreate={allowCreate}
          onAddEvent={() => onOpenScheduler()}
          onEventClick={(ev) => onOpenScheduler(ev?.id)}
          onDayClick={(detail) => {
            pendingDate.current = detail.date;
            onViewChange("Day");
          }}
          onSlotSelect={handleSlotSelect}
          onEventMove={handleTimeGridMove}
          onEventResize={handleTimeGridResize}
          onViewChange={(detail) => onViewChange(detail.view)}
          onNavChange={handleNavChange}
        />
      )}

      {currentView === "Day" && (
        <DayGrid
          ref={dayGridRef}
          showFab={true}
          allowCreate={allowCreate}
          onAddEvent={() => onOpenScheduler()}
          onEventClick={(ev) => onOpenScheduler(ev?.id)}
          onSlotSelect={handleSlotSelect}
          onEventMove={handleTimeGridMove}
          onEventResize={handleTimeGridResize}
          onViewChange={(detail) => onViewChange(detail.view)}
          onNavChange={handleNavChange}
        />
      )}

      {showScheduler && (
        <Scheduler
          preventConflicts={preventConflicts}
          eventId={selectedEventId}
          error={schedulerError}
          title={schedulerTitle}
          startDate={storeEvent ? startParts?.date : tempEventData?.startDate}
          startTime={storeEvent ? startParts?.time : tempEventData?.startTime}
          endDate={storeEvent ? endParts?.date : tempEventData?.endDate}
          endTime={storeEvent ? endParts?.time : tempEventData?.endTime}
          participants={schedulerParticipants}
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
        }}
      />
    </div>
  );
}
