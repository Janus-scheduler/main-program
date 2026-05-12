# Janus Scheduler — Developer Type Guide

> This document explains how types are structured across the monorepo, where each type lives, and the rules to follow when adding or modifying types. Read this before opening any type file.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Two-Layer Type System](#two-layer-type-system)
3. [Type Locations Reference](#type-locations-reference)
4. [Exported Types Quick Reference](#exported-types-quick-reference)
5. [Rules — Where to Put a New Type](#rules--where-to-put-a-new-type)
6. [Adding a New Type — Step-by-Step](#adding-a-new-type--step-by-step)
7. [Adding a New Property to an Existing Type](#adding-a-new-property-to-an-existing-type)
8. [Importing Types — The Right Source](#importing-types--the-right-source)
9. [Framework Wrapper Cheatsheet](#framework-wrapper-cheatsheet)
10. [Common Mistakes to Avoid](#common-mistakes-to-avoid)

---

## Architecture Overview

The monorepo is structured as follows:

```
main-program/
├── packages/
│   ├── core/                    ← All business logic & public type contracts
│   ├── ui/                      ← Lit web components (rendering only)
│   └── wrappers/
│       ├── angular-wrapper/
│       ├── react-wrapper/
│       ├── solid-js-wrapper/
│       └── vue-wrapper/         ← (empty, Vue uses the web components directly)
└── demo/
    ├── angular-demo/
    ├── react-demo/
    ├── solid-demo/
    └── vue-demo/
```

All type definitions flow **outward** from `@janus-scheduler/core`. Nothing imports types inward.

```
@janus-scheduler/core  →  @janus-scheduler/angular / react / solid
                       →  demo apps
```

---

## Two-Layer Type System

There are exactly **two layers** of types in this project. Mixing them up is the most common source of bugs and lint errors.

### Layer 1 — Public API / View-Model Types

**Location:** `packages/core/src/api/api.types.ts`

These are the types that cross the boundary between the internal scheduler engine and the outside world — framework wrappers, demo apps, and host applications. They represent what the **UI renders** and what **events return to the host app**.

| Type                  | Purpose                                               |
| --------------------- | ----------------------------------------------------- |
| `TimelineEvent`       | A single event chip rendered on the timeline          |
| `TimelineResource`    | A resource row (person / room / equipment)            |
| `MonthEvent`          | An event chip rendered on the month grid              |
| `EventMoveDetail`     | Payload of a drag-and-drop move event                 |
| `EventResizeDetail`   | Payload of a drag-and-drop resize event               |
| `EventCreateDetail`   | Payload of a drag-to-create event                     |
| `SchedulerSaveData`   | Payload from the modal form on save                   |
| `SchedulerDeleteData` | Payload from the modal form on delete                 |
| `JanusEventMap`       | Full map of all custom events fired by web components |
| `EventColor`          | Union of all valid event colors                       |
| `ViewType`            | `"Timeline" \| "Month"`                               |

### Layer 2 — Internal Domain Types

**Location:** `packages/core/src/types/` and collocated inside `packages/core/src/models/*/`

These are the raw data shapes used **within** the core package to create, update, and store data. They do not care about UI presentation.

| Type             | Location                                | Purpose                                     |
| ---------------- | --------------------------------------- | ------------------------------------------- |
| `EventData`      | `src/types/event.types.ts`              | Input shape for creating/updating events    |
| `ResourceData`   | `src/models/resources/resources.ts`     | Input shape for creating/updating resources |
| `AssignmentData` | `src/models/assignments/assignments.ts` | Input shape for creating assignments        |

### Domain Model Classes

**Location:** `packages/core/src/models/*/`

Classes with business logic methods. These are the objects stored in the Zustand store and passed to `SchedulerHooks` callbacks.

| Class        | File                                | Key Methods                  |
| ------------ | ----------------------------------- | ---------------------------- |
| `Event`      | `models/events/event.ts`            | `isValid()`, `getDuration()` |
| `Resource`   | `models/resources/resources.ts`     | `isValid()`                  |
| `Assignment` | `models/assignments/assignments.ts` | `isValid()`                  |

> [!NOTE]
> Domain model classes are exported from `@janus-scheduler/core` so that host apps implementing `SchedulerHooks` can type their callbacks correctly. They should **not** be used in UI components — use the public API view-model types there.

---

## Type Locations Reference

```
packages/core/src/
├── api/
│   ├── api.types.ts        ← PUBLIC: ViewType, EventColor, TimelineEvent,
│   │                          TimelineResource, MonthEvent, SchedulerSaveData,
│   │                          SchedulerDeleteData, EventMoveDetail,
│   │                          EventResizeDetail, EventCreateDetail, JanusEventMap
│   └── api.init.ts         ← Re-exports api.types.ts and EventBus
│
├── types/
│   └── event.types.ts      ← INTERNAL: EventData (input shape for store)
│
├── models/
│   ├── events/event.ts     ← INTERNAL: Event class + (co-located) EventData re-export
│   ├── resources/          ← INTERNAL: Resource class + ResourceData interface
│   └── assignments/        ← INTERNAL: Assignment class + AssignmentData interface
│
├── services/
│   └── SchedulerManager.service.ts  ← PUBLIC: SchedulerHooks interface
│
└── index.ts                ← THE ONLY FILE external packages should import from
```

---

## Exported Types Quick Reference

Import everything from `@janus-scheduler/core` — **never** from sub-paths.

```ts
// ✅ Correct
import type { TimelineEvent, ViewType, EventData } from "@janus-scheduler/core";
import { SchedulerManager, Event, Resource } from "@janus-scheduler/core";

// ❌ Wrong — never import from internal paths
import type { EventData } from "@janus-scheduler/core/src/types/event.types";
import type { TimelineEvent } from "@janus-scheduler/ui"; // Only OK inside @janus-scheduler/ui itself
```

### Full list of exports from `@janus-scheduler/core`

**Classes:**

- `SchedulerManager`
- `Event`, `Resource`, `Assignment`

**Interfaces & Types:**

- `SchedulerHooks`
- `SchedulerState`, `SchedulerActions`, `SchedulerStore`
- `TimelineEvent`, `TimelineResource`, `MonthEvent`
- `EventMoveDetail`, `EventResizeDetail`, `EventCreateDetail`
- `SchedulerSaveData`, `SchedulerDeleteData`
- `JanusEventMap`
- `EventColor`, `ViewType`
- `EventData`, `ResourceData`, `AssignmentData`
- `EventBus` (internal event system)

---

## Rules — Where to Put a New Type

Use this decision tree for every new type you create:

```
Is this type used OUTSIDE the core package?
├── YES → Does it describe UI presentation data (view models, event payloads)?
│         ├── YES → Put it in api/api.types.ts and export it from index.ts
│         └── NO  → Does it describe raw input data for the store?
│                   ├── YES → Put it in types/ or collocate with its model
│                   │         and export it from index.ts as `export type { ... }`
│                   └── NO  → Reconsider whether it belongs in core at all
└── NO  → Keep it private inside the file that uses it
```

### Quick Rules Summary

| Scenario                                            | Location                                               |
| --------------------------------------------------- | ------------------------------------------------------ |
| New event payload type (fired from a web component) | `api/api.types.ts`                                     |
| New view-model type (what UI components render)     | `api/api.types.ts`                                     |
| New color or shared literal union                   | `api/api.types.ts` as a named `type` alias             |
| New view name (`"Calendar" \| "Agenda"`)            | Add to `ViewType` in `api/api.types.ts`                |
| New domain entity creation input                    | Collocate with its model class, export from `index.ts` |
| New domain entity class                             | New file in `models/`, export from `index.ts`          |
| Props for a framework wrapper component             | In the wrapper's `index.ts` / component file           |

---

## Adding a New Type — Step-by-Step

### Example: Adding a new event payload type

Let's say you add a new web component event `"event-duplicate"` that fires `{ sourceId: string }`.

**Step 1** — Define the type in `api/api.types.ts`:

```ts
export interface EventDuplicateDetail {
  sourceId: string;
}
```

**Step 2** — Add it to `JanusEventMap` in the same file:

```ts
export interface JanusEventMap {
  // ... existing entries
  "event-duplicate": EventDuplicateDetail;
}
```

**Step 3** — `api.init.ts` already re-exports everything from `api.types.ts`, so it's automatically available via `@janus-scheduler/core`. No changes needed there.

**Step 4** — Re-export it from every framework wrapper that needs it:

```ts
// packages/wrappers/react-wrapper/index.ts
export type { EventDuplicateDetail } from "@janus-scheduler/core";

// packages/wrappers/solid-js-wrapper/index.tsx
import type { EventDuplicateDetail } from "@janus-scheduler/core";
export type { EventDuplicateDetail };

// packages/wrappers/angular-wrapper/src/lib/types.ts
export type { EventDuplicateDetail } from "@janus-scheduler/core";

// packages/wrappers/angular-wrapper/src/index.ts
export type { EventDuplicateDetail } from "./lib/types";
```

**Step 5** — Run the build to verify:

```bash
npm run build --workspaces --if-present
```

---

## Adding a New Property to an Existing Type

### Example: Adding `color` to `EventData`

`EventData` is the internal input shape. If you want to let callers specify a color when creating an event:

**Step 1** — Update `packages/core/src/types/event.types.ts`:

```ts
import type { EventColor } from "../api/api.types";

export interface EventData {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  resourceId: string;
  status?: "draft" | "confirmed" | "cancelled";
  description?: string;
  color?: EventColor; // ← new optional field
}
```

> [!TIP]
> Always use `EventColor` for color fields, never inline the union literal. This way, adding a new color in future only requires a change in one place.

**Step 2** — Update the `Event` model class to handle the new field:

```ts
// packages/core/src/models/events/event.ts
export class Event {
  // ...
  color: EventColor;

  constructor(data: EventData) {
    // ...
    this.color = data.color || "blue"; // default
  }
}
```

**Step 3** — Verify the store's `updateEvent` handles the new field in `scheduler.store.ts`.

**Step 4** — Run `npm run build --workspaces --if-present` to check for type errors across all demos.

---

## Importing Types — The Right Source

| In this file...                            | Import types from...                                               |
| ------------------------------------------ | ------------------------------------------------------------------ |
| `packages/core/src/**`                     | Relative paths (`../api/api.types`)                                |
| `packages/ui/src/**`                       | `@janus-scheduler/core`                                            |
| `packages/wrappers/angular-wrapper/src/**` | `@janus-scheduler/core` (never `@janus-scheduler/ui`)              |
| `packages/wrappers/react-wrapper/**`       | `@janus-scheduler/core`                                            |
| `packages/wrappers/solid-js-wrapper/**`    | `@janus-scheduler/core`                                            |
| `demo/react-demo/**`                       | `@janus-scheduler/react`                                           |
| `demo/angular-demo/**`                     | `@janus-scheduler/angular`                                         |
| `demo/solid-demo/**`                       | `@janus-scheduler/solid`                                           |
| `demo/vue-demo/**`                         | `@janus-scheduler/core` (Vue has no dedicated wrapper package yet) |

> [!IMPORTANT]
> **Never import from `@janus-scheduler/ui` for types** outside of the `ui` package and the wrapper packages' component implementations. The `@janus-scheduler/ui` package is for web component **class imports** (to trigger `customElements.define()`), not for shared type definitions.

---

## Framework Wrapper Cheatsheet

Each framework wrapper re-exports types from `@janus-scheduler/core`. When you add a new public type to core, you must propagate it through every wrapper.

### Angular wrapper

Three files to update:

```
src/lib/types.ts        ← Add to the export type { ... } block
src/index.ts            ← Add to the export type { ... } block
```

After editing, rebuild the package (the Angular wrapper uses `tsc` not Vite):

```bash
npm run build -w @janus-scheduler/angular
```

### React wrapper

One file to update:

```
index.ts                ← Add to the export type { ... } block
```

### Solid wrapper

One file to update, in two places:

```
index.tsx               ← Add to import type { ... } AND export type { ... }
```

> [!WARNING]
> The SolidJS wrapper uses a local `import type { ... }` block at the top, and then re-exports via `export type { ... }`. You **must** add new types to **both** the import block and the export block, otherwise you'll get a `Cannot find name` build error.

### Vue

Vue uses no dedicated wrapper package. Import types directly from `@janus-scheduler/core` in Vue components.

---

## Common Mistakes to Avoid

### ❌ Defining `ViewType` inline

```ts
// Wrong
const [view, setView] = createSignal<"Timeline" | "Month">("Month");

// Correct
import type { ViewType } from "@janus-scheduler/solid";
const [view, setView] = createSignal<ViewType>("Month");
```

### ❌ Defining `EventColor` inline

```ts
// Wrong
color: "orange" | "blue" | "yellow" | "purple" | "green";

// Correct
import type { EventColor } from "@janus-scheduler/core";
color: EventColor;
```

### ❌ Importing from `@janus-scheduler/ui` for types

```ts
// Wrong — @janus-scheduler/ui is the rendering layer, not a type library
import type { TimelineEvent } from "@janus-scheduler/ui";

// Correct
import type { TimelineEvent } from "@janus-scheduler/core";
```

### ❌ Importing from internal sub-paths

```ts
// Wrong — breaks encapsulation
import type { EventData } from "@janus-scheduler/core/src/types/event.types";

// Correct
import type { EventData } from "@janus-scheduler/core";
```

### ❌ Adding a new type to `api.types.ts` without propagating to wrappers

Every new public type in `api.types.ts` must be:

1. Added to the wrapper `types.ts` / `index.ts` files
2. Verified with `npm run build --workspaces --if-present`

### ❌ Forgetting to rebuild the Angular wrapper

The Angular wrapper uses `tsc` (not Vite), and its `dist/` can become stale. After editing any file under `packages/wrappers/angular-wrapper/src/`, always run:

```bash
npm run build -w @janus-scheduler/angular
```

---

## Checklist for Any Type Change

- [ ] Is the type in the right layer (public API vs internal domain)?
- [ ] Does `packages/core/src/index.ts` export it?
- [ ] Is it propagated through all four framework wrapper packages?
- [ ] Is `@janus-scheduler/angular` rebuilt after changes?
- [ ] Does `npm run build --workspaces --if-present` pass with exit code 0?
- [ ] Does `npm run lint` pass?
