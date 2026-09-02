# @janus-scheduler/core

The framework-agnostic engine behind **Janus Scheduler**: a vanilla Zustand store, the `SchedulerManager` facade, domain models, timezone-aware conflict detection, and RRule recurrence expansion.

```bash
npm install @janus-scheduler/core
```

> **You probably don't need to install this directly.** It comes with every framework package (`@janus-scheduler/react`, `/angular`, `/solid`) and with `@janus-scheduler/app`, each of which re-exports everything here. Install it on its own only if you are building your own UI on top of the engine.

## SchedulerManager

The public API. Every mutating method is **optimistic with automatic rollback**: it writes to the store immediately so the UI never lags, then fires the matching lifecycle hook. If that hook throws or its promise rejects, the store change is reverted and `onError` fires.

```ts
import { SchedulerManager } from "@janus-scheduler/core";

const manager = new SchedulerManager({
  onEventAdd: (event) => api.create(event), // reverted if this rejects
  onEventUpdate: (event) => api.update(event),
  onEventDelete: (id) => api.remove(id),
  onError: ({ operation, error, reverted }) =>
    console.error(operation, error, reverted),
});

manager.addResource({
  id: "r1",
  name: "Alice",
  type: "person", // "person" requires a non-empty email
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
```

Events: `addEvent`, `batchAddEvents`, `updateEvent`, `deleteEvent`, `getEvent`, `getAllEvents`, `getEventsByResource`, `getEventsByDate`, `getEventCount`.
Resources: `addResource`, `updateResource`, `deleteResource`, `getResource`, `getAllResources`, `getResourceCount`.
Assignments: `addAssignment`, `deleteAssignment`, `getAssignmentsByEvent`, `getAssignmentsByResource`.
Undo: `canUndo`, `peekUndo`, `undo`, `subscribeUndo`.
Other: `getTimezone`, `clearAll`.

## The store

`SchedulerManager` has **no `.store` property**. Import the store directly. `events` and `resources` are `Record<string, T>`, not arrays:

```ts
import { schedulerStore } from "@janus-scheduler/core";

const unsubscribe = schedulerStore.subscribe((state) => {
  console.log(Object.values(state.events));
});
```

It is a module-level singleton — one scheduler per page. Do not write to it directly from application code; go through `SchedulerManager` so hooks and rollback still apply.

## Conflict detection

```ts
import {
  computeTimelineConflicts,
  checkSlotConflict,
} from "@janus-scheduler/core";
```

Timezone-aware double-booking detection across resources. The UI packages use these to drive the warning banner and the blocking dialog.

## Recurrence

```ts
import { expandEvents } from "@janus-scheduler/core";
```

Expands an event's `recurrenceRule` (an RRule string) into concrete occurrences. Occurrence ids follow `<parentId>_occ_<timestampMs>`, and `getEvent` / `updateEvent` / `deleteEvent` resolve them back to the parent automatically.

## Timezone utilities

`getBrowserTimezone`, `isoToZonedDisplay`, `zonedInputToISO`, `getUtcMsForZonedDatetime`, `formatTimezoneLabel`, `getAllTimezones`.

Events are stored as UTC ISO strings; these convert to and from wall-clock date + time in a given IANA zone.

## Documentation

Full docs and the framework packages: [Janus-scheduler/main-program](https://github.com/Janus-scheduler/main-program).

## Licence

ISC
