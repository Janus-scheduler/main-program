import React from "react";
import { createComponent } from "@lit/react";
import { JanusScheduler as JanusSchedulerWC } from "@janus-scheduler/ui";

// Register the custom element if it hasn't been registered yet
if (!customElements.get("janus-scheduler")) {
  customElements.define("janus-scheduler", JanusSchedulerWC);
}

export const Scheduler = createComponent({
  tagName: "janus-scheduler",
  elementClass: JanusSchedulerWC,
  react: React,
  events: {
    onClose: "close",
  },
});
