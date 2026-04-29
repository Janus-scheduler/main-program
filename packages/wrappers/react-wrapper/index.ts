import React from "react";
import { createComponent } from "@lit/react";
import {
  JanusScheduler as JanusSchedulerWC,
  JanusTimeline as JanusTimelineWC,
} from "@janus-scheduler/ui";

// The Lit @customElement decorator auto-registers the web components
// when the module is imported, so no manual customElements.define() needed.

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
    onAddEvent: "add-event",
    onEventMove: "event-move",
    onEventResize: "event-resize",
    onEventCreate: "event-create",
  },
});
