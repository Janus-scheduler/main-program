# Janus Scheduler

Janus Scheduler is a modern, **framework-agnostic** scheduling and event management component library. Built on [Lit](https://lit.dev/) Web Components, it follows the **DRY principle** by centralizing all UI in a single `@janus-scheduler/ui` package and providing thin framework adapters that wrap it — rather than duplicating UI logic per framework.

## Architecture Overview

```
                    ┌──────────────────────────────────────────────┐
                    │               @janus-scheduler/core          │
                    │   (Zustand State Store: Events, Resources)   │
                    └──────────────────────┬───────────────────────┘
                                           │ subscribes
                    ┌──────────────────────┴───────────────────────┐
                    │               @janus-scheduler/ui            │
                    │   <janus-scheduler>, <janus-timeline>,       │
                    │   <janus-month-grid>                         │
                    └──────────────────────┬───────────────────────┘
                                           │ wraps
               ┌───────────────────────────┼───────────────────────────┐
               ▼                           ▼                           ▼
    @janus-scheduler/              @janus-scheduler/           @janus-scheduler/
         react                          angular                       vue
    (react-wrapper)                 (angular-wrapper)             (vue-wrapper)
```

The core data (events, resources) lives centrally in `@janus-scheduler/core` using a framework-agnostic **Zustand** store. The Lit Web Components (`<janus-scheduler>`, `<janus-timeline>`, `<janus-month-grid>`) automatically subscribe to this store and react to changes. Finally, each framework wrapper exposes these web components natively using the framework's own adapter (e.g., `@lit/react` for React).

## Project Structure

This project uses **npm workspaces** to manage its multi-package monorepo:

```text
├── packages/
│   ├── core/                    # Core business logic, Zustand state, models, services
│   ├── ui/                      # @janus-scheduler/ui — Lit Web Components library
│   │   └── src/
│   │       ├── janus-scheduler.ts   # <janus-scheduler> modal element
│   │       ├── janus-timeline.ts    # <janus-timeline> grid view element
│   │       ├── janus-month-grid.ts  # <janus-month-grid> calendar element
│   │       └── index.ts             # Public package entry point
│   ├── utils/                   # Shared utility functions and helpers
│   └── wrappers/
│       ├── react-wrapper/       # @janus-scheduler/react — React adapter via @lit/react
│       ├── angular-wrapper/     # Angular integration (planned)
│       └── vue-wrapper/         # Vue integration (planned)
├── demo/
│   ├── react-demo/              # Vite + React demo consuming @janus-scheduler/react
│   └── angular-demo/            # Angular demo application
```

## Packages

| Package                           | Name                     | Description                                                                   |
| --------------------------------- | ------------------------ | ----------------------------------------------------------------------------- |
| `packages/core`                   | `@janus-scheduler/core`  | Business logic, models, **Zustand reactive store**, and scheduling services   |
| `packages/ui`                     | `@janus-scheduler/ui`    | Lit Web Components — Timeline, Month Grid, and Scheduling Modal UI components |
| `packages/wrappers/react-wrapper` | `@janus-scheduler/react` | React adapter wrapping the Lit components via `@lit/react`                    |

## Features

### `@janus-scheduler/core` — Reactive State Management

Instead of each wrapper managing its own state, the core layer implements a framework-agnostic reactive store using **Zustand** (vanilla JS).

- Exposes a robust `SchedulerManager` facade to initialize and interact with the state.
- Enables single-source-of-truth reactivity: Web Components subscribe directly to the core store.

### `@janus-scheduler/ui` — Lit Web Components

The UI library contains fully self-contained scheduling Web Components built with Lit:

- **`<janus-timeline>`**: A responsive daily/weekly timeline grid supporting drag-and-drop event creation, resizing, and moving. Resources are automatically grouped by type.
- **`<janus-month-grid>`**: A classic monthly calendar view summarizing events per day.
- **`<janus-scheduler>`**: A modal component supporting event configuration, participant management, and color tagging.

Features:

- Shadow DOM encapsulation prevents CSS bleeding.
- Responsive layouts and modern UI aesthetics.

### `@janus-scheduler/react` — React Wrapper

Wraps the Lit Web Component into a native React component using `@lit/react`:

```tsx
import { Timeline, MonthGrid, Scheduler } from "@janus-scheduler/react";
import { SchedulerManager } from "@janus-scheduler/core";

// Initialize core state manager
const manager = new SchedulerManager();
manager.addResource({ id: "1", name: "Alice", type: "person" });

function App() {
  return <Timeline onAddEvent={() => console.log("Add event clicked")} />;
}
```

The `onClose` prop is automatically mapped to the `close` DOM custom event.

## Getting Started

### Prerequisites

- Node.js v18+
- npm v9+

### Installation

1. Clone the repository:

   ```bash
   git clone <repository-url>
   cd main-program
   ```

2. Install all workspace dependencies from the root:
   ```bash
   npm install
   ```

### Running the React Demo

```bash
# Option 1 — via root script
npm run dev:react-demo

# Option 2 — directly
cd demo/react-demo
npm run dev
```

The demo will be available at `http://localhost:5173`.

### Building Packages

Build the `@janus-scheduler/ui` Lit component (watch mode for development):

```bash
cd packages/ui
npm run dev      # watch mode
npm run build    # single build
```

Build the React wrapper:

```bash
cd packages/wrappers/react-wrapper
npm run build
```

Build everything at once from the root:

```bash
npm run build
```

## Development

### Code Quality

This repo enforces quality via `eslint`, `prettier`, and `husky` git hooks (commitlint + lint-staged).

```bash
npm run lint        # Check for lint errors
npm run lint:fix    # Auto-fix lint errors
npm run format      # Format all files with Prettier
npm run test        # Run core tests
npm run validate    # lint + build all packages
```

#### ESLint Configuration Notes

- The root `eslint.config.js` uses **flat config** (ESLint v9+).
- Type-aware parsing (`project: true`) is **intentionally disabled** at the root level to avoid `tsconfigRootDir` ambiguity across multiple workspaces. Each package can define its own ESLint config if type-aware rules are needed.
- `endOfLine: "auto"` is set in prettier to handle CRLF/LF differences on Windows.

### Adding a New Framework Wrapper

1. Create a new directory under `packages/wrappers/<framework>-wrapper/`.
2. Import `JanusScheduler` from `@janus-scheduler/ui`.
3. Use the framework's Web Component adapter (e.g. `@angular/elements` for Angular) to expose it as a native component.
4. Add a corresponding demo under `demo/<framework>-demo/`.

### Contributing Guidelines

| Area                          | Location                                 |
| ----------------------------- | ---------------------------------------- |
| Business logic, models, state | `packages/core/src/`                     |
| Shared UI component           | `packages/ui/src/janus-scheduler.ts`     |
| Styles                        | `packages/ui/src/styles.ts`              |
| Framework bindings            | `packages/wrappers/<framework>-wrapper/` |
| Visual validation             | `demo/<framework>-demo/`                 |

> **Rule:** Any new visual feature belongs in `packages/ui`. Framework wrappers should remain thin adapters — no UI logic should be duplicated per framework.

## Tech Stack

| Tool                                                                                              | Purpose                                          |
| ------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| [Zustand](https://zustand-demo.pmnd.rs/)                                                          | Framework-agnostic centralized state management  |
| [Lit](https://lit.dev/)                                                                           | Web Component authoring (`@janus-scheduler/ui`)  |
| [@lit/react](https://github.com/lit/lit/tree/main/packages/react)                                 | React ↔ Web Component bridge                     |
| [Vite](https://vitejs.dev/) + [vite-plugin-dts](https://github.com/qmhc/vite-plugin-dts)          | Package bundling and type declaration generation |
| [TypeScript](https://www.typescriptlang.org/)                                                     | Static typing across all packages                |
| [ESLint](https://eslint.org/) + [Prettier](https://prettier.io/)                                  | Code quality and formatting                      |
| [Husky](https://typicode.github.io/husky/) + [lint-staged](https://github.com/okonet/lint-staged) | Pre-commit hooks                                 |
| [Commitlint](https://commitlint.js.org/)                                                          | Conventional commit message enforcement          |
| npm Workspaces                                                                                    | Monorepo package management                      |

## License

ISC
