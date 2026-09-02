# @janus-scheduler/solid

The official SolidJS wrapper for **Janus Scheduler** — a customizable, timezone-aware scheduling timeline and calendar for modern web apps.

```bash
npm install @janus-scheduler/solid
```

`@janus-scheduler/core`, `/ui` and `/nlp` come with it. You import from this package only.

> **Want it wired for you?** This package gives you the building blocks. If you just want a working scheduler in one line, use [`@janus-scheduler/app`](https://www.npmjs.com/package/@janus-scheduler/app) — `<janus-app>` is a plain custom element, so Solid renders it directly.

## Quick start

The components render from a shared store and never write to it. You create a `SchedulerManager`, seed it, and turn callbacks into manager calls.

```tsx
import { Timeline, SchedulerManager } from "@janus-scheduler/solid";

// Create the manager once, at module scope.
const manager = new SchedulerManager();

// A resource of type "person" requires a non-empty email.
manager.addResource({
  id: "r1",
  name: "Alice",
  type: "person",
  email: "alice@example.com",
});

manager.addEvent({
  id: "e1",
  title: "Standup",
  startTime: "2026-09-02T09:00:00.000Z",
  endTime: "2026-09-02T09:30:00.000Z",
  resourceIds: ["r1"],
  status: "confirmed",
});

export default function App() {
  return (
    <div style={{ height: "100vh" }}>
      <Timeline
        showFab
        allowCreate
        onEventMove={({
          event,
          oldResourceId,
          newResourceId,
          newStartTime,
          newEndTime,
        }) => {
          const current = manager.getEvent(event.id);
          if (!current) return;
          manager.updateEvent(event.id, {
            resourceIds: current.resourceIds.map((id) =>
              id === oldResourceId ? newResourceId : id,
            ),
            startTime: newStartTime,
            endTime: newEndTime,
          });
        }}
        onEventResize={({ event, newStartTime, newEndTime }) => {
          manager.updateEvent(event.id, {
            startTime: newStartTime,
            endTime: newEndTime,
          });
        }}
      />
    </div>
  );
}
```

Give the container a real height — the components fill their parent.

## Reading state

`SchedulerManager` has **no `.store` property**. Subscribe to the store directly, and note that `events` and `resources` are `Record<string, T>`, not arrays:

```tsx
import { createSignal, onCleanup } from "solid-js";
import { schedulerStore } from "@janus-scheduler/solid";

const [events, setEvents] = createSignal(
  Object.values(schedulerStore.getState().events),
);
const unsubscribe = schedulerStore.subscribe((state) =>
  setEvents(Object.values(state.events)),
);
onCleanup(unsubscribe);
```

## Persisting changes

Every mutating method writes to the store immediately, then fires a lifecycle hook. **If the hook throws or rejects, the store change is rolled back** and `onError` fires:

```tsx
const manager = new SchedulerManager({
  onEventAdd: (event) => api.create(event), // reverted if this rejects
  onEventUpdate: (event) => api.update(event),
  onEventDelete: (id) => api.remove(id),
  onError: ({ operation, error }) => toast(`${operation} failed`),
});
```

## Components

`Timeline`, `DayGrid`, `WeekGrid`, `MonthGrid`, `YearGrid`, `Scheduler` (the event editor modal), `Topbar`, `Chat`, `AiBar`.

Callbacks receive the unwrapped payload — you never touch a raw `CustomEvent`.

Navigation is imperative, via a ref:

```tsx
let ref;
<Timeline ref={ref} />;
ref.goToNext(); // also goToPrev, goToToday, goToDate(date)
```

## Conflict prevention

`preventConflicts` defaults to **`false`**: conflicts are allowed and surfaced as a dismissible banner plus per-event badges. Set it to `true` to block the action outright.

```tsx
<Timeline
  preventConflicts
  onConflictDetected={({ message, action }) => {
    console.warn(`Double-booking prevented during ${action}: ${message}`);
  }}
/>
```

`onConflictDetected` is cancelable — call `preventDefault()` on the underlying event to replace the built-in blocking dialog with your own.

## Theming

No stylesheet to import. Everything is Shadow-DOM scoped; theme with the `--janus-*` CSS custom properties.

## Documentation

Full docs, architecture and the other framework packages: [Janus-scheduler/main-program](https://github.com/Janus-scheduler/main-program).

## Licence

ISC
