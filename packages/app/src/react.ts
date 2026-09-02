/**
 * `@janus-scheduler/app/react` — the React binding for `<janus-app>`.
 *
 * React 18 cannot set properties (only string attributes) on a custom element,
 * and neither version gives you typed `CustomEvent` callbacks. `@lit/react`'s
 * `createComponent` solves both, and the wrappers here additionally unwrap
 * `event.detail` so consumers never touch a raw DOM event — the same Event
 * Unwrapping contract described in docs/ARCHITECTURE_FACADE.md.
 */
import * as React from "react";
import { createComponent } from "@lit/react";
import { JanusApp as JanusAppElement } from "./janus-app";
import type {
  JanusAppChangeDetail,
  JanusAppErrorDetail,
  JanusAppViewChangeDetail,
} from "./app-types";
import type {
  EventData,
  ResourceData,
  ResourceTypeConfig,
  SchedulerHooks,
  SchedulerManager,
  ViewType,
} from "@janus-scheduler/core";

const JanusAppBase = createComponent({
  tagName: "janus-app",
  elementClass: JanusAppElement,
  react: React,
  events: {
    onChangeEvent: "change",
    onAppError: "app-error",
    onViewChangeEvent: "view-change",
    onConnectCalendarEvent: "connect-calendar",
  },
});

export interface JanusAppProps {
  /** Initial events. Seeded once on mount — call `load()` on the ref to replace them. */
  events?: EventData[];
  /** Initial resources. Same one-shot seeding rule as {@link JanusAppProps.events}. */
  resources?: ResourceData[];
  /** The view shown on load. */
  view?: ViewType;
  /** Which views the topbar offers. */
  views?: ViewType[];
  /** Hard-block conflicting drags/resizes/saves instead of only warning. */
  preventConflicts?: boolean;
  /** Groups and labels resource rows on the timeline. */
  resourceTypeConfig?: ResourceTypeConfig;
  /** IANA timezone for display. Defaults to the store's. */
  timezone?: string;
  /** Render the Google Calendar button in its connected state. */
  googleConnected?: boolean;
  /** Lifecycle hooks forwarded to the internal manager — where you persist changes. */
  hooks?: SchedulerHooks;
  /** Bring your own manager instead of letting `<janus-app>` create one. */
  manager?: SchedulerManager;

  /** An event was added, updated or deleted. */
  onChange?: (detail: JanusAppChangeDetail) => void;
  /** A lifecycle hook rejected; the store has already been rolled back. */
  onError?: (detail: JanusAppErrorDetail) => void;
  /** The active view changed. */
  onViewChange?: (detail: JanusAppViewChangeDetail) => void;
  /** The topbar's Google Calendar button was clicked. */
  onConnectCalendar?: () => void;

  className?: string;
  style?: React.CSSProperties;
}

/**
 * A complete scheduler in one component.
 *
 * ```tsx
 * <JanusApp
 *   events={events}
 *   resources={resources}
 *   onChange={({ type, id }) => console.log(type, id)}
 * />
 * ```
 */
export const JanusApp = React.forwardRef<JanusAppElement, JanusAppProps>(
  (props, ref) => {
    const { onChange, onError, onViewChange, onConnectCalendar, ...rest } =
      props;

    return React.createElement(JanusAppBase, {
      ...rest,
      ref,
      // Intercept each CustomEvent and hand the consumer only `detail`.
      onChangeEvent: (e: Event) =>
        onChange?.((e as CustomEvent<JanusAppChangeDetail>).detail),
      onAppError: (e: Event) =>
        onError?.((e as CustomEvent<JanusAppErrorDetail>).detail),
      onViewChangeEvent: (e: Event) =>
        onViewChange?.((e as CustomEvent<JanusAppViewChangeDetail>).detail),
      onConnectCalendarEvent: () => onConnectCalendar?.(),
    });
  },
);

JanusApp.displayName = "JanusApp";

export { JanusAppElement };
export type {
  JanusAppChangeDetail,
  JanusAppChangeType,
  JanusAppData,
  JanusAppErrorDetail,
  JanusAppViewChangeDetail,
} from "./app-types";
