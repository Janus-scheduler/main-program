# @janus-scheduler/react

React components for **Janus Scheduler** — a customizable, timezone-aware scheduling timeline and calendar.

```bash
npm install @janus-scheduler/react
```

`@janus-scheduler/core`, `/ui` and `/nlp` come with it. You import from this package only.

---

## Quick start

`useJanusScheduler` owns every piece of wiring — the manager, all the drag/resize/create/save/delete handlers, navigation, the editor modal and undo. You write the layout and nothing else.

```tsx
import {
  useJanusScheduler,
  Timeline,
  MonthGrid,
  DayGrid,
  WeekGrid,
  YearGrid,
  Scheduler,
  Topbar,
} from "@janus-scheduler/react";

const resources = [
  { id: "r1", name: "Alice", type: "person", email: "alice@example.com" },
  { id: "r2", name: "Room A", type: "room", email: "" },
];

export default function App() {
  const janus = useJanusScheduler({ resources, events: [] });

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <Topbar {...janus.topbarProps} />

      <div style={{ flex: 1, minHeight: 0 }}>
        {janus.view === "Timeline" && <Timeline {...janus.timelineProps} />}
        {janus.view === "Month" && <MonthGrid {...janus.monthGridProps} />}
        {janus.view === "Day" && <DayGrid {...janus.dayGridProps} />}
        {janus.view === "Week" && <WeekGrid {...janus.weekGridProps} />}
        {janus.view === "Year" && <YearGrid {...janus.yearGridProps} />}
      </div>

      {janus.editor.isOpen && <Scheduler {...janus.editor.props} />}
    </div>
  );
}
```

That is a complete scheduler: five views, drag, resize, draw-to-create, the event editor, prev/next/today, view switching and Ctrl+Z. **Zero handler props, zero refs.**

> Give the container a real height — the components fill their parent.

### Want even less?

If you don't need custom layout, [`@janus-scheduler/app`](https://www.npmjs.com/package/@janus-scheduler/app) is the same thing as one element:

```tsx
import { JanusApp } from "@janus-scheduler/app/react";
<JanusApp resources={resources} events={events} />;
```

Use `useJanusScheduler` when you want to place the pieces yourself; use `<JanusApp>` when you don't.

---

## Persisting changes

Pass `hooks`. Every mutating method writes to the store immediately, then fires the matching hook. **If a hook throws or rejects, the store change is rolled back** — so the UI never drifts from your backend.

```tsx
const janus = useJanusScheduler({
  resources,
  events,
  hooks: {
    onEventAdd: (event) => api.create(event), // reverted if this rejects
    onEventUpdate: (event) => api.update(event),
    onEventDelete: (id) => api.remove(id),
    onError: ({ operation }) => toast(`${operation} failed`),
  },
});
```

For a plain notification rather than a persistence hook, use `onChange`:

```tsx
useJanusScheduler({ onChange: ({ type, id }) => console.log(type, id) });
```

---

## Customising

**Override any single prop** — spread order wins, so put yours after:

```tsx
<Timeline
  {...janus.timelineProps}
  onEventClick={(ev) => openMyOwnPanel(ev.id)}
/>
```

**Show only the views you want:**

```tsx
const janus = useJanusScheduler({
  views: ["Day", "Week"],
  defaultView: "Week",
});
```

**Drive navigation from your own UI** — skip `<Topbar>` entirely:

```tsx
<button onClick={janus.nav.goToPrev}>←</button>
<span>{janus.nav.navLabel}</span>
<button onClick={janus.nav.goToNext}>→</button>
<button onClick={janus.nav.goToToday}>Today</button>
<button onClick={janus.undo} disabled={!janus.canUndo}>Undo</button>
```

**Open the editor yourself:**

```tsx
<button onClick={() => janus.editor.open()}>New event</button>
<button onClick={() => janus.editor.open("e1")}>Edit e1</button>
```

**Reach the manager for programmatic changes:**

```tsx
janus.manager.addEvent({/* … */});
janus.manager.deleteEvent("e1");
```

**Replace all data after mount** — `events`/`resources` seed once, so use `load`:

```tsx
janus.load({ events: nextEvents, resources: nextResources });
```

---

## `useJanusScheduler` reference

### Options

