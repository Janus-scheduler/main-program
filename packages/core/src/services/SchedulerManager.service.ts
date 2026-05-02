import { Event } from "../models/events/event";
import { Resource, ResourceData } from "../models/resources/resources";
import { Assignment, AssignmentData } from "../models/assignments/assignments";
import { EventData } from "../types/event.types";
import { schedulerStore } from "../store/scheduler.store";

// ─────────────────────────────────────────────────────────────────────────────
// Lifecycle hooks — provided by the host application.
//
// Pattern: Optimistic Update + Automatic Rollback (Option C)
//
//  1. The store is updated immediately → UI re-renders with no perceived lag.
//  2. The async hook fires (e.g. your fetch() to a backend API).
//  3a. Hook resolves → done, nothing more to do.
//  3b. Hook rejects → the store change is automatically rolled back and
//      `onError` is called so you can display an error to the user.
//
// All hooks are optional. Omit any you do not need.
// ─────────────────────────────────────────────────────────────────────────────
export interface SchedulerHooks {
  // ── Event lifecycle ────────────────────────────────────────────────────────
  onEventAdd?: (event: Event) => void | Promise<void>;
  onEventUpdate?: (event: Event) => void | Promise<void>;
  onEventDelete?: (id: string) => void | Promise<void>;

  // ── Resource lifecycle ─────────────────────────────────────────────────────
  onResourceAdd?: (resource: Resource) => void | Promise<void>;
  onResourceUpdate?: (resource: Resource) => void | Promise<void>;
  onResourceDelete?: (id: string) => void | Promise<void>;

  // ── Assignment lifecycle ───────────────────────────────────────────────────
  onAssignmentAdd?: (assignment: Assignment) => void | Promise<void>;
  onAssignmentDelete?: (id: string) => void | Promise<void>;

  // ── Error handler ──────────────────────────────────────────────────────────
  /**
   * Called whenever any async hook rejects (e.g. a fetch() fails).
   * The store change that triggered the hook has already been rolled back
   * by the time this fires, so the UI has reverted to the previous state.
   *
   * Use this hook to show an error notification to your user, e.g.:
   *   onError: ({ operation, error }) => toast.error(`${operation} failed: ${error.message}`)
   *
   * @param ctx.operation  - Name of the method that failed, e.g. "addEvent"
   * @param ctx.error      - The raw rejection value from your hook
   * @param ctx.reverted   - Always true — the store was rolled back automatically
   */
  onError?: (ctx: {
    operation: string;
    error: unknown;
    reverted: boolean;
  }) => void;
}

/**
 * SchedulerManager
 *
 * The single public API surface for reading and writing scheduler data.
 * Internally it writes to the Zustand vanilla store (which drives UI reactivity)
 * and then fires the matching lifecycle hook so the host application can persist
 * the change to its own backend.
 *
 * If the async hook rejects (e.g. a network error), the store is automatically
 * rolled back and `onError` is called — the host only needs to display a message.
 *
 * @example
 * ```ts
 * const manager = new SchedulerManager({
 *   onEventAdd: async (event) => {
 *     await fetch('/api/events', { method: 'POST', body: JSON.stringify(event) });
 *   },
 *   onEventUpdate: async (event) => {
 *     await fetch(`/api/events/${event.id}`, { method: 'PATCH', body: JSON.stringify(event) });
 *   },
 *   onEventDelete: async (id) => {
 *     await fetch(`/api/events/${id}`, { method: 'DELETE' });
 *   },
 *   onError: ({ operation, error }) => {
 *     // The UI has already reverted — just show a notification
 *     toast.error(`"${operation}" failed. Your change has been undone.`);
 *     console.error(error);
 *   },
 * });
 * ```
 */
export class SchedulerManager {
  private readonly _hooks: SchedulerHooks;

  constructor(hooks: SchedulerHooks = {}) {
    this._hooks = hooks;
  }

  // ── Private helper ─────────────────────────────────────────────────────────

  /**
   * Fires an optional async hook and, if it rejects, runs the rollback
   * function then calls onError.
   *
   * @param operation - Method name shown in the error context
   * @param hook      - The promise returned by the hook (may be undefined)
   * @param rollback  - Undoes the optimistic store write
   */
  private _fireHook(
    operation: string,
    hook: void | Promise<void>,
    rollback: () => void,
  ): void {
    if (!hook) return; // hook was synchronous (returned void) — nothing to catch
    hook.catch((error: unknown) => {
      rollback();
      this._hooks.onError?.({ operation, error, reverted: true });
    });
  }

