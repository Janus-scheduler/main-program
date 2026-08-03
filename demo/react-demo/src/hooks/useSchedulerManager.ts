import { useMemo } from "react";
import {
  SchedulerManager,
  getBrowserTimezone,
  zonedInputToISO,
} from "@janus-scheduler/react";
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
 * Creates and seeds the SchedulerManager singleton for the demo app.
 * Also configures the lifecycle hooks that connect Janus mutations
 * to a backend (simulated here) and handle errors.
 *
 * @param onError - called when any async hook rejects after a store rollback
 * @returns `{ manager, syncManager }` — both stable across renders. The caller
 *   needs `syncManager` too (for the Google Calendar connect/disconnect and
 *   real-time sync lifecycle), so it's returned directly instead of being
 *   stashed on `window` for other components to reach into.
 */
export function useSchedulerManager(onError: (err: HookError) => void) {
  const { manager, syncManager } = useMemo(() => {
    // Set up Google sync infrastructure
    const client = new GoogleCalendarClient({ backendUrl: BACKEND_URL });
    const mapper = new GoogleEventMapper();
    const syncManager = new GoogleSyncManager(client, mapper);

    const mgr = new SchedulerManager({
      // ── onEventAdd ────────────────────────────────────────────────────
      // Fires AFTER the store is updated (optimistic). If this throws,
      // SchedulerManager automatically rolls back the store and calls onError.
      //
      ...syncManager.getHooks(),

      // Replace with a real fetch() in production:
      //   await fetch('/api/events', { method: 'POST', body: JSON.stringify(event) })
      // onEventAdd: async (_event) => {
      //   await new Promise((r) => setTimeout(r, 400)); // simulate network latency
      //   console.log(_event);
      //   return; // ← success path
      //   // throw new Error("HTTP 500 (simulated)"); // ← uncomment to test rollback
      // },

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
      // NOTE: email is required for a "person" resource to be synced to Google
      // Calendar as an attendee — replace these with real test Gmail addresses
      // to actually validate the Google Calendar integration end-to-end.
      mgr.addResource({
        id: "r1",
        name: "Dr. Sarah Chen",
        type: "person",
        email: "viduminisudeepa221@gmail.com",
        avatar:
          "https://tse4.mm.bing.net/th/id/OIP.Fg0RUhBQm2fns8AIOTXtJwHaHa?r=0&rs=1&pid=ImgDetMain&o=7&rm=3",
      });
      mgr.addResource({
        id: "r2",
        name: "Dr. Michael Ross",
        type: "person",
        avatar:
          "https://img.magnific.com/premium-photo/handsome-young-male-medical-doctor-portrait-with-stethoscope-hospital_744655-345.jpg?w=2000",
      });
      mgr.addResource({
        id: "r3",
        name: "Dr. Ann sherin",
        type: "person",
        avatar:
          "https://westernsydneydiabetes.com.au/uploads/2021/06/Rona-scaled.jpg",
      });
      mgr.addResource({
        id: "r4",
        name: "Operating Room 1",
        type: "room",
        avatar:
          "https://images.unsplash.com/photo-1551076805-e1869033e561?auto=format&fit=crop&q=80&w=120&h=120",
      });
      mgr.addResource({
        id: "r5",
        name: "MRI Scanner A",
        type: "equipment",
        avatar:
          "https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&q=80&w=120&h=120",
      });
      mgr.addResource({
        id: "r6",
        name: "MRI Scanner B",
        type: "equipment",
        avatar:
          "https://tse3.mm.bing.net/th/id/OIP.gB5vMFJ88MAKfv9CPhYJ9QHaE7?r=0&rs=1&pid=ImgDetMain&o=7&rm=3",
      });
      mgr.addResource({
        id: "r7",
        name: "Dr. Alan Turing",
        type: "person",
        avatar:
          "https://tse4.mm.bing.net/th/id/OIP.kqx_nQhmMAt1EtXnbBhOBwHaK0?r=0&w=832&h=1216&rs=1&pid=ImgDetMain&o=7&rm=3",
      });

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
        color: "primary",
      });
      mgr.addEvent({
        id: "e2",
        title: "Pre-op Assessment",
        startTime: zonedInputToISO(today, "13:00", tz),
        endTime: zonedInputToISO(today, "14:00", tz),
        resourceIds: ["r2"],
        status: "confirmed",
        color: "primary",
      });
    }

    return { manager: mgr, syncManager };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // manager is intentionally created once

  return { manager, syncManager };
}
