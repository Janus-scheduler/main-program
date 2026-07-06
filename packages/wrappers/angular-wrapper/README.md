# @janus-scheduler/angular

The official Angular wrapper for **Janus Scheduler**, a highly customizable, timezone-aware, and performant scheduling timeline for modern web applications.

## Installation

```bash
npm install @janus-scheduler/angular
```

## Quick Start

In your `app.component.ts`:

```typescript
import { Component, CUSTOM_ELEMENTS_SCHEMA } from "@angular/core";
import {
  SchedulerComponent,
  TimelineComponent,
  SchedulerManager,
  type EventMoveDetail,
} from "@janus-scheduler/angular";

@Component({
  selector: "app-root",
  standalone: true,
  imports: [SchedulerComponent, TimelineComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <div style="height: 100vh;">
      <janus-timeline (onEventMove)="handleEventMove($event)"></janus-timeline>
    </div>
  `,
})
export class AppComponent {
  manager = new SchedulerManager();

  handleEventMove(detail: EventMoveDetail) {
    this.manager.updateEvent(detail.event.id, {
      resourceId: detail.newResourceId,
      startTime: detail.newStartTime,
      endTime: detail.newEndTime,
    });
  }
}
```

## Features

- **Native Angular DX**: Uses Angular Signals internally to map state properties.
- **No Boilerplate**: Payload events are automatically unwrapped from native DOM CustomEvents.
- **Timezone Aware**: Built-in support for IANA timezones and local browser time.
- **Conflict Management & Prevention**: Control warning or strict blocking behaviors using `[preventConflicts]="true"`.

## Conflict Prevention Config

You can pass the binding to `<janus-timeline-ng>` or `<janus-scheduler-ng>` components, and capture conflict callbacks via the `(conflictDetected)` output:

```html
<!-- Strict double-booking prevention mode with callback -->
<janus-timeline-ng
  [preventConflicts]="true"
  (conflictDetected)="handleConflict($event)"
  (eventMove)="handleEventMove($event)"
>
</janus-timeline-ng>
```

## Documentation

For full documentation, architecture details, and more framework wrappers, please visit the [main repository](https://github.com/your-repo/janus-scheduler).