  // ============ EVENT FUNCTIONS ============

  /**
   * Optimistically adds an event to the store, then fires `onEventAdd`.
   * If the hook rejects, the event is removed from the store and `onError` fires.
   *
   * @param data - Raw event data
   * @returns The created Event instance (already visible in the UI)
   */
  addEvent(data: EventData): Event {
    const event = schedulerStore.getState().addEvent(data);

    this._fireHook("addEvent", this._hooks.onEventAdd?.(event), () =>
      schedulerStore.getState().deleteEvent(event.id),
    );

    return event;
  }

  /**
   * Get a single event by ID.
   * @param id - Event ID
   * @returns Event if found, undefined otherwise
   */
  getEvent(id: string): Event | undefined {
    return schedulerStore.getState().events[id];
  }

  /**
   * Get all events currently in the store.
   * @returns Array of all Event instances
   */
  getAllEvents(): Event[] {
    return Object.values(schedulerStore.getState().events);
  }

  /**
   * Optimistically updates an event in the store, then fires `onEventUpdate`.
   * If the hook rejects, the event is restored to its previous state and `onError` fires.
   *
   * @param id      - Event ID
   * @param updates - Partial event fields to update
   * @returns The updated Event instance (already visible in the UI)
   */
  updateEvent(id: string, updates: Partial<EventData>): Event {
    // Snapshot the previous values before the optimistic write
    const previous = schedulerStore.getState().events[id];
    const event = schedulerStore.getState().updateEvent(id, updates);

    this._fireHook("updateEvent", this._hooks.onEventUpdate?.(event), () => {
      if (previous) {
        // Restore previous field values
        schedulerStore.getState().updateEvent(id, {
          title: previous.title,
          startTime: previous.startTime,
          endTime: previous.endTime,
          status: previous.status,
          description: previous.description,
        });
      }
    });

    return event;
  }

  /**
   * Optimistically deletes an event from the store, then fires `onEventDelete`.
   * If the hook rejects, the event is re-added to the store and `onError` fires.
   *
   * @param id - Event ID
   * @returns true if the event was found and deleted, false otherwise
   */
  deleteEvent(id: string): boolean {
    // Snapshot before deletion so we can restore it
    const snapshot = schedulerStore.getState().events[id];
    const deleted = schedulerStore.getState().deleteEvent(id);

    if (deleted) {
      this._fireHook("deleteEvent", this._hooks.onEventDelete?.(id), () => {
        if (snapshot) schedulerStore.getState().addEvent(snapshot);
      });
    }

    return deleted;
  }

  /**
   * Get all events assigned to a specific resource.
   * @param resourceId - Resource ID
   * @returns Filtered array of Event instances
   */
  getEventsByResource(resourceId: string): Event[] {
    return this.getAllEvents().filter((e) => e.resourceId === resourceId);
  }

  /**
   * Get all events that start on a specific calendar date.
   * @param date - Date string in YYYY-MM-DD format
   * @returns Filtered array of Event instances
   */
  getEventsByDate(date: string): Event[] {
    const targetDate = new Date(date).toISOString().split("T")[0];
    return this.getAllEvents().filter((event) => {
      const eventDate = new Date(event.startTime).toISOString().split("T")[0];
      return eventDate === targetDate;
    });
  }

  // ============ RESOURCE FUNCTIONS ============

  /**
   * Optimistically adds a resource to the store, then fires `onResourceAdd`.
   * If the hook rejects, the resource is removed from the store and `onError` fires.
   *
   * @param data - Raw resource data
   * @returns The created Resource instance (already visible in the UI)
   */
  addResource(data: ResourceData): Resource {
    const resource = schedulerStore.getState().addResource(data);

    this._fireHook("addResource", this._hooks.onResourceAdd?.(resource), () =>
      schedulerStore.getState().deleteResource(resource.id),
    );

    return resource;
  }

  /**
   * Get a single resource by ID.
   * @param id - Resource ID
   * @returns Resource if found, undefined otherwise
   */
  getResource(id: string): Resource | undefined {
    return schedulerStore.getState().resources[id];
  }

