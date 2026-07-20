import { Event } from "../models/events/event";
import { Resource, ResourceData } from "../models/resources/resources";
import { Assignment, AssignmentData } from "../models/assignments/assignments";
import { EventData } from "../types/event.types";
import { schedulerStore } from "../store/scheduler.store";

const OP_ADD_EVENT = "addEvent";
const OP_UPDATE_EVENT = "updateEvent";
const OP_DELETE_EVENT = "deleteEvent";

const OP_ADD_RESOURCE = "addResource";
const OP_UPDATE_RESOURCE = "updateResource";
const OP_DELETE_RESOURCE = "deleteResource";

const OP_ADD_ASSIGNMENT = "addAssignment";
const OP_DELETE_ASSIGNMENT = "deleteAssignment";

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
   * Called whenever any hook fails — either throws synchronously or returns a
   * rejected Promise (e.g. a failed fetch()). The store change that triggered
   * the hook has already been rolled back by the time this fires, so the UI
   * has reverted to the previous state.
   *
   * Use this hook to show an error notification to your user, e.g.:
   *   onError: ({ operation, error }) => toast.error(`${operation} failed: ${error.message}`)
   *
   * @param ctx.operation  - Name of the method that failed, e.g. OP_ADD_EVENT
   * @param ctx.error      - The raw thrown/rejected value from your hook
   * @param ctx.reverted   - Always true — the store was rolled back automatically
   */
  onError?: (ctx: {
    operation: string;
    error: unknown;
    reverted: boolean;
  }) => void;

  // ── Undo handler ──────────────────────────────────────────────────────────
  /**
   * Called whenever the undo stack's availability changes.
   */
  onUndoStateChange?: (canUndo: boolean) => void;
}

