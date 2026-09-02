# @janus-scheduler/app

The batteries-included Janus Scheduler. One element — `<janus-app>` — mounts the
topbar, all five views and the event editor, and wires every drag, resize,
create, save, delete and undo to a `SchedulerManager` for you.

This is the **simple tier**. If you want to lay the pieces out yourself, use your
framework package instead (`@janus-scheduler/react`, `/angular`, `/solid`) and
compose `<janus-timeline>`, `<janus-month-grid>`, … directly.

```bash
npm install @janus-scheduler/app
```

## React

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
        onChange={({ type, id, event }) => {
          // Persist however you like.
          console.log(type, id, event?.title);
        }}
      />
    </div>
  );
}
```

That is the whole integration. Drag, resize, click-to-create, the editor modal,
view switching, prev/next/today and Ctrl+Z all work with no further code.

## Everywhere else

`<janus-app>` is a plain custom element, so Vue, Angular, Solid and vanilla use
it directly.

```html
<script type="module">
  import "@janus-scheduler/app";
</script>

<janus-app id="app" style="height: 100vh"></janus-app>

<script type="module">
  const app = document.getElementById("app");
  app.resources = [
    { id: "r1", name: "Alice", type: "person", email: "alice@example.com" },
  ];
  app.events = [];
  app.addEventListener("change", (e) => console.log(e.detail));
</script>
```

**Vue** needs `isCustomElement` so it does not warn about the tag, and `.prop`
bindings for arrays/objects:

```ts
// vite.config.ts
vue({
  template: {
    compilerOptions: { isCustomElement: (t) => t.startsWith("janus-") },
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

**Angular** needs `CUSTOM_ELEMENTS_SCHEMA` on the component, then `[events]` /
`(change)` bindings work as usual.

## Props

| Prop                 | Type                 | Default      | Notes                                                       |
| -------------------- | -------------------- | ------------ | ----------------------------------------------------------- |
| `events`             | `EventData[]`        | `[]`         | Seeded **once**, on mount. Use `load()` afterwards.         |
| `resources`          | `ResourceData[]`     | `[]`         | Same one-shot seeding rule.                                 |
| `view`               | `ViewType`           | `"Timeline"` | `Timeline \| Day \| Week \| Month \| Year`                  |
| `views`              | `ViewType[]`         | all five     | Which views the topbar offers.                              |
| `preventConflicts`   | `boolean`            | `false`      | `true` hard-blocks conflicting actions instead of warning.  |
| `resourceTypeConfig` | `ResourceTypeConfig` | —            | Groups and labels timeline resource rows.                   |
| `timezone`           | `string`             | store's      | IANA zone for display.                                      |
| `googleConnected`    | `boolean`            | `false`      | Renders the Google button as connected.                     |
| `hooks`              | `SchedulerHooks`     | `{}`         | Forwarded to the internal manager — where you persist.      |
| `manager`            | `SchedulerManager`   | —            | Bring your own instead of letting `<janus-app>` create one. |

## Events

| Event              | Detail                                                | Fires when                                            |
| ------------------ | ----------------------------------------------------- | ----------------------------------------------------- |
| `change`           | `{ type: "add" \| "update" \| "delete", id, event? }` | An event was written to the store.                    |
| `app-error`        | `{ operation, error, reverted }`                      | A lifecycle hook rejected; the store was rolled back. |
| `view-change`      | `{ view }`                                            | The active view changed.                              |
| `connect-calendar` | `{}`                                                  | The topbar's Google Calendar button was clicked.      |

In React these arrive as `onChange`, `onError`, `onViewChange` and
`onConnectCalendar`, already unwrapped — you get the `detail`, never a raw
`CustomEvent`.

## Persisting changes

`change` is a notification. To persist with rollback on failure, use `hooks` —
if a hook throws or rejects, the optimistic store write is reverted and
`app-error` fires:

```tsx
<JanusApp
  hooks={{
    onEventAdd: (event) => api.create(event), // reverted if this rejects
    onEventUpdate: (event) => api.update(event),
    onEventDelete: (id) => api.remove(id),
  }}
  onError={({ operation, error }) => toast(`${operation} failed`)}
/>
```

## Replacing data after mount

`events` and `resources` seed the store once. To swap the dataset later, call
`load()` on the element:

```tsx
const ref = useRef(null);
ref.current?.load({ events: nextEvents, resources: nextResources });
```

## Notes and limits

- **The store is a module-level singleton.** Two `<janus-app>` elements on one
  page share the same events and resources. One per page.
- **No stylesheet to import.** Everything is Shadow-DOM scoped. Theme through
  the `--janus-*` CSS custom properties (see `docs/THEMING_GUIDE.md`).
- **Give it a height.** The element is `display: block; height: 100%`, so its
  parent needs a real height or it collapses.
- **Google Calendar is not included.** `connect-calendar` just tells you the
  button was clicked; wire `@janus-scheduler/integrations` yourself if you want
  sync — it also needs the Node backend that package ships.

## Licence

ISC
