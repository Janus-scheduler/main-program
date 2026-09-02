import { JSDOM } from "jsdom";

// Minimal browser environment so the Lit elements can register.
const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  pretendToBeVisual: true,
  url: "http://localhost/",
});
for (const k of [
  "window",
  "document",
  "customElements",
  "HTMLElement",
  "Element",
  "Node",
  "CustomEvent",
  "Event",
  "navigator",
  "requestAnimationFrame",
  "cancelAnimationFrame",
  "getComputedStyle",
  "MutationObserver",
]) {
  globalThis[k] = dom.window[k];
}
globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const results = [];
const check = (name, pass, detail = "") => results.push({ name, pass, detail });

// --- 1. The dual-store test -------------------------------------------------
const core = await import("@janus-scheduler/core");
const react = await import("@janus-scheduler/react");
const ui = await import("@janus-scheduler/ui");

check(
  "schedulerStore identity: @janus-scheduler/react === @janus-scheduler/core",
  react.schedulerStore === core.schedulerStore,
);
check(
  "SchedulerManager identity: react === core",
  react.SchedulerManager === core.SchedulerManager,
);

// --- 2. A write through the wrapper's manager is visible to core's store -----
const manager = new react.SchedulerManager();
manager.addResource({
  id: "r1",
  name: "Alice",
  type: "person",
  email: "alice@example.com",
});
manager.addEvent({
  id: "e1",
  title: "Standup",
  startTime: "2026-09-02T09:00:00.000Z",
  endTime: "2026-09-02T09:30:00.000Z",
  resourceIds: ["r1"],
  status: "confirmed",
});

// events is a Record<string, Event>, not an array
const seenByCore = Object.values(core.schedulerStore.getState().events);
check(
  "manager.addEvent() from the wrapper is visible in core's store",
  seenByCore.length === 1 && seenByCore[0].title === "Standup",
  `core store sees ${seenByCore.length} event(s): ${seenByCore.map((e) => e.title).join(",")}`,
);
const seenRes = Object.values(core.schedulerStore.getState().resources);
check(
  "manager.addResource() from the wrapper is visible in core's store",
  seenRes.length === 1 && seenRes[0].name === "Alice",
  `core store sees ${seenRes.length} resource(s)`,
);

// --- 3. The web components read that same store -----------------------------
check(
  "<janus-timeline> is registered",
  typeof customElements.get("janus-timeline") === "function",
);
const TimelineClass = customElements.get("janus-timeline");
check(
  "ui's exported JanusTimeline is the registered element",
  TimelineClass === ui.JanusTimeline,
);

// --- 4. preventConflicts default --------------------------------------------
const el = new TimelineClass();
check(
  "janus-timeline preventConflicts defaults to false",
  el.preventConflicts === false,
  `got ${el.preventConflicts}`,
);

// --- report -----------------------------------------------------------------
let failed = 0;
for (const r of results) {
  if (!r.pass) failed++;
  console.log(
    `${r.pass ? "PASS" : "FAIL"}  ${r.name}${r.detail ? "  [" + r.detail + "]" : ""}`,
  );
}
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
