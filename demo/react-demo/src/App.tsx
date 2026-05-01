import { useState, useMemo } from "react";
import "./App.css";
import { Timeline, Scheduler } from "@janus-scheduler/react";
import { SchedulerManager } from "@janus-scheduler/core";
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
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
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
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
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
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
  </svg>
);

const SettingsIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

function App() {
  const [showScheduler, setShowScheduler] = useState(false);
  const [schedulerError, setSchedulerError] = useState<string | null>(null);

  // Initialize the core manager once and populate initial data
  const manager = useMemo(() => {
    const mgr = new SchedulerManager();
    // Only populate if empty (for hot reloading safety)
    if (mgr.getResourceCount() === 0) {
      mgr.addResource({
        id: "r1",
        name: "Dr. Sarah Chena",
        type: "person",
      });
      mgr.addResource({
        id: "r2",
        name: "Dr. Michael Ross",
        type: "person",
      });
      mgr.addResource({
        id: "r3",
        name: "Operating Room 1",
        type: "room",
      });
      mgr.addResource({
        id: "r4",
        name: "MRI Scanner A",
        type: "equipment",
      });

      // Add a couple of initial events for today
      const today = new Date().toISOString().split("T")[0];
      mgr.addEvent({
        id: "e1",
        title: "Appendectomy",
        startTime: `${today}T09:00:00Z`,
        endTime: `${today}T11:30:00Z`,
        resourceId: "r1",
        status: "confirmed",
      });
      mgr.addEvent({
        id: "e2",
        title: "Pre-op Assessment",
        startTime: `${today}T13:00:00Z`,
        endTime: `${today}T14:00:00Z`,
        resourceId: "r2",
        status: "confirmed",
      });
    }
    return mgr;
  }, []);

  // When adding an event or clicking one, we'll open the scheduler modal
  const handleAddEvent = () => {
    setSchedulerError(null);
    setShowScheduler(true);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleEventClick = (e: any) => {
    console.log("Clicked event:", e);
    setSchedulerError(null);
    setShowScheduler(true);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleSave = (e: any) => {
    const data = e.detail;
    console.log("Saving event with data:", data);

    try {
      const today = new Date().toISOString().split("T")[0];
      const eventData = {
        id: `evt_${Date.now()}`,
        title: data.title,
        startTime: `${data.date || today}T${data.startTime}:00Z`,
        endTime: `${data.date || today}T${data.endTime}:00Z`,
        resourceId: data.participants[0] || "r1",
        description: data.description,
        status: "confirmed" as const,
      };

      // 2. Core Processing: Use the SchedulerManager to add the event
      manager.addEvent(eventData);

      console.log("✅ Event successfully added to core manager");
      setShowScheduler(false);
      setSchedulerError(null);
    } catch (err: unknown) {
      const error = err as Error;
      console.error("❌ Failed to save event:", error);
      // Pass the error back to the UI component
      setSchedulerError(error.message || "An unexpected error occurred");
    }
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleDelete = (e: any) => {
    console.log("Delete requested for:", e.detail.title);
    if (e.detail.id) {
      manager.deleteEvent(e.detail.id);
    }
    setShowScheduler(false);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleEventMove = (e: any) => {
    const { event, newResourceId, newStartTime, newEndTime } = e.detail;
    console.log("📦 Event moved:", e.detail);

    const today = event.date || new Date().toISOString().split("T")[0];
    manager.updateEvent(event.id, {
      resourceId: newResourceId,
      startTime: `${today}T${newStartTime}:00Z`,
      endTime: `${today}T${newEndTime}:00Z`,
    });
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleEventResize = (e: any) => {
    const { event, newStartTime, newEndTime } = e.detail;
    console.log("↔️ Event resized:", e.detail);

    const today = event.date || new Date().toISOString().split("T")[0];
    manager.updateEvent(event.id, {
      startTime: `${today}T${newStartTime}:00Z`,
      endTime: `${today}T${newEndTime}:00Z`,
    });
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleEventCreate = (e: any) => {
    const { resourceId, startTime, endTime, date } = e.detail;
    console.log("✨ New event created:", e.detail);

    const today = date || new Date().toISOString().split("T")[0];
    manager.addEvent({
      id: `evt_${Date.now()}`,
      title: "New Event",
      startTime: `${today}T${startTime}:00Z`,
      endTime: `${today}T${endTime}:00Z`,
      resourceId,
      status: "confirmed",
    });
  };

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="app-sidebar-brand">
          <span className="brand-icon">J</span>
          <span className="brand-name">Janus</span>
        </div>

        <nav className="app-sidebar-nav">
          <button className="nav-item active">
            <GridIcon /> <span>Dashboard</span>
          </button>
          <button className="nav-item">
            <PeopleIcon /> <span>People</span>
          </button>
          <button className="nav-item">
            <DoorIcon /> <span>Rooms</span>
          </button>
          <button className="nav-item">
            <EquipmentIcon /> <span>Equipment</span>
          </button>
          <button className="nav-item">
            <SettingsIcon /> <span>Settings</span>
          </button>
        </nav>

        <div className="app-sidebar-footer">
          <span className="footer-version">Janus v3.4</span>
          <span className="footer-status">All systems operational</span>
        </div>
      </aside>

      <main className="app-main">
        <Timeline
          onAddEvent={handleAddEvent}
          onEventClick={handleEventClick}
          onEventMove={handleEventMove}
          onEventResize={handleEventResize}
          onEventCreate={handleEventCreate}
        />

        {/* Render the scheduler modal if active */}
        {showScheduler && (
          <Scheduler
            error={schedulerError}
            onSave={handleSave}
            onDelete={handleDelete}
            onClose={() => setShowScheduler(false)}
          />
        )}
      </main>
    </div>
  );
}

export default App;
