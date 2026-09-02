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

// --- 5. Tier B: @janus-scheduler/app, the batteries-included package --------
const app = await import("@janus-scheduler/app");
const appReact = await import("@janus-scheduler/app/react");

check(
  "<janus-app> is registered",
  typeof customElements.get("janus-app") === "function",
);
check(
  "app's exported JanusApp is the registered element",
  customElements.get("janus-app") === app.JanusApp,
);
check(
  "@janus-scheduler/app/react exports a JanusApp component",
  typeof appReact.JanusApp === "object" ||
    typeof appReact.JanusApp === "function",
);
check(
  "app re-exports the facade (SchedulerManager) as the SAME class as core",
  app.SchedulerManager === core.SchedulerManager,
);

// The whole point of Tier B: mount it, hand it data, and it wires itself to the
// store with no host code. Reset first so the counts below are unambiguous.
manager.clearAll();
const appEl = document.createElement("janus-app");
appEl.resources = [{ id: "r9", name: "Room A", type: "room", email: "" }];
appEl.events = [
  {
    id: "e9",
    title: "Seeded",
    startTime: "2026-09-02T11:00:00.000Z",
    endTime: "2026-09-02T12:00:00.000Z",
    resourceIds: ["r9"],
    status: "confirmed",
  },
];
document.body.appendChild(appEl);
await appEl.updateComplete;

const appEvents = Object.values(core.schedulerStore.getState().events);
check(
  "<janus-app> seeds its events prop into the shared store",
  appEvents.some((e) => e.title === "Seeded"),
  `store sees: ${appEvents.map((e) => e.title).join(",") || "(none)"}`,
);
check(
  "<janus-app>.schedulerManager writes to that same store",
  appEl.schedulerManager instanceof core.SchedulerManager,
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
