import { useMemo, useSyncExternalStore, useCallback } from "react";
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
      ...syncManager.getHooks(),

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
        email: "michael.ross@example.com",
        avatar:
          "https://img.magnific.com/premium-photo/handsome-young-male-medical-doctor-portrait-with-stethoscope-hospital_744655-345.jpg?w=2000",
      });
      mgr.addResource({
        id: "r3",
        name: "Dr. Ann sherin",
        type: "person",
        email: "ann.sherin@example.com",
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
        email: "alan.turing@example.com",
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

  // Derived reactively from the manager's undo stack — no manual callback
  // wiring needed. Re-renders whenever the stack grows or shrinks.
  const canUndo = useSyncExternalStore(
    (onStoreChange) => manager.subscribeUndo(onStoreChange),
    () => manager.canUndo(),
  );

  const handleUndo = useCallback(() => manager.undo(), [manager]);

  const syncBulkEvents = async () => {
    try {
      // 1. Authenticate and fetch from the external API
      // We mock the fetch response here since https://api.theirlms.com is a placeholder.
      // In production you would do: const response = await fetch('https://api.theirlms.com/v1/courses', { ... })
      console.log("Fetching from LMS...");
      await new Promise((r) => setTimeout(r, 800)); // Simulate API latency

      // Mocked LMS Response Data
      const lmsData = {
        courses: [
          {
            id: "course_101",
            courseName: "Advanced Physiology",
            teacherId: "lms_t1",
            teacherName: "Dr. Gregory House",
            startDate: new Date(new Date().setHours(9, 0, 0, 0)).toISOString(),
            endDate: new Date(new Date().setHours(12, 0, 0, 0)).toISOString(),
          },
          {
            id: "course_102",
            courseName: "Neurology Seminar",
            teacherId: "lms_t2",
            teacherName: "Dr. Eric Foreman",
            startDate: new Date(new Date().setHours(14, 0, 0, 0)).toISOString(),
            endDate: new Date(new Date().setHours(16, 30, 0, 0)).toISOString(),
          },
        ],
      };

      // 2. Ensure resources exist, then collect new events for batch import
      const eventsToAdd: {
        id: string;
        title: string;
        startTime: string;
        endTime: string;
        resourceIds: string[];
        status: "confirmed";
      }[] = [];

      lmsData.courses.forEach((course) => {
        // Ensure the teacher (resource) exists before adding the event
        if (!manager.getResource(course.teacherId)) {
          manager.addResource({
            id: course.teacherId,
            name: course.teacherName,
            type: "person",
          });
        }

        // Collect new events (skip duplicates)
        if (!manager.getEvent(course.id)) {
          eventsToAdd.push({
            id: course.id,
            title: course.courseName,
            startTime: course.startDate,
            endTime: course.endDate,
            resourceIds: [course.teacherId],
            status: "confirmed" as const,
          });
        }
      });

      // 3. Batch-add all new events in one transactional call
      if (eventsToAdd.length > 0) {
        manager.batchAddEvents(eventsToAdd);
      }

      console.log(`Successfully synced ${eventsToAdd.length} events from LMS!`);
    } catch (error) {
      console.error("Failed to sync from LMS:", error);
      alert("Synchronization failed. Please check the logs.");
    }
  };

  return { manager, syncManager, canUndo, handleUndo, syncBulkEvents };
}
