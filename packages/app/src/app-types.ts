import type { Event as JanusEvent, ViewType } from "@janus-scheduler/core";

/** What kind of store mutation a `change` event describes. */
export type JanusAppChangeType = "add" | "update" | "delete";

/**
 * Payload of the `change` event. `<janus-app>` writes to the store itself, so
 * this is how a host learns what happened in order to persist it.
 *
 * For `"delete"` only `id` is set; `event` is undefined because the event is
 * already gone from the store by the time the hook fires.
 */
export interface JanusAppChangeDetail {
  type: JanusAppChangeType;
  id: string;
  event?: JanusEvent;
}

/** Payload of the `app-error` event — a lifecycle hook rejected and the store was rolled back. */
export interface JanusAppErrorDetail {
  operation: string;
  error: unknown;
  reverted: boolean;
}

/** Payload of the `view-change` event. */
export interface JanusAppViewChangeDetail {
  view: ViewType;
}

/** Data accepted by `<janus-app>.load()`. */
export interface JanusAppData {
  events?: unknown[];
  resources?: unknown[];
}
