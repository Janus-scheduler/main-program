# @janus-scheduler/ui

The Lit web components behind **Janus Scheduler** — timeline, day/week/month/year grids, the event editor modal, topbar and chat. Framework-agnostic custom elements, usable anywhere HTML runs.

```bash
npm install @janus-scheduler/ui
```

> **You probably don't need to install this directly.** It comes with every framework package (`@janus-scheduler/react`, `/angular`, `/solid`) and with `@janus-scheduler/app`. Install it on its own for Vue or vanilla, where there is no wrapper.

## Usage

Importing the package registers the elements as a side effect:

```html
<script type="module">
  import "@janus-scheduler/ui";
</script>

<janus-timeline show-fab allow-create style="height: 100vh"></janus-timeline>
```

| Tag                                      | What it renders                                        |
| ---------------------------------------- | ------------------------------------------------------ |
| `<janus-timeline>`                       | Resource timeline with drag, resize and draw-to-create |
| `<janus-day-grid>` / `<janus-week-grid>` | Day and week time grids                                |
| `<janus-month-grid>`                     | Month calendar                                         |
| `<janus-year-grid>`                      | Year overview                                          |
| `<janus-scheduler>`                      | The event editor modal                                 |
| `<janus-topbar>`                         | Navigation, view switcher, undo                        |
| `<janus-chat>` / `<janus-ai-bar>`        | Natural-language event entry                           |
| `<janus-confirm-dialog>`                 | Confirmation prompt                                    |

## These components render — they never write

The elements subscribe to the `@janus-scheduler/core` store and paint from it. Interactions are reported as `CustomEvent`s; **turning those into state changes is the host's job**, via `SchedulerManager`:

```js
import { SchedulerManager } from "@janus-scheduler/core";
const manager = new SchedulerManager();

document.querySelector("janus-timeline").addEventListener("event-move", (e) => {
  const { event, newStartTime, newEndTime } = e.detail;
  manager.updateEvent(event.id, {
    startTime: newStartTime,
    endTime: newEndTime,
  });
});
```

If you would rather not write that wiring, [`@janus-scheduler/app`](https://www.npmjs.com/package/@janus-scheduler/app) does all of it for you.

Events fired include `event-click`, `event-move`, `event-resize`, `event-create`, `slot-select`, `day-click`, `day-header-click`, `add-event`, `view-change`, `nav-change`, `conflict-detected`, and `save` / `delete` / `close` on the editor. All bubble and cross shadow boundaries.

## Properties vs attributes

Booleans and strings work as attributes (`show-fab`, `prevent-conflicts`, `timezone`). Arrays and objects must be set as **properties**:

```js
el.resources = [...];          // not an attribute
el.resourceTypeConfig = {...};
```

In Vue use `.prop` bindings and set `isCustomElement: (tag) => tag.startsWith("janus-")` in your compiler options. In Angular add `CUSTOM_ELEMENTS_SCHEMA`.

## Theming

There is **no CSS file to import**. Styles are Lit `css` templates inside Shadow DOM, so nothing leaks in or out. Theme with CSS custom properties on a host or ancestor:

```css
janus-timeline {
  --janus-primary-color: #4f46e5;
  --janus-primary-bg: #eef2ff;
}
```

The components do not load a webfont; load one in your own app if you want a specific typeface.

## Documentation

Full docs and the framework packages: [Janus-scheduler/main-program](https://github.com/Janus-scheduler/main-program).

## Licence

ISC
