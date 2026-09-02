// Proves the `.cjs` extension fix: before, `main` pointed at a `.cjs.js` file
// inside a `"type": "module"` package, which Node parsed as ESM and refused.
let failed = 0;
const t = (name, fn) => {
  try {
    fn();
    console.log("PASS  " + name);
  } catch (e) {
    failed++;
    console.log("FAIL  " + name + "\n      " + e.message.split("\n")[0]);
  }
};

t('require("@janus-scheduler/core")', () => {
  const core = require("@janus-scheduler/core");
  if (typeof core.SchedulerManager !== "function")
    throw new Error("no SchedulerManager export");
  if (!core.schedulerStore) throw new Error("no schedulerStore export");
});

t('require("@janus-scheduler/nlp")', () => {
  const nlp = require("@janus-scheduler/nlp");
  if (typeof nlp.beginSession !== "function")
    throw new Error("no beginSession export");
});

t("CJS core actually works (addResource round-trip)", () => {
  const { SchedulerManager, schedulerStore } = require("@janus-scheduler/core");
  const m = new SchedulerManager();
  m.addResource({ id: "x", name: "Bob", type: "room", email: "" });
  const n = Object.values(schedulerStore.getState().resources).length;
  if (n !== 1) throw new Error("expected 1 resource, got " + n);
});

console.log(failed ? `\n${failed} failed` : "\nall CJS entry points load");
process.exit(failed ? 1 : 0);
