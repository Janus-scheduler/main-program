# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Janus Scheduler — a framework-agnostic scheduling/event-management component library. Core state and business logic live in a single Zustand store (`@janus-scheduler/core`); UI is built once as Lit Web Components (`@janus-scheduler/ui`); thin per-framework wrapper packages expose those components idiomatically (React, Angular, SolidJS; Vue has no wrapper yet — see below). npm workspaces monorepo.

## Commands

Run from the repo root unless noted.

```bash
npm install                          # install all workspace deps

# Dev servers (demo apps)
npm run dev:react-demo
npm run dev:angular-demo
npm run dev:solid-demo
npm run dev:vue-demo                 # not a root script — cd demo/vue-demo && npm run dev

# Build
npm run build                        # build every workspace (--workspaces --if-present)
npm run build -w @janus-scheduler/angular   # Angular wrapper uses tsc, not Vite — rebuild explicitly after src changes, dist goes stale silently
cd packages/ui && npm run dev        # watch-mode build of the Lit UI package

# Lint / format
npm run lint
npm run lint:fix
npm run format

# Test (Jest, core package only — the only package with tests)
npm test                             # == npm run test -w @janus-scheduler/core
cd packages/core && npx jest tests/conflict.test.ts        # single file
cd packages/core && npx jest -t "some test name"           # single test by name
cd packages/core && npm run test    # runs with --coverage, outputs packages/core/coverage/lcov.info

# Full pre-merge check (what CI + pre-push hook run)
npm run validate                     # lint + build --workspaces --if-present
```

Git hooks (Husky): `pre-commit` runs `lint-staged` (eslint --fix + prettier on staged files), `pre-push` runs `npm run validate`. Commit messages are enforced by commitlint (`@commitlint/config-conventional` — conventional commits).

CI (`.github/workflows/build.yml`) runs on push/PR to `main`: `npm ci`, `npm test --workspace=packages/core` (for coverage), then a SonarQube scan.

## Architecture

### Data flow: core → ui → wrappers

```
@janus-scheduler/core   (Zustand vanilla store: events, resources, assignments)
        ↑ subscribes
@janus-scheduler/ui     (Lit Web Components: <janus-scheduler>, <janus-timeline>, <janus-month-grid>, <janus-ai-bar>)
        ↑ wraps (createComponent from @lit/react, or tsc-generated bindings for Angular)
@janus-scheduler/{react,angular,solid}   (thin per-framework packages; Vue consumes the web components directly)
```

