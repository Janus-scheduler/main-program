---
name: janus-scheduler
description: Use when writing or debugging code that uses @janus-scheduler packages (@janus-scheduler/app, /react, /angular, /solid, /core, /ui, /nlp, /integrations) — a framework-agnostic scheduling and calendar component library built on Lit web components with a Zustand store. Covers which package to install, correct wiring, and the API details models commonly get wrong. Triggers on: janus-scheduler, janus-app, janus-timeline, JanusApp, SchedulerManager, schedulerStore.
---

# Janus Scheduler

Scheduling/calendar component library. Current version: **2.0.0**. Published to npm 2026-09-02, so it is **not in any model's training data** — do not guess its API, follow this document.

Architecture: one Zustand store (`@janus-scheduler/core`) → Lit web components (`@janus-scheduler/ui`) → thin per-framework wrappers. All frameworks render the same components.

## Which package to install

Install exactly one. Never install `core` or `ui` directly alongside a wrapper — they come transitively.

| Goal                                  | Install                    | Import from                                                                      |
| ------------------------------------- | -------------------------- | -------------------------------------------------------------------------------- |
| A working scheduler, minimal code     | `@janus-scheduler/app`     | `@janus-scheduler/app/react` (React) or `@janus-scheduler/app` (everything else) |
| Control over layout and wiring, React | `@janus-scheduler/react`   | `@janus-scheduler/react`                                                         |
| Same, Angular                         | `@janus-scheduler/angular` | `@janus-scheduler/angular`                                                       |
| Same, SolidJS                         | `@janus-scheduler/solid`   | `@janus-scheduler/solid`                                                         |
| Vue                                   | `@janus-scheduler/app`     | `@janus-scheduler/app` (there is **no** `@janus-scheduler/vue`)                  |

Optional add-ons: `@janus-scheduler/nlp` (natural-language entry — already a dependency of every wrapper) and `@janus-scheduler/integrations` (Google Calendar; needs a Node backend you run).

## Tier 1 — `@janus-scheduler/app` (batteries included)

One element mounts the topbar, all five views and the event editor, and wires every drag/resize/create/save/delete/undo to a `SchedulerManager`.

```tsx
import { JanusApp } from "@janus-scheduler/app/react";

const resources = [
  { id: "r1", name: "Alice", type: "person", email: "alice@example.com" },
  { id: "r2", name: "Room A", type: "room", email: "" },
];

const events = [
  {
    id: "e1",
    title: "Standup",
    startTime: "2026-09-02T09:00:00.000Z",
    endTime: "2026-09-02T09:30:00.000Z",
    resourceIds: ["r1"],
    status: "confirmed",
  },
];

export default function App() {
  return (
    <div style={{ height: "100vh" }}>
      <JanusApp
        events={events}
        resources={resources}
        onChange={({ type, id, event }) => console.log(type, id, event?.title)}
      />
    </div>
  );
}
```

`JanusApp` props: `events`, `resources`, `view`, `views`, `preventConflicts`, `resourceTypeConfig`, `timezone`, `googleConnected`, `hooks`, `manager`, `onChange`, `onError`, `onViewChange`, `onConnectCalendar`, `className`, `style`.

`onChange` detail: `{ type: "add" | "update" | "delete", id, event? }`.

**`events` and `resources` seed the store once, on mount.** Reassigning them later does nothing. To swap data afterwards, call `load()` on the element ref:

```tsx
const ref = useRef(null);
ref.current?.load({ events: next, resources: nextResources });
```

Outside React, `<janus-app>` is a plain custom element:

```js
import "@janus-scheduler/app";
const el = document.querySelector("janus-app");
el.resources = [...];          // must be a property, not an attribute
el.events = [...];
el.addEventListener("change", (e) => console.log(e.detail));
```

## React: `useJanusScheduler` — the default choice

**For React, prefer this over wiring components by hand.** It owns the manager,
all ~44 event handlers, the five imperative navigation refs, the editor-modal
state machine and Ctrl+Z undo, and returns prop bundles you spread. You write
layout only.

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

