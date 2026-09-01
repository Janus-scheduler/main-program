import {
  createSignal,
  createMemo,
  Show,
  createEffect,
  onCleanup,
} from "solid-js";
import "./App.css";
import {
  Timeline,
  Scheduler,
  MonthGrid,
  DayGrid,
  WeekGrid,
  YearGrid,
  Chat,
  Topbar,
  type ViewType,
  SchedulerManager,
  getBrowserTimezone,
  zonedInputToISO,
  isoToZonedDisplay,
  schedulerStore,
  createJanusChat,
} from "@janus-scheduler/solid";
import {
  catalogFromResources,
  commitSession,
  type SessionRequirements,
  type SessionState,
  type PresentMessage,
} from "@janus-scheduler/nlp";
import {
  GoogleSyncManager,
  GoogleCalendarClient,
  GoogleEventMapper,
} from "@janus-scheduler/integrations";

const BACKEND_URL = "http://localhost:3001";
import { createNlpEngine } from "./chat/createNlpEngine";

const INTRO: PresentMessage = {
  id: "intro",
  role: "assistant",
  kind: "text",
  text: "Tell me what to schedule. I'll show you what I understood before anything is added.",
};

const REQUIRES: SessionRequirements = {
  add_event: ["when", "duration", "resource", "title"],
  modify_event: ["when"],
};

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

const TIMELINE_RESOURCE_CONFIG = {
  person: { label: "STAFF", subtitle: "Staff", order: 1 },
  room: { label: "ROOMS", subtitle: "Facility", order: 2 },
  equipment: { label: "EQUIPMENT", subtitle: "Equipment", order: 3 },
  vehicle: {
    label: "VEHICLES",
    subtitle: "Fleet",
    order: 4,
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11h12Zm0 0h2.5a2.5 2.5 0 0 0 2.5-2.5V11l-4-3v10Z"/><circle cx="6" cy="18" r="2"/><circle cx="16" cy="18" r="2"/></svg>`,
  },
};