  /**
   * Get all resources currently in the store.
   * @returns Array of all Resource instances
   */
  getAllResources(): Resource[] {
    return Object.values(schedulerStore.getState().resources);
  }

  /**
   * Optimistically updates a resource in the store, then fires `onResourceUpdate`.
   * If the hook rejects, the resource is restored to its previous state and `onError` fires.
   *
   * @param id      - Resource ID
   * @param updates - Partial resource fields to update
   * @returns The updated Resource instance (already visible in the UI)
   */
  updateResource(id: string, updates: Partial<ResourceData>): Resource {
    const previous = schedulerStore.getState().resources[id];
    const resource = schedulerStore.getState().updateResource(id, updates);

    this._fireHook(
      "updateResource",
      this._hooks.onResourceUpdate?.(resource),
      () => {
        if (previous) {
          schedulerStore.getState().updateResource(id, {
            name: previous.name,
            type: previous.type,
            email: previous.email,
          });
        }
      },
    );

    return resource;
  }

  /**
   * Optimistically deletes a resource from the store, then fires `onResourceDelete`.
   * If the hook rejects, the resource is re-added to the store and `onError` fires.
   * Will throw synchronously if the resource has assigned events (store-level guard).
   *
   * @param id - Resource ID
   * @returns true if the resource was found and deleted
   */
  deleteResource(id: string): boolean {
    const snapshot = schedulerStore.getState().resources[id];
    const deleted = schedulerStore.getState().deleteResource(id);

    if (deleted) {
      this._fireHook(
        "deleteResource",
        this._hooks.onResourceDelete?.(id),
        () => {
          if (snapshot) schedulerStore.getState().addResource(snapshot);
        },
      );
    }

    return deleted;
  }

  // ============ ASSIGNMENT FUNCTIONS ============

  /**
   * Optimistically creates an assignment, then fires `onAssignmentAdd`.
   * If the hook rejects, the assignment is deleted from the store and `onError` fires.
   *
   * @param data - Assignment data
   * @returns The created Assignment instance (already visible in the UI)
   */
  addAssignment(data: AssignmentData): Assignment {
    const assignment = schedulerStore.getState().addAssignment(data);

    this._fireHook(
      "addAssignment",
      this._hooks.onAssignmentAdd?.(assignment),
      () => schedulerStore.getState().deleteAssignment(assignment.id),
    );

    return assignment;
  }

  /**
   * Get all assignments for a specific event.
   * @param eventId - Event ID
   * @returns Array of Assignment instances
   */
  getAssignmentsByEvent(eventId: string): Assignment[] {
    return Object.values(schedulerStore.getState().assignments).filter(
      (a) => a.eventId === eventId,
    );
  }

  /**
   * Get all assignments for a specific resource.
   * @param resourceId - Resource ID
   * @returns Array of Assignment instances
   */
  getAssignmentsByResource(resourceId: string): Assignment[] {
    return Object.values(schedulerStore.getState().assignments).filter(
      (a) => a.resourceId === resourceId,
    );
  }

  /**
   * Optimistically deletes an assignment, then fires `onAssignmentDelete`.
   * If the hook rejects, the assignment is re-added to the store and `onError` fires.
   *
   * @param id - Assignment ID
   * @returns true if deleted, false if not found
   */
  deleteAssignment(id: string): boolean {
    const snapshot = schedulerStore.getState().assignments[id];
    const deleted = schedulerStore.getState().deleteAssignment(id);

    if (deleted) {
      this._fireHook(
        "deleteAssignment",
        this._hooks.onAssignmentDelete?.(id),
        () => {
          if (snapshot) schedulerStore.getState().addAssignment(snapshot);
        },
      );
    }

    return deleted;
  }

  // ============ UTILITY FUNCTIONS ============

  /**
   * Total number of events currently in the store.
   */
  getEventCount(): number {
    return Object.keys(schedulerStore.getState().events).length;
  }

  /**
   * Total number of resources currently in the store.
   */
  getResourceCount(): number {
    return Object.keys(schedulerStore.getState().resources).length;
  }

  /**
   * Remove all events, resources, and assignments from the store.
   * Does NOT fire individual delete hooks — use this only for full resets
   * (e.g. on logout or when switching tenants).
   */
  clearAll(): void {
    schedulerStore.getState().clearAll();
  }
}

export default SchedulerManager;
