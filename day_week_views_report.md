# Janus Scheduler: Day & Week View Documentation

This document outlines the architecture, features, and integration patterns for the newly implemented **Day View** and **Week View** components within the Janus Scheduler ecosystem. These views are designed to provide granular, time-based visualization of events over a 24-hour cycle.

## 1. Overview

The **Day Grid (`janus-day-grid`)** and **Week Grid (`janus-week-grid`)** are core calendar components built on top of a shared abstract foundation (`TimeGridBase`).

- **Day View**: Provides an expanded, high-resolution vertical time axis for a single selected day.
- **Week View**: Provides a 7-day horizontal layout with the same vertical time axis, allowing for multi-day scheduling and cross-day drag-and-drop operations.

Both components render events natively by automatically subscribing to the centralized `schedulerStore`, ensuring that any changes to the underlying event data or resource assignments are immediately reflected in the UI.

## 2. Key Features & Capabilities

### 2.1 Drag-and-Drop (Move)

Users can seamlessly drag event cards across different time slots. In the Week View, this includes dragging events horizontally across different days.

- **Under the hood**: The component fires an `onEventMove` event emitting the `newDate`, `newStartTime`, and `newEndTime`, which the wrapper seamlessly translates into an ISO timestamp update in the state manager.

### 2.2 Event Resizing

Events can be resized to extend or shrink their duration by grabbing the bottom edge of the event card.

- **Under the hood**: Resizing fires an `onEventResize` event containing the exact updated `endTime` while preserving the original `startTime`.

### 2.3 Time Slot Selection (Creation)

Users can click or drag over empty time slots to quickly initialize the creation of a new event.

- **Under the hood**: This triggers an `onSlotSelect` event containing the highlighted `date`, `startTime`, and `endTime`. The host application (e.g., the React demo) intercepts this to pre-fill the Scheduler Modal form with exact timings, vastly improving the UX.

### 2.4 Automatic Resource Avatars

A critical requirement for complex scheduling is knowing _who_ and _what_ is assigned to an event at a glance.

- **Implementation**: The Day and Week grids dynamically query the `schedulerStore` for assigned resources (Doctors, Rooms, Equipment).
- **UI Treatment**: Avatars are automatically rendered as a compact, overlapping stack pinned to the **bottom-right** of the event card. Depending on the resource type, the avatar renders an image, initials, or fixed-tinted icons (e.g., neutral/amber for rooms and equipment so they don't blend into the primary event color).
- **Responsive Handling**: If an event card is too narrow or there are too many resources, the avatars gracefully clip and append a `+N` badge to indicate overflow without breaking the card layout.

### 2.5 Drill-Down Navigation

The Week View acts as a macro-view that supports micro-interactions.

- **Feature**: Clicking on a specific day header within the Week View fires an `onDayClick` event. The host application intercepts this to immediately switch the context to the Day View for that exact date, allowing users to drill down from a 7-day overview into a focused 1-day layout seamlessly.

## 3. Integration & Usage (React)

The React Wrapper exposes these web components as native React components (`<DayGrid>` and `<WeekGrid>`). Integration is straightforward as the component manages internal rendering while offloading business logic (saving/updating) to the host.

### Example Implementation

```tsx
import { DayGrid, WeekGrid } from "@janus-scheduler/react";

// 1. Rendering the Week View
{
  currentView === "Week" && (
    <WeekGrid
      ref={weekGridRef}
      showFab={true}
      allowCreate={allowCreate}
      // Core Interactions
      onAddEvent={() => onOpenScheduler()}
      onEventClick={(ev) => onOpenScheduler(ev?.id)}
      // Time Grid Specific Actions
      onSlotSelect={handleSlotSelect}
      onEventMove={handleTimeGridMove}
      onEventResize={handleTimeGridResize}
      // Navigation
      onDayClick={(detail) => {
        // Drill-down logic:
        pendingDate.current = detail.date;
        onViewChange("Day");
      }}
      onViewChange={(detail) => onViewChange(detail.view)}
      onNavChange={handleNavChange}
    />
  );
}

// 2. Rendering the Day View
{
  currentView === "Day" && (
    <DayGrid
      ref={dayGridRef}
      showFab={true}
      allowCreate={allowCreate}
      onAddEvent={() => onOpenScheduler()}
      onEventClick={(ev) => onOpenScheduler(ev?.id)}
      onSlotSelect={handleSlotSelect}
      onEventMove={handleTimeGridMove}
      onEventResize={handleTimeGridResize}
      onViewChange={(detail) => onViewChange(detail.view)}
      onNavChange={handleNavChange}
    />
  );
}
```

## 4. Theming and Aesthetics

The Day and Week views are fully compatible with the Janus primary theme engine. By overriding the `--janus-primary-color` CSS variable at the root level, the time grid selections, active states, and event cards automatically adapt their styling. This guarantees visual consistency with the Timeline and Month views without requiring component-specific CSS adjustments.
