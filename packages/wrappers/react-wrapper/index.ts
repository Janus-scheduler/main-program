import React from "react";
import { createComponent } from "@lit/react";
import {
  JanusScheduler as JanusSchedulerWC,
  JanusTimeline as JanusTimelineWC,
  JanusMonthGrid as JanusMonthGridWC,
} from "@janus-scheduler/ui";

export const Scheduler = createComponent({
  tagName: "janus-scheduler",
  elementClass: JanusSchedulerWC,
  react: React,
  events: {
    onClose: "close",
    onSave: "save",
    onDelete: "delete",
  },
});

export const Timeline = createComponent({
  tagName: "janus-timeline",
  elementClass: JanusTimelineWC,
  react: React,
  events: {
    onEventClick: "event-click",
    onViewChange: "view-change",
    onEventMove: "event-move",
    onEventResize: "event-resize",
    onEventCreate: "event-create",
    onAddEvent: "add-event",
  },
});

export const MonthGrid = createComponent({
  tagName: "janus-month-grid",
  elementClass: JanusMonthGridWC,
  react: React,
  events: {
    onEventClick: "event-click",
    onDayClick: "day-click",
    onAddEvent: "add-event",
    onViewChange: "view-change",
  },
});
