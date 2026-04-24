# @janus-scheduler/angular

Angular wrapper for the Janus Scheduler UI web components.

This package is a **thin framework-agnostic adapter** that wraps the Lit-based web components from `@janus-scheduler/ui`, making them easy to use with Angular bindings and signals.

## Architecture

Following the **DRY (Don't Repeat Yourself)** principle, this wrapper does not contain any UI logic or styles. Instead, it acts as a bridge:

- **Inputs**: Pass data from Angular properties to Web Component properties.
- **Outputs**: Listen to DOM CustomEvents and re-emit them as Angular `EventEmitter` outputs.
- **Styles**: The UI is encapsulated within the Web Component's Shadow DOM, ensuring stylistic consistency across all frameworks (React, Angular, etc.).

## Components

### `SchedulerComponent`

Wraps the `<janus-scheduler>` web component.

```html
<janus-scheduler-ng (close)="onClose()" />
```

### `TimelineComponent`

Wraps the `<janus-timeline>` web component.

```html
<janus-timeline-ng
  [resources]="myResources"
  (eventClick)="onEventClick($event)"
  (addEvent)="onAddEvent()"
/>
```

## Setup

1. Add the package to your `package.json`.
2. Ensure you have `CUSTOM_ELEMENTS_SCHEMA` in your Angular module or component `schemas` array.
3. Import the components directly into your standalone components or NgModules.

```typescript
import { SchedulerComponent, TimelineComponent } from '@janus-scheduler/angular';

@Component({
  standalone: true,
  imports: [SchedulerComponent, TimelineComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  // ...
})
```