export type UndoAction =
  | { type: "addEvent"; id: string }
  | { type: "updateEvent"; id: string; previous: Partial<EventData> }
  | { type: "deleteEvent"; previous: EventData };

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
  private _undoStack: UndoAction[] = [];
  private _isUndoing = false;

  constructor(hooks: SchedulerHooks = {}) {
    this._hooks = hooks;
  }

  // ── Undo API ─────────────────────────────────────────────────────────────

  canUndo(): boolean {
    return this._undoStack.length > 0;
  }

  peekUndo(): UndoAction | undefined {
    return this._undoStack.at(-1);
  }

  undo(): void {
    if (!this.canUndo()) return;
    this._isUndoing = true;
    try {
      const action = this._undoStack.pop()!;
      switch (action.type) {
        case OP_ADD_EVENT:
          this.deleteEvent(action.id);
          break;
        case OP_UPDATE_EVENT:
          this.updateEvent(action.id, action.previous);
          break;
        case OP_DELETE_EVENT:
          this.addEvent(action.previous);
          break;
      }
    } finally {
      this._isUndoing = false;
      this._hooks.onUndoStateChange?.(this.canUndo());
    }
  }

  private _pushUndo(action: UndoAction) {
    if (this._isUndoing) return;
    this._undoStack.push(action);

    if (this._undoStack.length > 5) {
      this._undoStack.shift();
    }
    this._hooks.onUndoStateChange?.(this.canUndo());
  }

  // ── Private helper ─────────────────────────────────────────────────────────

  /**
   * Invokes an optional lifecycle hook inside a try/catch and, if it fails
   * (synchronous throw OR async rejection), runs the rollback then calls onError.
   *
   * The hook is passed as a **thunk** (`() => hook?.()`) so that invocation
   * happens inside the try block. Without this, a synchronous throw would
   * escape at the call site before _fireHook was entered, bypassing rollback.
   *
   * @param operation   - Method name shown in the error context, e.g. OP_ADD_EVENT
   * @param invokeHook  - Zero-arg function that calls the hook and returns its result
   * @param rollback    - Undoes the optimistic store write
   */
  private _fireHook(
    operation: string,
    invokeHook: () => void | Promise<void>,
    rollback: () => void,
  ): void {
    let result: void | Promise<void>;
    try {
      result = invokeHook();
    } catch (error: unknown) {
      // Synchronous throw — treat identically to an async rejection.
      rollback();
      this._hooks.onError?.({ operation, error, reverted: true });
      return;
    }
    // Async rejection path.
    result?.catch((error: unknown) => {
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

    this._pushUndo({ type: OP_ADD_EVENT, id: event.id });

    this._fireHook(
      OP_ADD_EVENT,
      () => this._hooks.onEventAdd?.(event),
      () => schedulerStore.getState().deleteEvent(event.id),
    );

    return event;
  }

  /**
   * Get a single event by ID.
   * @param id - Event ID
   * @returns Event if found, undefined otherwise
   */
  getEvent(id: string): Event | undefined {
    const baseId = id.replace(/_occ_\d+$/, "");
    return schedulerStore.getState().events[baseId];
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
    const occMatch = /^(.+)_occ_(\d+)$/.exec(id);
    const baseId = occMatch ? occMatch[1] : id;

    if (occMatch && updates.startTime) {
      this._shiftRecurrenceTimes(baseId, Number(occMatch[2]), updates);
    }

    const existing = schedulerStore.getState().events[baseId];
    const snapshot = existing
      ? {
          ...existing,
          resourceIds: existing.resourceIds
            ? [...existing.resourceIds]
            : undefined,
        }
      : null;

    const event = schedulerStore.getState().updateEvent(baseId, updates);

    if (snapshot) {
      this._pushUndo({
        type: OP_UPDATE_EVENT,
        id: baseId,
        previous: {
          title: snapshot.title,
          startTime: snapshot.startTime,
          endTime: snapshot.endTime,
          status: snapshot.status,
          description: snapshot.description,
          resourceId: snapshot.resourceId,
          resourceIds: snapshot.resourceIds,
          color: snapshot.color,
          allDay: snapshot.allDay,
          recurrenceRule: snapshot.recurrenceRule,
        },
      });
    }

    this._fireHook(
      OP_UPDATE_EVENT,
      () => this._hooks.onEventUpdate?.(event),
      () => {
        if (snapshot) {
          // Roll back original values including resourceIds
          schedulerStore.getState().updateEvent(baseId, {
            title: snapshot.title,
            startTime: snapshot.startTime,
            endTime: snapshot.endTime,
            status: snapshot.status,
            description: snapshot.description,
            resourceId: snapshot.resourceId,
            resourceIds: snapshot.resourceIds,
            color: snapshot.color,
            allDay: snapshot.allDay,
            recurrenceRule: snapshot.recurrenceRule,
          });
        }
      },
    );

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
    const baseId = id.replace(/_occ_\d+$/, "");
    const snapshot = schedulerStore.getState().events[baseId];
    const deleted = schedulerStore.getState().deleteEvent(baseId);

    if (deleted) {
      const prev = snapshot!;
      this._pushUndo({
        type: OP_DELETE_EVENT,
        previous: {
          id: prev.id,
          title: prev.title,
          startTime: prev.startTime,
          endTime: prev.endTime,
          status: prev.status,
          description: prev.description,
          resourceId: prev.resourceId,
          resourceIds: prev.resourceIds,
          color: prev.color,
          allDay: prev.allDay,
          recurrenceRule: prev.recurrenceRule,
        },
      });

      this._fireHook(
        OP_DELETE_EVENT,
        () => this._hooks.onEventDelete?.(baseId),
        () => {
          schedulerStore.getState().addEvent(prev);
        },
      );
    }

    return deleted;
  }

  /**
   * Get all events assigned to a specific resource.
   * @param resourceId - Resource ID
   * @returns Filtered array of Event instances
   */
  getEventsByResource(resourceId: string): Event[] {
    return this.getAllEvents().filter(
      (e) => e.resourceIds?.includes(resourceId) || e.resourceId === resourceId,
    );
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

    this._fireHook(
      OP_ADD_RESOURCE,
      () => this._hooks.onResourceAdd?.(resource),
      () => schedulerStore.getState().deleteResource(resource.id),
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
    // Shallow-clone before the store write — same reason as updateEvent.
    // Without the spread, `snapshot` is a reference that the store may
    // mutate in-place, causing the rollback to restore the new values.
    const existing = schedulerStore.getState().resources[id];
    const snapshot = existing ? { ...existing } : null;

    const resource = schedulerStore.getState().updateResource(id, updates);

    this._fireHook(
      OP_UPDATE_RESOURCE,
      () => this._hooks.onResourceUpdate?.(resource),
      () => {
        if (snapshot) {
          schedulerStore.getState().updateResource(id, {
            name: snapshot.name,
            type: snapshot.type,
            email: snapshot.email,
            avatar: snapshot.avatar,
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
        OP_DELETE_RESOURCE,
        () => this._hooks.onResourceDelete?.(id),
        () => {
          schedulerStore.getState().addResource(snapshot!);
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
      OP_ADD_ASSIGNMENT,
      () => this._hooks.onAssignmentAdd?.(assignment),
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
        OP_DELETE_ASSIGNMENT,
        () => this._hooks.onAssignmentDelete?.(id),
        () => {
          schedulerStore.getState().addAssignment(snapshot!);
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
    this._undoStack = [];
    this._hooks.onUndoStateChange?.(this.canUndo());
  }
  // ── Helpers ────────────────────────────────────────────────────────────────

  private _shiftRecurrenceTimes(
    baseId: string,
    originalOccStartMs: number,
    updates: Partial<EventData>,
  ) {
    if (!updates.startTime) return;
    const newStartMs = new Date(updates.startTime).getTime();
    const deltaMs = newStartMs - originalOccStartMs;

    const parentEvent = schedulerStore.getState().events[baseId];
    if (parentEvent) {
      const parentStartMs = new Date(parentEvent.startTime).getTime();
      const parentEndMs = new Date(parentEvent.endTime).getTime();
      updates.startTime = new Date(parentStartMs + deltaMs).toISOString();
      updates.endTime = new Date(parentEndMs + deltaMs).toISOString();
    }
  }
}

export default SchedulerManager;