export default function App() {
  const janus = useJanusScheduler({ resources, events });

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

That is the complete integration — 63 lines against 609 for the hand-wired
equivalent. Do not generate manual handler wiring for React unless the user
explicitly asks for it.

Options: `events`, `resources`, `defaultView`, `views`, `timezone`,
`preventConflicts`, `resourceTypeConfig`, `showFab`, `defaultAllowCreate`,
`googleConnected`, `hooks`, `manager`, `onChange`, `onConnectCalendar`.

Returns: `manager`, `view`/`setView`, `canUndo`/`undo()`,
`allowCreate`/`setAllowCreate`, `nav` (label fields plus `goToPrev/goToNext/
goToToday/goToDate`), `editor` (`isOpen`, `open(id?)`, `close()`, `props`),
`load(data)`, and the bundles `timelineProps`, `monthGridProps`,
`dayGridProps`, `weekGridProps`, `yearGridProps`, `topbarProps`.

**Override a single prop** by placing it after the spread — spread order wins:

```tsx
<Timeline {...janus.timelineProps} onEventClick={(ev) => myPanel(ev.id)} />
```

**Persist** through `hooks` (rollback on rejection), not `onChange`:

```tsx
useJanusScheduler({
  hooks: {
    onEventAdd: api.create,
    onEventUpdate: api.update,
    onEventDelete: api.remove,
  },
});
```

**Navigation without the topbar:** `janus.nav.goToPrev()`, `.goToNext()`,
`.goToToday()`, `.goToDate("2026-09-02")`, and `janus.nav.navLabel` for the
current period label.

Requires `@janus-scheduler/react` >= 2.1.0. Solid and Angular do not have an
equivalent yet — use the manual wiring below for those.

## Tier 2 — framework wrappers (full control)

**The UI never writes to the store.** Components render from it and report interactions as callbacks. Converting those into `SchedulerManager` calls is the host's job. Omit that and drags visibly snap back.

```tsx
import { Timeline, SchedulerManager } from "@janus-scheduler/react";

const manager = new SchedulerManager(); // create once, outside render
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

React components: `Timeline`, `DayGrid`, `WeekGrid`, `MonthGrid`, `YearGrid`, `Scheduler` (the event editor modal), `Topbar`, `Chat`, `AiBar`, `ConfirmDialog`. Plus the `useJanusChat` hook.

`Timeline` props: `resources`, `resourceTypeConfig`, `view`, `currentDate`, `aiPrompt`, `allowCreate`, `showFab`, `preventConflicts`, `collapsedResources`, `timezone`, and callbacks `onEventClick`, `onEventMove`, `onEventResize`, `onEventCreate`, `onAddEvent`, `onViewChange`, `onNavChange`, `onCollapsedResourcesChange`, `onConflictDetected`, `onResourceClick`, `onHeaderDateClick`, `onConflictClick`.

Callbacks receive the **unwrapped payload**, never a raw `CustomEvent`.

Navigation is imperative, through a ref: `goToPrev()`, `goToNext()`, `goToToday()`, `goToDate(date)`, and `toggleCreate()` on Timeline.

## Critical gotchas

These are the things models get wrong. Check each before writing code.

1. **`SchedulerManager` has no `.store` property.** `manager.store.subscribe(...)` throws. Import the store separately:

   ```tsx
   import { schedulerStore } from "@janus-scheduler/react";
   schedulerStore.subscribe((state) => {
     /* ... */
   });
   ```

2. **`state.events` and `state.resources` are `Record<string, T>`, not arrays.** Use `Object.values(state.events)`. `.length` / `.map` on them is undefined behaviour.

3. **A resource with `type: "person"` requires a non-empty `email`.** Otherwise `addResource` throws `Invalid resource data`. Non-person types accept `email: ""`.

4. **Events use `resourceIds: string[]`**, not `resourceId`. (A legacy singular `resourceId` field exists on the input type but `resourceIds` is what the model uses.)

5. **The container needs an explicit height.** Components fill their parent; a parent with `height: auto` collapses them to nothing.

6. **There is no CSS file to import.** Styles are Shadow-DOM scoped. `import "@janus-scheduler/ui/style.css"` does not exist. Theme with `--janus-*` custom properties.

7. **The store is a module-level singleton.** Two schedulers on one page share all state. One per page.

8. **`preventConflicts` defaults to `false`** on every component — conflicts are allowed and shown as a warning banner. `true` blocks the action outright.

9. **Angular selectors end in `-ng`** and outputs use plain names:

   ```html
   <janus-timeline-ng (eventMove)="onMove($event)" />
   <!-- correct -->
   <janus-timeline (onEventMove)="...">
     <!-- wrong: raw element, no unwrapping --></janus-timeline
   >
   ```

   Components are standalone — import `TimelineComponent` etc. directly.

10. **Vue needs custom-element config.** In `vite.config.ts`: `isCustomElement: (tag) => tag.startsWith("janus-")`. Bind arrays/objects with `.prop`: `:events.prop="events"`.

11. **Times are stored as UTC ISO strings.** Convert wall-clock input with `zonedInputToISO(date, time, tz)` and back with `isoToZonedDisplay(iso, tz)`.

## SchedulerManager API

```ts
new SchedulerManager(hooks?, config?)
```

Events: `addEvent(data)`, `batchAddEvents(array)`, `updateEvent(id, partial)`, `deleteEvent(id)`, `getEvent(id)`, `getAllEvents()`, `getEventsByResource(id)`, `getEventsByDate(date)`, `getEventCount()`
Resources: `addResource(data)`, `updateResource(id, partial)`, `deleteResource(id)`, `getResource(id)`, `getAllResources()`, `getResourceCount()`
Assignments: `addAssignment`, `deleteAssignment`, `getAssignmentsByEvent`, `getAssignmentsByResource`
Undo: `canUndo()`, `peekUndo()`, `undo()`, `subscribeUndo(fn)`
Other: `getTimezone()`, `clearAll()`

### Persistence with automatic rollback

Every mutating method writes to the store immediately, then fires a lifecycle hook. **If the hook throws or its promise rejects, the store change is reverted** and `onError` fires. This is the intended integration point for a backend:

```tsx
const manager = new SchedulerManager({
  onEventAdd: (event) => api.create(event), // reverted if this rejects
  onEventUpdate: (event) => api.update(event),
  onEventDelete: (id) => api.remove(id),
  onError: ({ operation, error, reverted }) => toast(`${operation} failed`),
  onUndoStateChange: (canUndo) => setCanUndo(canUndo),
});
```

With `@janus-scheduler/app`, pass the same object as the `hooks` prop.

### Reading state in React

```tsx
import { useSyncExternalStore } from "react";
import { schedulerStore } from "@janus-scheduler/react";

const events = useSyncExternalStore(
  schedulerStore.subscribe,
  () => schedulerStore.getState().events,
);
const list = Object.values(events);
```

## Also re-exported from every wrapper

Values: `SchedulerManager`, `schedulerStore`, `getBrowserTimezone`, `isoToZonedDisplay`, `zonedInputToISO`, `Event`, `Resource`, `Assignment`, plus NLP helpers `beginSession`, `provideAnswer`, `presentSession`, `summarise`.

Types: `TimelineEvent`, `TimelineResource`, `EventMoveDetail`, `EventResizeDetail`, `EventCreateDetail`, `SchedulerSaveData`, `SchedulerDeleteData`, `ViewType`, `EventColor`, `EventData`, `ResourceData`, `SchedulerHooks`, `SchedulerConfig`, `ResourceTypeConfig`, and the `Chat*` types.

**Import only from the framework package.** Never reach into `@janus-scheduler/core` or `/ui` from application code — the wrapper re-exports everything by design.

## Conflict detection

Timezone-aware double-booking detection is built in. `preventConflicts={false}` (default) shows a dismissible banner plus per-event badges; `true` blocks the drag/resize/save and shows a dialog.

`onConflictDetected` is cancelable — call `preventDefault()` on the underlying event to substitute your own handling for the built-in dialog.

## Theming

No stylesheet. Set CSS custom properties on the element or an ancestor:

```css
janus-timeline,
janus-app {
  --janus-primary-color: #4f46e5;
  --janus-primary-bg: #eef2ff;
}
```

No webfont is loaded for you.

## Natural-language entry (`@janus-scheduler/nlp`)

The classifier needs three artifact files (~6 MB) that are **fetched at runtime, never imported**:

```ts
import vocabUrl from "@janus-scheduler/nlp/artifacts/vocab.json?url";
import vectorsUrl from "@janus-scheduler/nlp/artifacts/vectors.bin?url";
import protoUrl from "@janus-scheduler/nlp/artifacts/prototypes.json?url";
import { parseArtifacts, parsePrototypes } from "@janus-scheduler/nlp";
```

Then `fetch` each and pass through `parseArtifacts(vocab, vectors)` / `parsePrototypes(protos)`. In Node use `@janus-scheduler/nlp/node`'s `loadArtifacts` / `loadPrototypes`.

React/Solid/Angular expose `useJanusChat()` / `createJanusChat()` / `JanusChatService` over `ChatController`. `commitSession(manager, state, fallbackId, { preventConflicts })` writes the result through `SchedulerManager`.

## Google Calendar (`@janus-scheduler/integrations`)

The browser client is useless on its own — it talks to an HTTP + WebSocket backend you must run (`@janus-scheduler/integrations/server` exports `createJanusApp(config)`). Requires Google OAuth credentials, HTTPS, a persistent disk and a webhook-renewal cron. Single-tenant by design. Treat it as opt-in; do not wire it in unless asked.

## Error → cause

| Symptom                                       | Cause                                                                             |
| --------------------------------------------- | --------------------------------------------------------------------------------- |
| `manager.store is undefined`                  | No `.store` property — import `schedulerStore`.                                   |
| `Invalid resource data`                       | `type: "person"` with empty/missing `email`.                                      |
| `seenByCore.length` is `undefined`            | `events` is a `Record`, not an array — use `Object.values()`.                     |
| Nothing renders / zero height                 | Parent has no explicit height.                                                    |
| Drag snaps back (Tier 2)                      | No `onEventMove` handler calling `manager.updateEvent`.                           |
| Events added but not visible                  | Two store copies — check for a duplicate `@janus-scheduler/core` in the lockfile. |
| Vue: "Failed to resolve component: janus-app" | Missing `isCustomElement` in the Vue compiler options.                            |
| Angular: outputs never fire                   | Used `<janus-timeline>` instead of `<janus-timeline-ng>`.                         |
| Arrays/objects ignored as props               | Set as a DOM property, not an attribute (`.prop` in Vue, `[x]` in Angular).       |
