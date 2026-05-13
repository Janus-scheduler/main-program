import { createSignal, createMemo, Show } from "solid-js";
import "./App.css";
import {
  Timeline,
  Scheduler,
  MonthGrid,
  type ViewType,
  SchedulerManager,
  getBrowserTimezone,
  zonedInputToISO,
  isoToZonedDisplay,
  schedulerStore,
} from "@janus-scheduler/solid";

const GridIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
  </svg>
);

const PeopleIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const DoorIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <line x1="9" y1="3" x2="9" y2="21" />
  </svg>
);

const EquipmentIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
  </svg>
);

const SettingsIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

function App() {
  const [showScheduler, setShowScheduler] = createSignal(false);
  const [schedulerError, setSchedulerError] = createSignal<string | null>(null);
  const [currentView, setCurrentView] = createSignal<ViewType>("Month");
  const [selectedEventId, setSelectedEventId] = createSignal<string | null>(
    null,
  );

  // Initialize the core manager once and populate initial data
  const manager = new SchedulerManager();
  // Only populate if empty (for hot reloading safety)
  if (manager.getResourceCount() === 0) {
    manager.addResource({
      id: "r1",
      name: "Dr. Sarah Chena",
      type: "person",
    });
    manager.addResource({
      id: "r2",
      name: "Dr. Michael Ross",
      type: "person",
    });
    manager.addResource({
      id: "r3",
      name: "Operating Room 1",
      type: "room",
    });
    manager.addResource({
      id: "r4",
      name: "MRI Scanner A",
      type: "equipment",
    });

    // Add a couple of initial events for today
    const today = new Date().toISOString().split("T")[0];
    const tz = getBrowserTimezone();
    manager.addEvent({
      id: "e1",
      title: "Appendectomy",
      startTime: zonedInputToISO(today, "09:00", tz),
      endTime: zonedInputToISO(today, "11:30", tz),
      resourceId: "r1",
      status: "confirmed",
    });
    manager.addEvent({
      id: "e2",
      title: "Pre-op Assessment",
      startTime: zonedInputToISO(today, "13:00", tz),
      endTime: zonedInputToISO(today, "14:00", tz),
      resourceId: "r2",
      status: "confirmed",
    });
  }

  const storeEvent = createMemo(() => {
    const id = selectedEventId();
    return id ? manager.getEvent(id) : null;
  });

  // Convert a UTC ISO string → local { date, time } using the store's selected timezone.
  const splitISO = (iso: string | undefined) => {
    if (!iso) return { date: undefined, time: undefined };
    const { date, time } = isoToZonedDisplay(
      iso,
      schedulerStore.getState().timezone,
    );
    return { date, time };
  };

  const startParts = createMemo(() => splitISO(storeEvent()?.startTime));
  const endParts = createMemo(() => splitISO(storeEvent()?.endTime));

  return (
    <div class="app-shell">
      <aside class="app-sidebar">
        <div class="app-sidebar-brand">
          <span class="brand-icon">J</span>
          <span class="brand-name">Janus</span>
        </div>

        <nav class="app-sidebar-nav">
          <button class="nav-item active">
            <GridIcon /> <span>Dashboard</span>
          </button>
          <button class="nav-item">
            <PeopleIcon /> <span>People</span>
          </button>
          <button class="nav-item">
            <DoorIcon /> <span>Rooms</span>
          </button>
          <button class="nav-item">
            <EquipmentIcon /> <span>Equipment</span>
          </button>
          <button class="nav-item">
            <SettingsIcon /> <span>Settings</span>
          </button>
        </nav>

        <div class="app-sidebar-footer">
          <span class="footer-version">Janus v3.4</span>
          <span class="footer-status">All systems operational</span>
        </div>
      </aside>

      <main class="app-main">
        <Show when={currentView() === "Timeline"}>
          <Timeline
            onAddEvent={() => {
              setSelectedEventId(null);
              setSchedulerError(null);
              setShowScheduler(true);
            }}
            onEventClick={(detail) => {
              setSelectedEventId(detail.id);
              setSchedulerError(null);
              setShowScheduler(true);
            }}
            onEventMove={({
              event,
              newResourceId,
              newStartTime,
              newEndTime,
            }) => {
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
            onViewChange={(detail) => setCurrentView(detail.view)}
          />
        </Show>
        <Show when={currentView() === "Month"}>
          <MonthGrid
            onAddEvent={() => {
              setSelectedEventId(null);
              setSchedulerError(null);
              setShowScheduler(true);
            }}
            onEventClick={(detail) => {
              setSelectedEventId(detail.id);
              setSchedulerError(null);
              setShowScheduler(true);
            }}
            onViewChange={(detail) => setCurrentView(detail.view)}
          />
        </Show>

        <Show when={showScheduler()}>
          <Scheduler
            eventId={selectedEventId()}
            title={storeEvent()?.title}
            startDate={startParts().date}
            startTime={startParts().time}
            endDate={endParts().date}
            endTime={endParts().time}
            participants={
              storeEvent()?.resourceId ? [storeEvent()!.resourceId] : undefined
            }
            description={storeEvent()?.description}
            error={schedulerError()}
            onSave={(data) => {
              try {
                const today = new Date().toISOString().split("T")[0];
                const eventData = {
                  id: selectedEventId() || `evt_${Date.now()}`,
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
                  resourceId: data.participants?.[0] || "r1",
                  description: data.description,
                  status: "confirmed" as const,
                };

                if (selectedEventId()) {
                  manager.updateEvent(selectedEventId()!, eventData);
                } else {
                  manager.addEvent(eventData);
                }
                setShowScheduler(false);
                setSelectedEventId(null);
                setSchedulerError(null);
              } catch (err: unknown) {
                const error = err as Error;
                setSchedulerError(
                  error.message || "An unexpected error occurred",
                );
              }
            }}
            onDelete={(data) => {
              if (data.id) manager.deleteEvent(data.id);
              setShowScheduler(false);
              setSelectedEventId(null);
            }}
            onClose={() => {
              setShowScheduler(false);
              setSelectedEventId(null);
            }}
          />
        </Show>
      </main>
    </div>
  );
}

export default App;
