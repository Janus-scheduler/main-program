import { useMemo } from "react";
import {
  SchedulerManager,
  getBrowserTimezone,
  zonedInputToISO,
  secureApiClient,
} from "@janus-scheduler/core";

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
export function useSchedulerManager(
  onError: (err: HookError) => void,
  isSecure: boolean = false,
) {
  const manager = useMemo(() => {
    const mgr = new SchedulerManager({
      // ── onEventAdd ────────────────────────────────────────────────────
      // Fires AFTER the store is updated (optimistic). If this throws,
      // SchedulerManager automatically rolls back the store and calls onError.
      //
      // Replace with a real fetch() in production:
      //   await fetch('/api/events', { method: 'POST', body: JSON.stringify(event) })
      onEventAdd: async (_event) => {
        if (isSecure) {
          await secureApiClient.secureFetch(
            "http://localhost:3001/api/secure/events",
            "POST",
            _event,
          );
        } else {
          await fetch("http://localhost:3001/api/insecure/events", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(_event),
          });
        }
      },

      onEventUpdate: async (event) => {
        if (isSecure) {
          await secureApiClient.secureFetch(
            `http://localhost:3001/api/secure/events/${event.id}`,
            "PUT",
            event,
          );
        } else {
          await fetch(`http://localhost:3001/api/insecure/events/${event.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(event),
          });
        }
      },

      onEventDelete: async (id) => {
        if (isSecure) {
          await secureApiClient.secureFetch(
            `http://localhost:3001/api/secure/events/${id}`,
            "DELETE",
          );
        } else {
          await fetch(`http://localhost:3001/api/insecure/events/${id}`, {
            method: "DELETE",
          });
        }
      },

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

      const today = new Date().toISOString().split("T")[0];
      const tz = getBrowserTimezone();
      mgr.addEvent({
        id: "e1",
        title: "Appendectomy",
        startTime: zonedInputToISO(today, "09:00", tz),
        endTime: zonedInputToISO(today, "11:30", tz),
        resourceId: "r1",
        status: "confirmed",
      });
      mgr.addEvent({
        id: "e2",
        title: "Pre-op Assessment",
        startTime: zonedInputToISO(today, "13:00", tz),
        endTime: zonedInputToISO(today, "14:00", tz),
        resourceId: "r2",
        status: "confirmed",
      });
    }

    return mgr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSecure]); // manager is recreated when isSecure toggles so hooks use updated state

  return manager;
}
