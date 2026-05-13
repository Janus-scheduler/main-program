# @janus-scheduler/solid

The official SolidJS wrapper for **Janus Scheduler**, a highly customizable, timezone-aware, and performant scheduling timeline for modern web applications.

## Installation

```bash
npm install @janus-scheduler/solid
```

## Quick Start

```tsx
import { createSignal, onMount } from "solid-js";
import { Timeline, SchedulerManager } from "@janus-scheduler/solid";

export default function App() {
  const manager = new SchedulerManager();

  return (
    <div style="height: 100vh;">
      <Timeline
        onEventMove={({ event, newResourceId, newStartTime, newEndTime }) => {
          manager.updateEvent(event.id, {
            resourceId: newResourceId,
            startTime: newStartTime,
            endTime: newEndTime,
          });
        }}
      />
    </div>
  );
}
```

## Features

- **Native Solid DX**: Fully strongly-typed props and inline callbacks.
- **No Boilerplate**: Payload events are automatically unwrapped from native DOM CustomEvents.
- **Timezone Aware**: Built-in support for IANA timezones and local browser time.

## Documentation

For full documentation, architecture details, and more framework wrappers, please visit the [main repository](https://github.com/your-repo/janus-scheduler).