- `packages/core/src/store/scheduler.store.ts` — the single Zustand vanilla store (`schedulerStore`). All state (`events`, `resources`, `assignments`, `timezone`, `eventDraft`) and mutating actions live here. Web components subscribe to this store directly for reactivity.
- `packages/core/src/services/SchedulerManager.service.ts` — `SchedulerManager` is the intended public API for host apps. Every mutating method follows **optimistic update + automatic rollback**: it writes to the store immediately (UI updates with no lag), then fires the matching lifecycle hook from `SchedulerHooks` (e.g. `onEventAdd`); if that hook throws or its returned promise rejects, the store change is rolled back and `onError` fires. When touching `addEvent`/`updateEvent`/`deleteEvent`/etc., preserve this pattern — don't write directly to `schedulerStore` from application code.
- `packages/core/src/api/EventBus.ts` — a separate pub/sub (`janusEventBus`), typed against `JanusEventMap` in `api.types.ts`, for custom-event-style notifications distinct from the Zustand store.
- `packages/ui/src/*` — Lit components (rendering only, no business logic). Key files: `janus-timeline.ts` (drag/resize/create grid, backed by `timeline-drag.ts`, `timeline-zoom.ts`, `timeline-utils.ts`), `janus-month-grid.ts`, `janus-scheduler.ts` (the event editor modal), `janus-ai-bar.ts`, `janus-topbar.ts`. Styles are colocated `*-styles.ts` files (Lit `css` tagged templates, Shadow DOM encapsulated).
- `packages/wrappers/*` — one directory per framework. React (`@lit/react`'s `createComponent`) and the others intercept native DOM `CustomEvent`s fired by the web components and unwrap `event.detail` before calling the consumer's callback, so consumers never see raw DOM events (see `docs/ARCHITECTURE_FACADE.md`).

### The Facade Pattern (read `docs/ARCHITECTURE_FACADE.md` before touching wrapper packages)

Framework wrapper packages re-export everything a consumer needs (`SchedulerManager`, timezone utils, domain classes, all public types) so host apps import **only** from their framework package, never reaching into `@janus-scheduler/core` or `@janus-scheduler/ui` directly. When adding something new to core that host apps need, you must re-export it from each wrapper too.

### Two-layer type system (read `docs/TYPE_GUIDE.md` before adding/changing types — it has a full decision tree and checklist)

- **Layer 1 — Public API / view-model types**: `packages/core/src/api/api.types.ts` (`TimelineEvent`, `TimelineResource`, `MonthEvent`, `EventMoveDetail`, `EventResizeDetail`, `EventCreateDetail`, `SchedulerSaveData`, `SchedulerDeleteData`, `JanusEventMap`, `EventColor`, `ViewType`). These cross the boundary to wrappers/host apps.
- **Layer 2 — Internal domain types**: `packages/core/src/types/event.types.ts` and colocated in `packages/core/src/models/*/` (`EventData`, `ResourceData`, `AssignmentData`) — raw input shapes for the store, plus the `Event`/`Resource`/`Assignment` domain classes.
- `packages/core/src/index.ts` is the **only** file external packages should import from — never import from internal sub-paths (`@janus-scheduler/core/src/...`) or from `@janus-scheduler/ui` for types (that package is for web-component class imports only).
- Adding a new public type means updating it in **four** places: `api.types.ts` (+ `JanusEventMap` if it's an event payload), then every wrapper that re-exports types (react-wrapper `index.ts`; solid-js-wrapper `index.tsx` — both an `import type` block AND an `export type` block; angular-wrapper `src/lib/types.ts` AND `src/index.ts`). Verify with `npm run build --workspaces --if-present`.

### Conflict detection

`packages/core/src/utils/conflict.ts` implements timezone-aware double-booking detection (`computeTimelineConflicts`, `checkSlotConflict`, `checkDraftConflict`). Behavior is controlled by the `preventConflicts` prop/option on `<janus-timeline>`/`<janus-scheduler>` (and the React `preventConflicts` prop): `false` (default) shows a dismissible warning banner and per-event warning badges; `true` hard-blocks the save/drag/resize/create action and shows a blocking dialog. `<janus-timeline>` fires a cancelable `conflict-detected` custom event (`onConflictDetected` in React/Solid) that consumers can `preventDefault()` on to override the built-in blocker.

### Recurrence

`packages/core/src/utils/recurrence.ts` (`expandEvents`) expands `recurrenceRule` (RRule strings, via the `rrule` package) into concrete event occurrences. Occurrence IDs follow the pattern `<parentId>_occ_<timestampMs>`; `SchedulerManager` methods (`getEvent`, `updateEvent`, `deleteEvent`) parse this suffix to resolve back to the parent event — see the regex handling in `SchedulerManager.service.ts` before changing occurrence ID formats.

### Google Calendar integration (`@janus-scheduler/integrations`)

Two entry points, two build steps (`vite build && tsc -p tsconfig.server.json`):

- **`@janus-scheduler/integrations`** (browser, Vite build from `src/index.ts`) — `GoogleSyncManager`, `GoogleCalendarClient`, `GoogleWebSocketListener`, `GoogleEventMapper`. Server code is never imported here; Vite externalizes `express`/`crypto`/`fs`/… so it can't leak into the bundle.
- **`@janus-scheduler/integrations/server`** (Node, `tsc` NodeNext build → `dist/server/`, `dist/types/`) — `createJanusApp(config)` returns `{ app, wsHub }` (Express app + `JanusWebSocketHub` — `wsHub.attach(httpServer)` after the server is created). `src/server/server.ts` is a runnable reference (env validation + webhook-renewal cron), started by `npm run start:backend` via ts-node; it is **not** exported.

Persistence is behind `TokenStore` / `CalendarStateStore` interfaces (`src/server/stores/`); the defaults `FileTokenStore` (AES-256-GCM + PBKDF2, back-compat read of legacy SHA-256 envelopes) and `FileCalendarStateStore` write JSON files in `process.cwd()`. A host overrides them via `createJanusApp({ tokenStore, calendarStateStore })`. **Single-tenant by design** — one Google account per process; multi-tenant is the host's job (DB-backed stores + their own auth middleware + webhook `channelId → account` routing). `tokenService.ts` / `calendarService.ts` keep free-function signatures and delegate to a module-level store swapped by `setTokenStore` / `setCalendarStateStore`; their read/write helpers are `async`.

### Package structure

```
packages/
├── core/            @janus-scheduler/core   — store, services, models, utils, api types (Jest-tested)
├── ui/               @janus-scheduler/ui     — Lit web components + styles (no tests)
├── integrations/     @janus-scheduler/integrations — Google Calendar sync; browser entry + `/server` Node entry (Jest-tested)
└── wrappers/
    ├── react-wrapper/       @janus-scheduler/react   (@lit/react createComponent bindings)
    ├── angular-wrapper/     @janus-scheduler/angular (tsc build, not Vite — rebuild manually)
    ├── solid-js-wrapper/    @janus-scheduler/solid
    └── vue-wrapper/         empty — Vue demo imports @janus-scheduler/core + @janus-scheduler/ui directly
demo/
├── react-demo/ angular-demo/ solid-demo/ vue-demo/   — one demo app per framework wrapper
```

Note: `packages/utils` mentioned in the root README does not currently exist — ignore that reference.

## Conventions

- ESLint flat config (`eslint.config.js`) intentionally sets `parserOptions.project: false` at the root to avoid multi-workspace `tsconfigRootDir` conflicts — add a per-package ESLint config if you need type-aware lint rules for that package.
- Unused vars/args are a lint warning unless prefixed with `_` (`argsIgnorePattern: "^_"`).
- Prettier `endOfLine: "auto"` is set deliberately to tolerate CRLF/LF differences on Windows — don't change this without reason.
- New visual/UI features belong in `packages/ui`; framework wrapper packages must stay thin adapters with no duplicated UI logic (per-framework behavior differences belong in the wrapper's event-mapping layer only).
