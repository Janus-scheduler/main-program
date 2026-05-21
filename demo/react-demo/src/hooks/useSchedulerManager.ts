import { useMemo, useEffect } from "react";
import {
  SchedulerManager,
  secureApiClient,
  schedulerStore,
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
 * to a backend and handle errors.
 *
 * @param onError - called when any async hook rejects after a store rollback
 * @returns the configured SchedulerManager instance (stable across renders)
 */
export function useSchedulerManager(
  onError: (err: HookError) => void,
  isSecure: boolean = false,
  isAuthenticated: boolean = false,
) {
  const manager = useMemo(() => {
    const mgr = new SchedulerManager({
      // ── onEventAdd ────────────────────────────────────────────────────
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

      // ── onResourceAdd ─────────────────────────────────────────────────
      onResourceAdd: async (_resource) => {
        if (isSecure) {
          await secureApiClient.secureFetch(
            "http://localhost:3001/api/secure/resources",
            "POST",
            _resource,
          );
        } else {
          await fetch("http://localhost:3001/api/insecure/resources", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(_resource),
          });
        }
      },

      onResourceUpdate: async (resource) => {
        if (isSecure) {
          await secureApiClient.secureFetch(
            `http://localhost:3001/api/secure/resources/${resource.id}`,
            "PUT",
            resource,
          );
        } else {
          await fetch(
            `http://localhost:3001/api/insecure/resources/${resource.id}`,
            {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(resource),
            },
          );
        }
      },

      onResourceDelete: async (id) => {
        if (isSecure) {
          await secureApiClient.secureFetch(
            `http://localhost:3001/api/secure/resources/${id}`,
            "DELETE",
          );
        } else {
          await fetch(`http://localhost:3001/api/insecure/resources/${id}`, {
            method: "DELETE",
          });
        }
      },

      // ── onError ───────────────────────────────────────────────────────
      // The store has already been rolled back before this fires.
      onError: ({ operation, error }) => {
        const message =
          error instanceof Error
            ? error.message
            : "An unexpected error occurred";
        onError({ operation, message });
      },
    });

    return mgr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSecure]); // manager is recreated when isSecure toggles so hooks use updated state

  // ── Initial Data Fetching ─────────────────────────────────────────
  useEffect(() => {
    async function loadData() {
      try {
        //eslint-disable-next-line @typescript-eslint/no-explicit-any
        let data: any = null;
        if (isSecure) {
          // If we are in secure mode, we MUST be authenticated to fetch data
          if (!isAuthenticated) return;

          data = await secureApiClient.secureFetch(
            "http://localhost:3001/api/secure/data",
            "GET",
          );
        } else {
          // Insecure mode
          const res = await fetch("http://localhost:3001/api/insecure/data");
          if (res.ok) {
            data = await res.json();
          }
        }

        if (data) {
          schedulerStore.getState().clearAll();
          if (data.resources) {
            //eslint-disable-next-line @typescript-eslint/no-explicit-any
            data.resources.forEach((r: any) =>
              schedulerStore.getState().addResource(r),
            );
          }
          if (data.events) {
            //eslint-disable-next-line @typescript-eslint/no-explicit-any
            data.events.forEach((e: any) =>
              schedulerStore.getState().addEvent(e),
            );
          }
        }
      } catch (err) {
        console.error("Failed to load initial data", err);
      }
    }

    loadData();
  }, [manager, isSecure, isAuthenticated]);

  return manager;
}
