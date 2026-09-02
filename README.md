# Janus Scheduler

A framework-agnostic scheduling and event-management component library. All state lives in one vanilla [Zustand](https://zustand-demo.pmnd.rs/) store, all UI is built once as [Lit](https://lit.dev/) web components, and thin per-framework packages expose those components idiomatically - so React, Angular, Solid and Vue all render the exact same code.

Timeline, day, week, month and year views. Drag, resize and draw-to-create. A timezone-aware conflict detector, RRule recurrence, undo, and natural-language event entry.

---

## Two ways to use it

**Pick the tier that matches how much control you want.** Both are one install.

### Tier 1 - batteries included

One element. It mounts the topbar, all five views and the event editor, and wires every drag, resize, create, save, delete and undo for you.

```bash
npm install @janus-scheduler/app
```

```tsx
import { JanusApp } from "@janus-scheduler/app/react";

const resources = [
  { id: "r1", name: "Alice", type: "person", email: "alice@example.com" },
  { id: "r2", name: "Room A", type: "room", email: "" },
];

export default function App() {
  return (
    <div style={{ height: "100vh" }}>
      <JanusApp
        resources={resources}
        events={[]}
        onChange={({ type, id, event }) => console.log(type, id, event?.title)}
      />
    </div>
  );
}
```

That is the whole integration. See [`packages/app`](packages/app/README.md).

### Tier 2 — your layout, still no wiring

Install your framework package and place the pieces yourself. In React,
`useJanusScheduler` owns the manager, all ~44 event handlers, navigation, the
editor modal and undo — you write layout only.

```bash
npm install @janus-scheduler/react     # or /angular, /solid
```

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

Five views, drag, resize, draw-to-create, the editor, prev/next/today and
Ctrl+Z — with **zero handler props and zero refs**. Override any single prop by
placing it after the spread, drive navigation from your own buttons via
`janus.nav`, or reach `janus.manager` directly.

You can still wire every callback by hand if you need to; see the
[React guide](packages/wrappers/react-wrapper/README.md). Solid and Angular
currently use that manual approach — an equivalent hook for each is planned.

> **Note on Vue.** There is no `@janus-scheduler/vue` wrapper yet. Vue apps use `@janus-scheduler/app` (a plain custom element, so it just works) or consume `@janus-scheduler/core` + `@janus-scheduler/ui` directly. See [Vue setup](#vue) below.

---

## Packages

| Package                                                         | What it is                                                                         |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| [`@janus-scheduler/app`](packages/app)                          | **Tier 1.** `<janus-app>` - the whole scheduler, wired. Plus `/react` bindings.    |
| [`@janus-scheduler/react`](packages/wrappers/react-wrapper)     | **Tier 2.** React components via `@lit/react`.                                     |
| [`@janus-scheduler/angular`](packages/wrappers/angular-wrapper) | **Tier 2.** Angular standalone components.                                         |
| [`@janus-scheduler/solid`](packages/wrappers/solid-js-wrapper)  | **Tier 2.** SolidJS components.                                                    |
| [`@janus-scheduler/ui`](packages/ui)                            | The Lit web components. Framework-agnostic.                                        |
| [`@janus-scheduler/core`](packages/core)                        | Store, `SchedulerManager`, models, conflict detection, recurrence, timezone utils. |
| [`@janus-scheduler/nlp`](packages/nlp)                          | Natural-language event entry. A dependency of every wrapper.                       |
| [`@janus-scheduler/integrations`](packages/integrations)        | Optional Google Calendar sync (browser client + Node backend).                     |

You normally install exactly one of the first four.

---

## Core concepts

### The store is the single source of truth

`@janus-scheduler/ui` renders; it never mutates. Every change goes through `SchedulerManager`, which writes to the store optimistically and then fires a lifecycle hook. **If the hook throws or its promise rejects, the store change is rolled back** and `onError` fires - so your UI never drifts from your backend.

```tsx
const manager = new SchedulerManager({
  onEventAdd: (event) => api.create(event), // reverted if this rejects
  onEventUpdate: (event) => api.update(event),
  onEventDelete: (id) => api.remove(id),
  onError: ({ operation, error }) => toast(`${operation} failed`),
});
```

`SchedulerManager` has no `.store` property. To observe state, subscribe to the store directly:

```tsx
import { schedulerStore } from "@janus-scheduler/react";

// events and resources are Record<string, T>, not arrays.
const unsubscribe = schedulerStore.subscribe((state) => {
  console.log(Object.values(state.events));
});
```

In React, prefer `useSyncExternalStore(schedulerStore.subscribe, () => schedulerStore.getState().events)`.

### Conflict detection

Timezone-aware double-booking detection is built in, controlled by `preventConflicts` (default `false`):

- **`false`** - conflicts are allowed; a dismissible banner and per-event warning badges appear.
- **`true`** - the save/drag/resize/create is blocked outright and a dialog explains why.

`<janus-timeline>` also fires a cancelable `conflict-detected` event (`onConflictDetected` in React/Solid, `conflictDetected` in Angular). Call `preventDefault()` on it to replace the built-in blocker with your own handling.

### Theming

There is **no CSS file to import**. Everything is Shadow-DOM scoped, so nothing leaks in or out. Theme via `--janus-*` CSS custom properties - see [`docs/THEMING_GUIDE.md`](docs/THEMING_GUIDE.md).

The components do not load a webfont for you; if you want Roboto, load it in your own app.

---

## Framework notes

### React

Works as shown above. Callbacks receive the unwrapped payload, never a raw `CustomEvent`.

### Angular

Components are standalone, and their selectors end in `-ng` to avoid colliding with the underlying custom element:

```typescript
import { Component } from "@angular/core";
import {
  TimelineComponent,
  SchedulerManager,
  type EventMoveDetail,
} from "@janus-scheduler/angular";

@Component({
  selector: "app-root",
  standalone: true,
  imports: [TimelineComponent],
  template: `
    <div style="height: 100vh">
      <janus-timeline-ng (eventMove)="onMove($event)" />
    </div>
  `,
})
export class AppComponent {
  manager = new SchedulerManager();

  onMove(detail: EventMoveDetail) {
    const current = this.manager.getEvent(detail.event.id);
    if (!current) return;
    this.manager.updateEvent(detail.event.id, {
      resourceIds: current.resourceIds.map((id) =>
        id === detail.oldResourceId ? detail.newResourceId : id,
      ),
      startTime: detail.newStartTime,
      endTime: detail.newEndTime,
    });
  }
}
```

The package is ESM-only and expects a bundler - fine for any Angular CLI project.

### Vue

No wrapper package yet. Use `@janus-scheduler/app`, or the web components directly. Either way Vue needs to be told these are custom elements:

```ts
// vite.config.ts
vue({
  template: {
    compilerOptions: { isCustomElement: (tag) => tag.startsWith("janus-") },
  },
});
```

```vue
<janus-app
  :events.prop="events"
  :resources.prop="resources"
  @change="onChange"
/>
```

Use `.prop` for arrays and objects - plain attributes stringify.

---

## Requirements

- Node.js 18+
- A bundler (Vite, webpack, the Angular CLI, …). The packages ship ESM and CJS builds.
- React 18 or 19 · Angular 17–21 · Solid 1.8+ · Vue 3.5+

---

## Documentation

| Doc                                                                            | Covers                                                  |
| ------------------------------------------------------------------------------ | ------------------------------------------------------- |
| [`docs/ARCHITECTURE_FACADE.md`](docs/ARCHITECTURE_FACADE.md)                   | Why wrappers re-export everything, and event unwrapping |
| [`docs/TYPE_GUIDE.md`](docs/TYPE_GUIDE.md)                                     | The two-layer type system and where new types go        |
| [`docs/THEMING_GUIDE.md`](docs/THEMING_GUIDE.md)                               | CSS custom properties and per-instance branding         |
| [`docs/resource_configuration_guide.md`](docs/resource_configuration_guide.md) | Grouping and ordering timeline resources                |
| [`docs/PERFORMANCE_OPTIMIZATIONS.md`](docs/PERFORMANCE_OPTIMIZATIONS.md)       | Benchmarks at 150 resources / 1,500 events              |
| [`docs/RELEASING.md`](docs/RELEASING.md)                                       | How to cut and publish a release                        |

---

## Contributing

```bash
git clone https://github.com/Janus-scheduler/main-program.git
cd main-program
npm install

npm run dev:react-demo        # or dev:angular-demo, dev:solid-demo, dev:vue-demo

npm run validate              # lint + build every workspace
npm test                      # core test suite
npm run check:packages        # publint across all publishable manifests
npm run test:pack             # installs the real tarballs into a throwaway app
```

`npm run test:pack` is the one that matters before a release: every demo aliases `@janus-scheduler/*` back to `src`, so it is the only check that exercises the packages the way an npm consumer does.

| Change                       | Goes in                          |
| ---------------------------- | -------------------------------- |
| Business logic, state, types | `packages/core/src/`             |
| Anything visual              | `packages/ui/src/`               |
| Framework bindings only      | `packages/wrappers/<framework>/` |
| All-in-one wiring            | `packages/app/src/`              |

New visual features belong in `packages/ui` - wrappers must stay thin adapters with no duplicated UI logic.

## Licence

ISC
