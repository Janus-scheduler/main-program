import {
  SchedulerManager,
  getBrowserTimezone,
  zonedInputToISO,
} from "@janus-scheduler/core";
import {
  GoogleSyncManager,
  GoogleCalendarClient,
  GoogleEventMapper,
} from "@janus-scheduler/integrations";

export interface HookError {
  operation: string;
  message: string;
}

const BACKEND_URL = "http://localhost:3001";

/**
 * useSchedulerManager
 *
 * Creates and seeds the SchedulerManager singleton for the Vue demo.
 * Same seed data and lifecycle hook configuration as the React and Angular demos.
 *
 * Since the Zustand store is a module-level singleton, calling this multiple
 * times (e.g. during HMR) is safe — the guard prevents duplicate seeding.
 *
 * @returns `{ manager, syncManager }` — the caller needs `syncManager` too,
 *   for the Google Calendar connect/disconnect and real-time sync lifecycle.
 */
export function useSchedulerManager(onError: (err: HookError) => void) {
  // Set up Google sync infrastructure
  const client = new GoogleCalendarClient({ backendUrl: BACKEND_URL });
  const mapper = new GoogleEventMapper();
  const syncManager = new GoogleSyncManager(client, mapper);

  const manager = new SchedulerManager({
    ...syncManager.getHooks(),

    // ── onError ─────────────────────────────────────────────────────────
    // The store has already been rolled back before this fires.
    // We only need to surface a message to the user.
    onError: ({ operation, error }) => {
      const message =
        error instanceof Error ? error.message : "An unexpected error occurred";
      onError({ operation, message });
    },
  });

  // ── Seed initial demo data ─────────────────────────────────────────────
  // Same data as React and Angular demos.
  if (manager.getResourceCount() === 0) {
    console.log("🌱 Seeding initial data to core manager...");

    manager.addResource({
      id: "r1",
      name: "Dr. Sarah Chen",
      type: "person",
      email: "sarah.chen@example.com",
    });
    manager.addResource({
      id: "r2",
      name: "Dr. Michael Ross",
      type: "person",
      email: "michael.ross@example.com",
    });
    manager.addResource({ id: "r3", name: "Operating Room 1", type: "room" });
    manager.addResource({
      id: "r4",
      name: "MRI Scanner A",
      type: "equipment",
    });

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

    console.log("✅ Seeding complete");
  }

  return { manager, syncManager };
}
