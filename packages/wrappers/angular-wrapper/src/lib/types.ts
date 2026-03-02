/**
 * Angular Wrapper Types
 *
 * These interfaces mirror the core package types to preserve
 * framework-agnostic design. The core logic lives in @janus-scheduler/core,
 * and this wrapper adds Angular-specific DI, signals, and component bindings.
 */

// ─── Event Types ────────────────────────────────────────────────────────────

export interface JanusEventData {
  id: string;
  title: string;
  /** ISO 8601 date-time string, e.g. "2025-02-18T14:00:00Z" */
  startTime: string;
  /** ISO 8601 date-time string */
  endTime: string;
  resourceId: string;
  status?: "draft" | "confirmed" | "cancelled";
  description?: string;
  /** Optional extra metadata – stays framework-agnostic */
  meta?: Record<string, unknown>;
}

// ─── Resource Types ──────────────────────────────────────────────────────────

export interface JanusResourceData {
  id: string;
  name: string;
  type: string;
  email?: string;
  meta?: Record<string, unknown>;
}

// ─── Assignment Types ────────────────────────────────────────────────────────

export interface JanusAssignmentData {
  id: string;
  eventId: string;
  resourceId: string;
}

// ─── Scheduler Config ────────────────────────────────────────────────────────

export interface SchedulerConfig {
  /** Start hour shown in the day view (default: 0) */
  startHour?: number;
  /** End hour shown in the day view (default: 24) */
  endHour?: number;
  /** Default view mode */
  defaultView?: "day" | "week" | "month";
  /** Slot duration in minutes (default: 30) */
  slotDuration?: number;
  /** Whether to allow drag-and-drop (default: false) */
  enableDrag?: boolean;
  /** Whether to allow event resize (default: false) */
  enableResize?: boolean;
}

// ─── View State ──────────────────────────────────────────────────────────────

export type SchedulerView = "day" | "week" | "month";

export interface SchedulerState {
  events: JanusEventData[];
  resources: JanusResourceData[];
  assignments: JanusAssignmentData[];
  selectedEventId: string | null;
  currentView: SchedulerView;
  currentDate: Date;
}

// ─── Output Event Payloads ───────────────────────────────────────────────────

export interface EventClickPayload {
  event: JanusEventData;
  sourceEvent: MouseEvent;
}

export interface EventCreatePayload {
  data: Omit<JanusEventData, "id">;
  suggestedId: string;
}

export interface EventUpdatePayload {
  id: string;
  changes: Partial<JanusEventData>;
}

export interface EventDeletePayload {
  id: string;
}

export interface ResourceClickPayload {
  resource: JanusResourceData;
  sourceEvent: MouseEvent;
}