function App() {
  const [showScheduler, setShowScheduler] = createSignal(false);
  const [schedulerError, setSchedulerError] = createSignal<string | null>(null);
  const [currentView, setCurrentView] = createSignal<ViewType>("Month");
  const [selectedEventId, setSelectedEventId] = createSignal<string | null>(
    null,
  );
  const [navData, setNavData] = createSignal<{
    navLabel: string;
    dayName: string;
    shortDate: string;
    zoomPercent: number;
    zoomUnit: string;
  }>({
    navLabel: "",
    dayName: "",
    shortDate: "",
    zoomPercent: 100,
    zoomUnit: "",
  });
  const [allowCreate, setAllowCreate] = createSignal(false);
  const [googleConnected, setGoogleConnected] = createSignal(false);

  let timelineRef: HTMLElement & {
    goToPrev: () => void;
    goToNext: () => void;
    goToToday: () => void;
    toggleCreate: () => void;
    goToDate?: (date: string | number | Date) => void;
  };
  let monthGridRef: HTMLElement & {
    goToPrev: () => void;
    goToNext: () => void;
    goToToday: () => void;
  };
  let dayGridRef: HTMLElement & {
    goToPrev: () => void;
    goToNext: () => void;
    goToToday: () => void;
    goToDate: (date: string | number | Date) => void;
  };
  let weekGridRef: HTMLElement & {
    goToPrev: () => void;
    goToNext: () => void;
    goToToday: () => void;
  };
  let yearGridRef: HTMLElement & {
    goToPrev: () => void;
    goToNext: () => void;
    goToToday: () => void;
  };

  const client = new GoogleCalendarClient({ backendUrl: BACKEND_URL });
  const mapper = new GoogleEventMapper();
  const syncManager = new GoogleSyncManager(client, mapper);

  // Initialize the core manager once and populate initial data
  const manager = new SchedulerManager({
    ...syncManager.getHooks(),
  });

  // Detect OAuth redirect / pick up an already-connected backend
  syncManager.handleOAuthRedirect();
  const unsubscribeGoogleStatus = syncManager.onStatusChange((connected) =>
    setGoogleConnected(connected),
  );
  syncManager.refreshStatus();

  // Start real-time sync after connecting; tear it down on disconnect.
  createEffect(() => {
    if (!googleConnected()) return;

    let stopRealtimeSync: (() => void) | undefined;
    let cancelled = false;

    syncManager.startRealtimeSync().then((stop) => {
      if (cancelled) {
        stop();
      } else {
        stopRealtimeSync = stop;
      }
    });

    onCleanup(() => {
      cancelled = true;
      stopRealtimeSync?.();
    });
  });

  onCleanup(() => {
    unsubscribeGoogleStatus();
  });

  const handleConnectCalendar = () => {
    if (googleConnected()) {
      syncManager.disconnect();
    } else {
      syncManager.connect();
    }
  };

  // Only populate if empty (for hot reloading safety)
  if (manager.getResourceCount() === 0) {
    manager.addResource({
      id: "r1",
      name: "Dr. Sarah Chen",
      type: "person",
      email: "sarah.chen@example.com",
      subtitle: "Specialist",
      avatar:
        "https://tse4.mm.bing.net/th/id/OIP.Fg0RUhBQm2fns8AIOTXtJwHaHa?r=0&rs=1&pid=ImgDetMain&o=7&rm=3",
    });
    manager.addResource({
      id: "r2",
      name: "Dr. Michael Ross",
      type: "person",
      email: "michael.ross@example.com",
      subtitle: "Surgeon",
      avatar:
        "https://img.magnific.com/premium-photo/handsome-young-male-medical-doctor-portrait-with-stethoscope-hospital_744655-345.jpg?w=2000",
    });
    manager.addResource({
      id: "r3",
      name: "Operating Room 1",
      type: "room",
      avatar:
        "https://images.unsplash.com/photo-1551076805-e1869033e561?auto=format&fit=crop&q=80&w=120&h=120",
    });
    manager.addResource({
      id: "r4",
      name: "MRI Scanner A",
      type: "equipment",
      avatar:
        "https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&q=80&w=120&h=120",
    });

    // Add a couple of initial events for today
    const today = new Date().toISOString().split("T")[0];
    const tz = getBrowserTimezone();
    manager.addEvent({
      id: "e1",
      title: "Appendectomy",
      startTime: zonedInputToISO(today, "09:00", tz),
      endTime: zonedInputToISO(today, "11:30", tz),
      resourceIds: ["r1", "r3"],
      status: "confirmed",
    });
    manager.addEvent({
      id: "e2",
      title: "Pre-op Assessment",
      startTime: zonedInputToISO(today, "13:00", tz),
      endTime: zonedInputToISO(today, "14:00", tz),
      resourceIds: ["r2"],
      status: "confirmed",
    });
  }

  const engineState = createNlpEngine();
  const catalog = createMemo(() =>
    catalogFromResources(manager.getAllResources()),
  );

  const handleConfirm = (state: SessionState) => {
    const resources = manager.getAllResources();
    const result = commitSession(manager, state, resources[0]?.id);
    return result.ok
      ? { ok: true, message: result.summary, undo: result.undo }
      : { ok: false, message: result.message };
  };

  const chat = createJanusChat(() => {
    const s = engineState();
    return {
      engine: s.status === "ready" ? s.engine : null,
      catalog: catalog(),
      // Resolved per turn, from the zone the timeline actually renders in.
      timezone: () => schedulerStore.getState().timezone,
      intro: INTRO,
      requires: REQUIRES,
      fallbackResourceName: manager.getAllResources()[0]?.name,
      onConfirm: handleConfirm,
    };
  });

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

      <main
        class="app-main"
        style={{
          display: "flex",
          "flex-direction": "row",
          height: "100%",
          width: "100%",
        }}
      >
        <div
          style={{
            display: "flex",
            "flex-direction": "column",
            flex: 1,
            "min-width": 0,
            height: "100%",
          }}
        >
          <Topbar
            navLabel={navData().navLabel}
            dayName={navData().dayName}
            shortDate={navData().shortDate}
            view={currentView()}
            allowCreate={allowCreate()}
            zoomPercent={navData().zoomPercent}
            zoomUnit={navData().zoomUnit}
            isGoogleCalendarConnected={googleConnected()}
            onConnectCalendar={handleConnectCalendar}
            onPrevClick={() => {
              if (currentView() === "Timeline") timelineRef?.goToPrev();
              else if (currentView() === "Month") monthGridRef?.goToPrev();
              else if (currentView() === "Day") dayGridRef?.goToPrev();
              else if (currentView() === "Week") weekGridRef?.goToPrev();
              else yearGridRef?.goToPrev();
            }}
            onNextClick={() => {
              if (currentView() === "Timeline") timelineRef?.goToNext();
              else if (currentView() === "Month") monthGridRef?.goToNext();
              else if (currentView() === "Day") dayGridRef?.goToNext();
              else if (currentView() === "Week") weekGridRef?.goToNext();
              else yearGridRef?.goToNext();
            }}
            onTodayClick={() => {
              if (currentView() === "Timeline") timelineRef?.goToToday();
              else if (currentView() === "Month") monthGridRef?.goToToday();
              else if (currentView() === "Day") dayGridRef?.goToToday();
              else if (currentView() === "Week") weekGridRef?.goToToday();
              else yearGridRef?.goToToday();
            }}
            onViewSwitch={(detail) => setCurrentView(detail.view)}
            onToggleCreate={() => {
              if (currentView() === "Timeline") timelineRef?.toggleCreate();
              setAllowCreate((prev) => !prev);
            }}
          />

          <Show when={currentView() === "Day"}>
            <DayGrid
              showFab={true}
              allowCreate={allowCreate()}
              ref={(el) => (dayGridRef = el as unknown as typeof dayGridRef)}
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
              onSlotSelect={() => {
                setSelectedEventId(null);
                setSchedulerError(null);
                setShowScheduler(true);
              }}
              onEventMove={({ event, newDate, newStartTime, newEndTime }) => {
                const tz = schedulerStore.getState().timezone;
                manager.updateEvent(event.id, {
                  startTime: zonedInputToISO(newDate, newStartTime, tz),
                  endTime: zonedInputToISO(newDate, newEndTime, tz),
                });
              }}
              onEventResize={({ event, date, newStartTime, newEndTime }) => {
                const tz = schedulerStore.getState().timezone;
                manager.updateEvent(event.id, {
                  startTime: zonedInputToISO(date, newStartTime, tz),
                  endTime: zonedInputToISO(date, newEndTime, tz),
                });
              }}
              onViewChange={(detail) => setCurrentView(detail.view)}
              onNavChange={(detail) => {
                setNavData({
                  navLabel: (detail.navLabel as string) || "",
                  dayName: (detail.dayName as string) || "",
                  shortDate: (detail.shortDate as string) || "",
                  zoomPercent: (detail.zoomPercent as number) || 100,
                  zoomUnit: (detail.zoomUnit as string) || "",
                });
              }}
            />
          </Show>

          <Show when={currentView() === "Week"}>
            <WeekGrid
              showFab={true}
              allowCreate={allowCreate()}
              ref={(el) => (weekGridRef = el as unknown as typeof weekGridRef)}
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
              onDayClick={(detail) => {
                setCurrentView("Day");
                setTimeout(() => {
                  dayGridRef?.goToDate?.(detail.date);
                }, 50);
              }}
              onSlotSelect={() => {
                setSelectedEventId(null);
                setSchedulerError(null);
                setShowScheduler(true);
              }}
              onEventMove={({ event, newDate, newStartTime, newEndTime }) => {
                const tz = schedulerStore.getState().timezone;
                manager.updateEvent(event.id, {
                  startTime: zonedInputToISO(newDate, newStartTime, tz),
                  endTime: zonedInputToISO(newDate, newEndTime, tz),
                });
              }}
              onEventResize={({ event, date, newStartTime, newEndTime }) => {
                const tz = schedulerStore.getState().timezone;
                manager.updateEvent(event.id, {
                  startTime: zonedInputToISO(date, newStartTime, tz),
                  endTime: zonedInputToISO(date, newEndTime, tz),
                });
              }}
              onViewChange={(detail) => setCurrentView(detail.view)}
              onNavChange={(detail) => {
                setNavData({
                  navLabel: (detail.navLabel as string) || "",
                  dayName: (detail.dayName as string) || "",
                  shortDate: (detail.shortDate as string) || "",
                  zoomPercent: (detail.zoomPercent as number) || 100,
                  zoomUnit: (detail.zoomUnit as string) || "",
                });
              }}
            />
          </Show>

          <Show when={currentView() === "Timeline"}>
            <Timeline
              ref={(el) => (timelineRef = el as unknown as typeof timelineRef)}
              resourceTypeConfig={TIMELINE_RESOURCE_CONFIG}
              showFab={true}
              allowCreate={allowCreate()}
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
                manager.addEvent({
                  id: `evt_${Date.now()}`,
                  title: "New Event",
                  startTime,
                  endTime,
                  resourceIds: [resourceId],
                  status: "confirmed",
                });
              }}
              onViewChange={(detail) => setCurrentView(detail.view)}
              onNavChange={(detail) => {
                setNavData({
                  navLabel: (detail.navLabel as string) || "",
                  dayName: (detail.dayName as string) || "",
                  shortDate: (detail.shortDate as string) || "",
                  zoomPercent: (detail.zoomPercent as number) || 100,
                  zoomUnit: (detail.zoomUnit as string) || "",
                });
              }}
            />
          </Show>
          <Show when={currentView() === "Month"}>
            <MonthGrid
              ref={(el) =>
                (monthGridRef = el as unknown as typeof monthGridRef)
              }
              showFab={true}
              navLinks={true}
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
              onNavChange={(detail) => {
                setNavData({
                  navLabel: (detail.navLabel as string) || "",
                  dayName: (detail.dayName as string) || "",
                  shortDate: (detail.shortDate as string) || "",
                  zoomPercent: (detail.zoomPercent as number) || 100,
                  zoomUnit: (detail.zoomUnit as string) || "",
                });
              }}
              onDayHeaderClick={(detail) => {
                setCurrentView("Timeline");
                setTimeout(() => {
                  timelineRef?.goToDate?.(detail.date);
                }, 100);
              }}
              onSlotSelect={() => {
                setSelectedEventId(null);
                setSchedulerError(null);
                setShowScheduler(true);
              }}
            />
          </Show>
          <Show when={currentView() === "Year"}>
            <YearGrid
              ref={(el) => (yearGridRef = el as unknown as typeof yearGridRef)}
              onViewChange={(detail) => setCurrentView(detail.view)}
              onNavChange={(detail) => {
                setNavData({
                  navLabel: (detail.navLabel as string) || "",
                  dayName: (detail.dayName as string) || "",
                  shortDate: (detail.shortDate as string) || "",
                  zoomPercent: (detail.zoomPercent as number) || 100,
                  zoomUnit: (detail.zoomUnit as string) || "",
                });
              }}
              onDayClick={(detail) => {
                setCurrentView("Timeline");
                setTimeout(() => {
                  timelineRef?.goToDate?.(detail.date);
                }, 100);
              }}
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
                storeEvent()?.resourceIds
                  ? storeEvent()!.resourceIds
                  : undefined
              }
              description={storeEvent()?.description}
              activeColor={storeEvent()?.color}
              allDay={storeEvent()?.allDay}
              recurrenceRule={storeEvent()?.recurrenceRule}
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
                    resourceIds: data.participants || ["r1"],
                    description: data.description,
                    status: "confirmed" as const,
                    color: data.activeColor,
                    allDay: data.allDay,
                    recurrenceRule: data.recurrenceRule,
                  };

                  if (data.id) {
                    manager.updateEvent(data.id, eventData);
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
        </div>

        <div class="chat-sidebar">
          <div class="chat-sidebar__panel">
            <Chat
              messages={chat.thread()}
              busy={chat.busy() || engineState().status === "loading"}
              disabled={chat.busy() || engineState().status === "loading"}
              theme="light"
              showClose={true}
              placeholder={
                engineState().status === "ready"
                  ? "Ask me to schedule something…"
                  : "Loading the language model…"
              }
              onChatSubmit={(d) => chat.submit(d.prompt)}
              onChatClarifyResponse={(d) => chat.choose(d.label)}
              onChatConfirm={chat.confirm}
              onChatUndo={(d) => chat.undo(d.messageId)}
              onChatEdit={() => (chat.edit ? chat.edit() : chat.reset())}
            />
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
