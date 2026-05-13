# @janus-scheduler/react

The official React wrapper for **Janus Scheduler**, a highly customizable, timezone-aware, and performant scheduling timeline for modern web applications.

## Installation

```bash
npm install @janus-scheduler/react
```

## Quick Start

```tsx
import { useState } from "react";
import { Timeline, SchedulerManager } from "@janus-scheduler/react";

// 1. Initialize the manager outside your component or in a useMemo
const manager = new SchedulerManager();

export default function App() {
  const [events, setEvents] = useState([]);

  // Subscribe to changes
  manager.store.subscribe((state) => {
    setEvents(state.events);
  });

  return (
    <div style={{ height: "100vh" }}>
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

- **Native React DX**: Fully strongly-typed props and inline callbacks.
- **No Boilerplate**: Payload events are automatically unwrapped from native DOM CustomEvents.
- **Timezone Aware**: Built-in support for IANA timezones and local browser time.

## Documentation

For full documentation, architecture details, and more framework wrappers, please visit the [main repository](https://github.com/your-repo/janus-scheduler).
