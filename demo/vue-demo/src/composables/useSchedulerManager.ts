import {
  SchedulerManager,
  getBrowserTimezone,
  zonedInputToISO,
} from "@janus-scheduler/core";

export interface HookError {
  operation: string;
  message: string;
}

/**
 * useSchedulerManager
 *
 * Creates and seeds the SchedulerManager singleton for the Vue demo.
 * Same seed data and lifecycle hook configuration as the React and Angular demos.
 *
 * Since the Zustand store is a module-level singleton, calling this multiple
 * times (e.g. during HMR) is safe — the guard prevents duplicate seeding.
 */
export function useSchedulerManager(onError: (err: HookError) => void) {
  const manager = new SchedulerManager({
    // ── onEventAdd ──────────────────────────────────────────────────────
    // Fires AFTER the store is updated (optimistic). If this throws,
    // SchedulerManager automatically rolls back the store and calls onError.
    onEventAdd: async (_event) => {
      await new Promise((r) => setTimeout(r, 400)); // simulate network latency
      console.log(_event);
      return; // ← success path
    },

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

    manager.addResource({ id: "r1", name: "Dr. Sarah Chen", type: "person" });
    manager.addResource({
      id: "r2",
      name: "Dr. Michael Ross",
      type: "person",
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

  return manager;
}
