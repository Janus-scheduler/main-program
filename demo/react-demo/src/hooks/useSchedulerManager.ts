import { useMemo } from "react";
import {
  SchedulerManager,
  getBrowserTimezone,
  zonedInputToISO,
} from "@janus-scheduler/react";

export interface HookError {
  operation: string;
  message: string;
}

/**
 * useSchedulerManager
 *
 * Creates and seeds the SchedulerManager singleton for the demo app.
 * Also configures the lifecycle hooks that connect Janus mutations
 * to a backend (simulated here) and handle errors.
 *
 * @param onError - called when any async hook rejects after a store rollback
 * @returns the configured SchedulerManager instance (stable across renders)
 */
export function useSchedulerManager(onError: (err: HookError) => void) {
  const manager = useMemo(() => {
    const mgr = new SchedulerManager({
      // ── onEventAdd ────────────────────────────────────────────────────
      // Fires AFTER the store is updated (optimistic). If this throws,
      // SchedulerManager automatically rolls back the store and calls onError.
      //
      // Replace with a real fetch() in production:
      //   await fetch('/api/events', { method: 'POST', body: JSON.stringify(event) })
      onEventAdd: async (_event) => {
        await new Promise((r) => setTimeout(r, 400)); // simulate network latency
        console.log(_event);
        return; // ← success path
        // throw new Error("HTTP 500 (simulated)"); // ← uncomment to test rollback
      },

      // onEventUpdate: async (event) => {
      //   const res = await fetch(`/api/events/${event.id}`, {
      //     method: 'PATCH',
      //     body: JSON.stringify(event),
      //   });
      //   if (!res.ok) throw new Error(`Server error ${res.status}`);
      // },

      // onEventDelete: async (id) => {
      //   await fetch(`/api/events/${id}`, { method: 'DELETE' });
      // },

      // ── onError ───────────────────────────────────────────────────────
      // The store has already been rolled back before this fires.
      // We only need to surface a message to the user.
      onError: ({ operation, error }) => {
        const message =
          error instanceof Error
            ? error.message
            : "An unexpected error occurred";
        onError({ operation, message });
      },
    });

    // ── Seed initial demo data ─────────────────────────────────────────
    // Zustand store is a module singleton — this block only runs once
    // even across React hot-reloads.
    if (mgr.getResourceCount() === 0) {
      mgr.addResource({ id: "r1", name: "Dr. Sarah Chen", type: "person" });
      mgr.addResource({ id: "r2", name: "Dr. Michael Ross", type: "person" });
      mgr.addResource({ id: "r3", name: "Operating Room 1", type: "room" });
      mgr.addResource({ id: "r4", name: "MRI Scanner A", type: "equipment" });
      mgr.addResource({ id: "r5", name: "MRI Scanner B", type: undefined });
      mgr.addResource({ id: "r6", name: "Dr. Alan Turing", type: "person" });
      mgr.addResource({ id: "r7", name: "Dr. Max Dev", type: "person" });
      mgr.addResource({ id: "r8", name: "Operating Room 2", type: "room" });

      console.log("Assignments", mgr.getAssignmentsByEvent("e1"));

      const today = new Date().toISOString().split("T")[0];
      const tz = getBrowserTimezone();
      mgr.addEvent({
        id: "e1",
        title: "Appendectomy",
        startTime: zonedInputToISO(today, "09:00", tz),
        endTime: zonedInputToISO(today, "11:30", tz),
        resourceIds: ["r1", "r3"],
        status: "confirmed",
      });
      mgr.addEvent({
        id: "e2",
        title: "Pre-op Assessment",
        startTime: zonedInputToISO(today, "13:00", tz),
        endTime: zonedInputToISO(today, "14:00", tz),
        resourceIds: ["r2"],
        status: "confirmed",
      });
    }

    return mgr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // manager is intentionally created once

  return manager;
}
