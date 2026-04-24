# Janus Scheduler — Angular Demo

This is the Angular implementation of the Janus Scheduler demo. It demonstrates how to consume the framework-agnostic `@janus-scheduler/ui` web components within an Angular application using the `@janus-scheduler/angular` wrapper.

## UI Consistency

The Angular demo is styled to match the React demo exactly, using the same **glassmorphism** design, sidebar layout, and professional color palette. Because both demos share the same underlying `@janus-scheduler/ui` package, they look and behave identically.

## Key Features

- **Sidebar Navigation**: Professional layout with brand icon and functional navigation items.
- **Timeline View**: Resource-based scheduling view with support for color-coded events.
- **Scheduler Modal**: Pop-up modal for editing and adding events, featuring a summary sidebar and detailed form.
- **Framework Agnostic**: The UI is rendered via Lit Web Components; Angular acts as a thin orchestration layer.

## Development

### Prerequisites

Ensure you have built the core and UI packages first:

```bash
# From the root
npm install
npm run build -w @janus-scheduler/ui
npm run build -w @janus-scheduler/angular
```

### Run Server

```bash
npm run dev
# or directly
npx ng serve
```

Open `http://localhost:4200` to see the demo.

## Implementation Details

The demo uses:

- **Standalone Components**: `App` component is standalone.
- **ViewEncapsulation.None**: Used in the main `App` component to allow the shared CSS variables and shell styles to apply globally (matching the React demo's behavior).
- **Control Flow**: Uses Angular 17+ `@if` block syntax for the conditional scheduler modal.
