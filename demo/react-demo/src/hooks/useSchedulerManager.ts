import { useMemo, useState } from "react";
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
  const [canUndo, setCanUndo] = useState(false);

  const manager = useMemo(() => {
    const mgr = new SchedulerManager({
      onEventAdd: async (event) => {
        // Example of the actual fetch you would do in production:
        // const res = await fetch('/api/events', { method: 'POST', body: JSON.stringify(event) });
        // if (!res.ok) throw new Error(`Server error ${res.status}`);

        // Simulated network latency for demo
        await new Promise((r) => setTimeout(r, 400));
        console.log("onEventAdd:", event);
      },

      onEventUpdate: async (event) => {
        // Example of the actual fetch you would do in production:
        // const res = await fetch(`/api/events/${event.id}`, { method: 'PATCH', body: JSON.stringify(event) });
        // if (!res.ok) throw new Error(`Server error ${res.status}`);

        await new Promise((r) => setTimeout(r, 400));
        console.log("onEventUpdate:", event);
      },

      onEventDelete: async (id) => {
        // Example of the actual fetch you would do in production:
        // const res = await fetch(`/api/events/${id}`, { method: 'DELETE' });
        // if (!res.ok) throw new Error(`Server error ${res.status}`);

        await new Promise((r) => setTimeout(r, 400));
        console.log("onEventDelete:", id);
      },

      onResourceAdd: async (resource) => {
        // const res = await fetch('/api/resources', { method: 'POST', body: JSON.stringify(resource) });
        // if (!res.ok) throw new Error(`Server error ${res.status}`);

        await new Promise((r) => setTimeout(r, 400));
        console.log("onResourceAdd:", resource);
      },

      onResourceUpdate: async (resource) => {
        // const res = await fetch(`/api/resources/${resource.id}`, { method: 'PATCH', body: JSON.stringify(resource) });
        // if (!res.ok) throw new Error(`Server error ${res.status}`);

        await new Promise((r) => setTimeout(r, 400));
        console.log("onResourceUpdate:", resource);
      },

      onResourceDelete: async (id) => {
        // const res = await fetch(`/api/resources/${id}`, { method: 'DELETE' });
        // if (!res.ok) throw new Error(`Server error ${res.status}`);

        await new Promise((r) => setTimeout(r, 400));
        console.log("onResourceDelete:", id);
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

      onUndoStateChange: (can) => setCanUndo(can),
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

      // 2. Loop through the external payload and map it to Janus Scheduler format
      let importedEvents = 0;

      lmsData.courses.forEach((course) => {
        // Ensure the teacher (resource) exists before adding the event
        if (!manager.getResource(course.teacherId)) {
          manager.addResource({
            id: course.teacherId,
            name: course.teacherName,
            type: "person",
          });
        }

        // Check if event already exists
        if (!manager.getEvent(course.id)) {
          // Add the course as an event
          manager.addEvent({
            id: course.id,
            title: course.courseName,
            // Convert external dates to Javascript Epoch Timestamps (or ISO strings)
            startTime: course.startDate,
            endTime: course.endDate,
            resourceIds: [course.teacherId],
            status: "confirmed" as const,
          });
          importedEvents++;
        }
      });

      console.log(`Successfully synced ${importedEvents} events from LMS!`);
    } catch (error) {
      console.error("Failed to sync from LMS:", error);
      alert("Synchronization failed. Please check the logs.");
    }
  };

  return { manager, syncBulkEvents, canUndo };
}
