# Architecture: The Facade Pattern & Event Unwrapping

The Janus Scheduler monorepo is divided into multiple packages to maintain clean separation of concerns (`core`, `ui`, `react-wrapper`, etc.). However, exposing this internal complexity directly to consumers results in a poor Developer Experience (DX).

To solve this, we employ the **Facade Pattern** combined with **Event Unwrapping** in our framework wrappers.

---

## 1. The Facade Pattern

Instead of requiring developers to import utilities, types, and the store from `@janus-scheduler/core` and components from the framework wrapper, the framework wrapper acts as a single "front door" (a facade).

### How it Works

The wrapper packages (`@janus-scheduler/react`, `@janus-scheduler/solid`, `@janus-scheduler/angular`) re-export everything a consumer needs from the core package.

**Inside `packages/wrappers/react-wrapper/index.ts`:**

```ts
export {
  SchedulerManager,
  getBrowserTimezone,
  isoToZonedDisplay,
  zonedInputToISO,
  schedulerStore,
} from "@janus-scheduler/core";

export type { TimelineEvent, EventMoveDetail } from "@janus-scheduler/core";
```

**Developer Experience (DX) Improvement:**
Developers only ever install and import from their framework's package.

_Before (No Facade):_

```tsx
import { Timeline } from "@janus-scheduler/react";
import { zonedInputToISO, schedulerStore } from "@janus-scheduler/core"; // ❌ Leaky abstraction
```

_After (Facade):_

```tsx
import {
  Timeline,
  zonedInputToISO,
  schedulerStore,
} from "@janus-scheduler/react"; // ✅ Clean and simple
```

---

## 2. Event Unwrapping

The `@janus-scheduler/ui` package contains native Lit Web Components. Web Components communicate by firing native `CustomEvent` objects where the payload is stored in `event.detail`.

When a developer uses a framework like React or Solid, forcing them to interact with raw DOM `CustomEvents` is unidiomatic and requires them to manually cast types to extract the data payload.

### How it Works

The framework wrapper intercepts the native DOM `CustomEvent` and **unwraps** it, passing only the `detail` payload to the consumer's callback.

**Inside `packages/wrappers/react-wrapper/index.ts`:**

```tsx
export const Timeline = React.forwardRef((props, ref) => {
  return (
    <_Timeline
      {...props}
      ref={ref}
      // Intercept the CustomEvent and pass only e.detail to the user's callback
      onEventMove={(e: CustomEvent<EventMoveDetail>) =>
        props.onEventMove?.(e.detail)
      }
    />
  );
});
```

**Developer Experience (DX) Improvement:**
The callback signature is strictly typed to expect the pure data object, completely hiding the fact that a Web Component `CustomEvent` was ever fired.

_Before (No Unwrapping):_

```tsx
// ❌ Developer has to manually cast the Event to a CustomEvent and extract detail
const handleMove = (e: Event) => {
  const detail = (e as CustomEvent<EventMoveDetail>).detail;
  manager.updateEvent(detail.event.id, { startTime: detail.newStartTime });
};
```

_After (Unwrapping):_

```tsx
// ✅ TypeScript automatically infers the destructured payload
const handleMove = ({ event, newStartTime }: EventMoveDetail) => {
  manager.updateEvent(event.id, { startTime: newStartTime });
};
```

## Summary

By using the **Facade Pattern** and **Event Unwrapping**, the `@janus-scheduler` packages behave exactly like native React, Solid, or Angular libraries. Consumers never need to know that they are actually interacting with a multi-package monorepo powered by Web Components under the hood.
