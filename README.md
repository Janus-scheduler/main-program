# Janus Scheduler

Janus Scheduler is a modern, framework-agnostic scheduling and event management component library. Designed as a monorepo, it provides a robust core engine along with seamless wrappers for popular frontend frameworks like React, Angular, and Vue.

## Project Structure

This project uses npm workspaces to manage its multi-package architecture. It is organized into main `packages` and `demo` applications:

```text
├── packages/
│   ├── core/               # Core business logic, models, state management, and services
│   ├── utils/              # Shared utility functions and helpers
│   └── wrappers/
│       ├── angular-wrapper/ # Angular integration and components
│       ├── react-wrapper/   # React integration, including the Scheduler UI components
│       └── vue-wrapper/     # Vue integration and components
├── demo/
│   ├── angular-demo/       # Example application using the Angular wrapper
│   └── react-demo/         # Example application using the React wrapper (Vite)
```

## Features

- **Core Engine (`@janus-scheduler/core`)**: Handles the heavy lifting for events, resources, modeling, and API interactions decoupled from any UI framework.
- **Framework Wrappers**: Drop-in UI components for React, Angular, and Vue. For example, the `react-wrapper` provides a fully styled, customizable `<Scheduler />` modal card supporting:
  - Event title, description, date, and time configuration
  - Participant management
  - Color tagging and customizable event layouts
- **Demo Applications**: Ready-to-run demo applications to preview the scheduler components in their respective frameworks.

## Getting Started

### Prerequisites

- Node.js (v18+)
- npm (v9+)

### Installation

1. Clone the repository:

   ```bash
   git clone <repository-url>
   cd main-program
   ```

2. Install all workspace dependencies:
   ```bash
   npm install
   ```

### Running the Project Locally

The project includes several helpful npm scripts to run, test, and build the packages:

- **Run React Demo**: Starts the Vite dev server for the React example app.
  ```bash
  npm run dev:react-demo
  ```
- **Run Core in Dev Mode**:
  ```bash
  npm run dev:core
  ```

### Build & Validate

- **Build all packages and demos**:
  ```bash
  npm run build
  ```
- **Lint the codebase**:
  ```bash
  npm run lint
  ```
- **Run validation (lint + build)**:
  ```bash
  npm run validate
  ```
- **Run tests (Core)**:
  ```bash
  npm run test
  ```

## Development & Contribution

### Code Quality and Formatting

This repository enforces high code-quality standards using `eslint`, `prettier`, and `husky` for git hooks (commitlint and lint-staged).
Run `npm run format` to auto-format your code or `npm run lint:fix` to fix linting errors.

### Future Developments

When contributing new features:

1. **Business Logic**: Any non-visual logic, models, or state management should be placed in `packages/core`.
2. **Framework Specific UI**: Place framework-specific UI bindings and components inside their respective `packages/wrappers/*`.
3. **Utilities**: Any generic string/date manipulaton or pure functions can reside in `packages/utils`.
4. **Validation**: Test the components visually inside the corresponding `demo/*` applications.

## License

ISC
