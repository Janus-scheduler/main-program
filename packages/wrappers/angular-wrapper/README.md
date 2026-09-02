# @janus-scheduler/angular

The official Angular wrapper for **Janus Scheduler** — a customizable, timezone-aware scheduling timeline and calendar for modern web apps.

```bash
npm install @janus-scheduler/angular
```

`@janus-scheduler/core`, `/ui` and `/nlp` come with it. You import from this package only.

Supports Angular 17–21. The package is ESM-only and expects a bundler, which any Angular CLI project provides.

> **Want it wired for you?** This package gives you the building blocks. If you just want a working scheduler in one line, use [`@janus-scheduler/app`](https://www.npmjs.com/package/@janus-scheduler/app) — `<janus-app>` is a plain custom element; add `CUSTOM_ELEMENTS_SCHEMA` and bind to it directly.

## Component selectors end in `-ng`

The Angular components wrap Lit custom elements. To avoid colliding with the underlying tag, every Angular selector has an `-ng` suffix:

| Angular selector                                            | wraps                  |
| ----------------------------------------------------------- | ---------------------- |
| `<janus-timeline-ng>`                                       | `<janus-timeline>`     |
| `<janus-month-grid-ng>`                                     | `<janus-month-grid>`   |
| `<janus-day-grid-ng>` / `<janus-week-grid-ng>`              | the time grids         |
| `<janus-year-grid-ng>`                                      | `<janus-year-grid>`    |
| `<janus-scheduler-ng>`                                      | the event editor modal |
| `<janus-topbar-ng>`, `<janus-chat-ng>`, `<janus-ai-bar-ng>` | topbar, chat, AI bar   |

Outputs use plain Angular names — `(eventMove)`, not `(onEventMove)`.

## Quick start

The components render from a shared store and never write to it. You create a `SchedulerManager`, seed it, and turn outputs into manager calls.

```typescript
import { Component } from "@angular/core";
import {
  TimelineComponent,
  SchedulerManager,
  type EventMoveDetail,
  type EventResizeDetail,
} from "@janus-scheduler/angular";

@Component({
  selector: "app-root",
  standalone: true,
  imports: [TimelineComponent],
  template: `
    <div style="height: 100vh">
      <janus-timeline-ng
        [showFab]="true"
        [allowCreate]="true"
        (eventMove)="onMove($event)"
        (eventResize)="onResize($event)"
      />
    </div>
  `,
})
export class AppComponent {
  manager = new SchedulerManager();

  constructor() {
    // A resource of type "person" requires a non-empty email.
    this.manager.addResource({
      id: "r1",
      name: "Alice",
      type: "person",
      email: "alice@example.com",
    });
    this.manager.addEvent({
      id: "e1",
      title: "Standup",
      startTime: "2026-09-02T09:00:00.000Z",
      endTime: "2026-09-02T09:30:00.000Z",
      resourceIds: ["r1"],
      status: "confirmed",
    });
  }

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

  onResize(detail: EventResizeDetail) {
    this.manager.updateEvent(detail.event.id, {
      startTime: detail.newStartTime,
      endTime: detail.newEndTime,
    });
  }
}
```

The components are standalone — import them individually, no NgModule needed. Give the container a real height.

## Reading state

`SchedulerManager` has **no `.store` property**. Subscribe to the store directly, and note that `events` and `resources` are `Record<string, T>`, not arrays:

```typescript
import { schedulerStore } from "@janus-scheduler/angular";

const unsubscribe = schedulerStore.subscribe((state) => {
  this.events.set(Object.values(state.events));
});
```

## Persisting changes

Every mutating method writes to the store immediately, then fires a lifecycle hook. **If the hook throws or rejects, the store change is rolled back** and `onError` fires:

```typescript
this.manager = new SchedulerManager({
  onEventAdd: (event) => this.api.create(event), // reverted if this rejects
  onEventUpdate: (event) => this.api.update(event),
  onEventDelete: (id) => this.api.remove(id),
  onError: ({ operation, error }) => this.toast(`${operation} failed`),
});
```

## Navigation

Navigation is imperative, via a template reference to the component:

```typescript
@ViewChild(TimelineComponent) timeline!: TimelineComponent;
// goToPrev(), goToNext(), goToToday(), goToDate(date)
```

## Conflict prevention

`preventConflicts` defaults to **`false`**: conflicts are allowed and surfaced as a dismissible banner plus per-event badges. Set it to `true` to block the action outright.

```html
<janus-timeline-ng
  [preventConflicts]="true"
  (conflictDetected)="onConflict($event)"
/>
```

`conflictDetected` is cancelable — call `preventDefault()` on the underlying event to replace the built-in blocking dialog with your own.

## Theming

No stylesheet to import. Everything is Shadow-DOM scoped; theme with the `--janus-*` CSS custom properties.

## Documentation

Full docs, architecture and the other framework packages: [Janus-scheduler/main-program](https://github.com/Janus-scheduler/main-program).

## Licence

ISC