| Option               | Type                 | Default      |                                                       |
| -------------------- | -------------------- | ------------ | ----------------------------------------------------- |
| `events`             | `EventData[]`        | `[]`         | Seeded **once**, on mount.                            |
| `resources`          | `ResourceData[]`     | `[]`         | Same. `type: "person"` needs a non-empty `email`.     |
| `defaultView`        | `ViewType`           | `"Timeline"` |                                                       |
| `views`              | `ViewType[]`         | all five     | Which views the topbar offers.                        |
| `timezone`           | `string`             | store's      | IANA zone for display.                                |
| `preventConflicts`   | `boolean`            | `false`      | `true` blocks conflicting actions instead of warning. |
| `resourceTypeConfig` | `ResourceTypeConfig` | —            | Groups/labels timeline resource rows.                 |
| `showFab`            | `boolean`            | `true`       | Floating "add event" button.                          |
| `defaultAllowCreate` | `boolean`            | `true`       | Whether drag-to-create starts on.                     |
| `googleConnected`    | `boolean`            | `false`      | Renders the Google button as connected.               |
| `hooks`              | `SchedulerHooks`     | `{}`         | Persistence, with rollback.                           |
| `manager`            | `SchedulerManager`   | —            | Bring your own.                                       |
| `onChange`           | `(d) => void`        | —            | `{ type: "add" \| "update" \| "delete", id }`         |
| `onConnectCalendar`  | `() => void`         | —            | Topbar Google button clicked.                         |

### Returns

|                                  |                                                                                                                         |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `manager`                        | The `SchedulerManager`.                                                                                                 |
| `view` / `setView`               | Active view.                                                                                                            |
| `canUndo` / `undo()`             | Undo state and action.                                                                                                  |
| `allowCreate` / `setAllowCreate` | Drag-to-create toggle.                                                                                                  |
| `nav`                            | `navLabel`, `dayName`, `shortDate`, `zoomPercent`, `zoomUnit`, `goToPrev()`, `goToNext()`, `goToToday()`, `goToDate(d)` |
| `editor`                         | `isOpen`, `open(id?)`, `close()`, `props`                                                                               |
| `load(data)`                     | Replace all events and resources.                                                                                       |
| `timelineProps` … `topbarProps`  | Prop bundles to spread.                                                                                                 |

---

## Doing it entirely by hand

You can skip the hook and wire components yourself. The components render from the store and **never write to it** — converting callbacks into `manager` calls is then your job:

```tsx
import { Timeline, SchedulerManager } from "@janus-scheduler/react";

const manager = new SchedulerManager();
manager.addResource({
  id: "r1",
  name: "Alice",
  type: "person",
  email: "alice@example.com",
});

<Timeline
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
/>;
```

There are ~44 such callbacks across the five views plus the editor. That is exactly what the hook does for you, so reach for this only when you need behaviour the hook doesn't expose — and prefer overriding a single prop on a bundle instead.

---

## Reading state directly

`SchedulerManager` has **no `.store` property**. Import the store, and note that `events` and `resources` are `Record<string, T>`, not arrays:

```tsx
import { useSyncExternalStore } from "react";
import { schedulerStore } from "@janus-scheduler/react";

const events = useSyncExternalStore(
  schedulerStore.subscribe,
  () => schedulerStore.getState().events,
);
const list = Object.values(events);
```

The store is a module-level singleton — one scheduler per page.

---

## Components

`Timeline`, `DayGrid`, `WeekGrid`, `MonthGrid`, `YearGrid`, `Scheduler` (event editor modal), `Topbar`, `Chat`, `AiBar`, `ConfirmDialog`.

Callbacks receive the unwrapped payload — you never touch a raw `CustomEvent`.

## Conflict prevention

`preventConflicts` defaults to **`false`**: conflicts are allowed and surfaced as a dismissible banner plus per-event badges. `true` blocks the action and shows a dialog.

`onConflictDetected` is cancelable — call `preventDefault()` on the underlying event to substitute your own handling.

## Theming

No stylesheet to import. Everything is Shadow-DOM scoped; theme with the `--janus-*` CSS custom properties.

## Documentation

[Janus-scheduler/main-program](https://github.com/Janus-scheduler/main-program)

## Licence

ISC
