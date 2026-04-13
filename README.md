# Janus Scheduler

Janus Scheduler is a modern, **framework-agnostic** scheduling and event management component library. Built on [Lit](https://lit.dev/) Web Components, it follows the **DRY principle** by centralizing all UI in a single `@janus-scheduler/ui` package and providing thin framework adapters that wrap it — rather than duplicating UI logic per framework.

## Architecture Overview

```
                    ┌──────────────────────┐
                    │  @janus-scheduler/ui │  ← Lit Web Component
                    │   <janus-scheduler>  │     (framework-agnostic)
                    └──────────┬───────────┘
                               │ wraps
              ┌────────────────┼────────────────┐
              ▼                ▼                ▼
   @janus-scheduler/  @janus-scheduler/  @janus-scheduler/
       react            angular              vue
   (react-wrapper)   (angular-wrapper)  (vue-wrapper)
```

The core Web Component (`<janus-scheduler>`) is defined once using Lit, then each framework wrapper exposes it as a native component using the framework's own adapter (e.g. `@lit/react` for React).

## Project Structure

This project uses **npm workspaces** to manage its multi-package monorepo:

```text
├── packages/
│   ├── core/                    # Core business logic, models, services, state
│   ├── ui/                      # @janus-scheduler/ui — Lit Web Component library
│   │   └── src/
│   │       ├── janus-scheduler.ts   # <janus-scheduler> custom element (LitElement)
│   │       ├── styles.ts            # Component styles (encapsulated via Shadow DOM)
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

| Package                           | Name                     | Description                                                                     |
| --------------------------------- | ------------------------ | ------------------------------------------------------------------------------- |
| `packages/core`                   | `@janus-scheduler/core`  | Business logic, models (events, resources), interactions, services              |
| `packages/ui`                     | `@janus-scheduler/ui`    | Lit-based `<janus-scheduler>` Web Component — the single source of truth for UI |
| `packages/wrappers/react-wrapper` | `@janus-scheduler/react` | React adapter wrapping the Lit component via `@lit/react`                       |

## Features

### `@janus-scheduler/ui` — Lit Web Component

The `<janus-scheduler>` custom element is a fully self-contained scheduling modal built with Lit. It supports:

- **Event title, date, and time range** configuration (start/end times)
- **Participant management** — add via keyboard (Enter / comma), remove with one click
- **Color tagging** — 5 color options (orange, blue, green, yellow, purple)
- **Event description** field
- **Responsive layout** — collapsible sidebar with mobile summary panel
- **Shadow DOM encapsulation** — styles are fully scoped, no CSS bleeding
- Fires a `close` custom event when the modal is dismissed

### `@janus-scheduler/react` — React Wrapper

Wraps the Lit Web Component into a native React component using `@lit/react`:

```tsx
import { Scheduler } from "@janus-scheduler/react";

function App() {
  return <Scheduler onClose={() => console.log("closed")} />;
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
