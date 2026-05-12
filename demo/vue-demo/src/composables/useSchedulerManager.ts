import { SchedulerManager } from "@janus-scheduler/core";

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

    manager.addEvent({
      id: "e1",
      title: "Appendectomy",
      startTime: `${today}T09:00:00Z`,
      endTime: `${today}T11:30:00Z`,
      resourceId: "r1",
      status: "confirmed",
    });

    manager.addEvent({
      id: "e2",
      title: "Pre-op Assessment",
      startTime: `${today}T13:00:00Z`,
      endTime: `${today}T14:00:00Z`,
      resourceId: "r2",
      status: "confirmed",
    });

    console.log("✅ Seeding complete");
  }

  return manager;
}
