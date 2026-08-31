# NLP + Conversational Chat — Progress Tracker

Living checklist for the natural-language scheduling feature: a frozen
zero-dependency intent classifier (`@janus-scheduler/nlp`) plus a
verify-then-act conversational UI (`<janus-chat>`).

**The end story:** a user types _"Schedule a design sync with Alex tomorrow at
10am in Room A"_ → the system understands it → shows what it understood →
**only after the user confirms** does the event get created.

**Working protocol:** one step at a time. Each step ends with automated checks
being run and their real output pasted, then the step is parked at
🟦 _awaiting your verification_. No work starts on step _N+1_ until you sign off.

---

## Status

Legend: ⬜ not started · 🟨 in progress · 🟦 awaiting your verification · ✅ verified · ⛔ blocked

| #   | Step                                        | Status | Verified |
| --- | ------------------------------------------- | ------ | -------- |
| 0   | Tracker + package skeleton                  | ✅     | you      |
| 1   | `packages/nlp` port + parity 120/120        | ✅     | you      |
| 2   | `routing_fixtures.json` + routing 237/237   | ✅     | you      |
| 3   | Entity extraction + time resolver           | ✅     | you      |
| 4   | `<janus-chat>` five states (fixture-driven) | ✅     | you      |
| 5   | Dialogue manager (slot filling)             | ✅     | you      |
| 6   | Wire to SchedulerManager + React demo       | ✅     | you      |
| 6b  | Ask for missing details (host requirements) | ✅     | you      |
| 6c  | Typo tolerance + honest disclosure          | ✅     | you      |
| 6d  | Intent-aware cards + package encapsulation  | ✅     | you      |
| 7   | Tokens / responsive / a11y + CI + docs      | ⬜     |          |

**Step 6b was not in the plan.** You found it: _"if I asked to schedule a
meeting, it is guessing some details that we are not giving — in the real case
they need to ask from user as thread."_ Right, and Step 7 (tokens, a11y, CI)
would never have covered it.

---

## Step 0 — Tracker + package skeleton ✅

Scaffolding only. **No algorithm code** — that is Step 1. The point of this step
is that you can confirm the packaging shape is right before 445 lines of frozen
logic land on top of it.

### What changed

| file                                | why                                                                             |
| ----------------------------------- | ------------------------------------------------------------------------------- |
| `docs/NLP_CHAT_PROGRESS.md`         | this tracker                                                                    |
| `packages/nlp/package.json`         | **no `dependencies` key at all**; dual `.` / `./node` exports                   |
| `packages/nlp/vite.config.ts`       | multi-entry lib build (first in this repo) — see note below                     |
| `packages/nlp/jest.config.cjs`      | copied from `packages/core/jest.config.cjs`                                     |
| `packages/nlp/tsconfig.json`        | extends root; `lib: ["ES2022"]` — no `DOM`, the package is environment-agnostic |
| `packages/nlp/.gitignore`           | ignores `dist`, `coverage`                                                      |
| `packages/nlp/src/index.ts`         | pure entry stub (exports `NLP_VERSION`)                                         |
| `packages/nlp/src/node.ts`          | Node-only stub (`artifactsDir()`, `readArtifact()`)                             |
| `packages/nlp/fixtures/parity.json` | 120 golden rows, copied byte-identical from the research repo                   |

### How to verify it yourself

```bash
# 1. Workspace registers (root workspaces glob is packages/**, so no root edit needed)
npm install
npm ls @janus-scheduler/nlp        # should resolve to packages/nlp

# 2. Build produces BOTH entries, es + cjs + types
npm run build -w @janus-scheduler/nlp
ls packages/nlp/dist
#   expect: index.es.js  index.cjs  index.d.ts
#           node.es.js   node.cjs   node.d.ts   (+ .map files)

# 3. The pure entry really is pure — this must print NOTHING
grep -E "readFileSync|node:fs|require\(.fs.\)" packages/nlp/dist/index.es.js packages/nlp/dist/index.cjs

# 4. Zero runtime dependencies
node -e "const p=require('./packages/nlp/package.json'); console.log('deps:', p.dependencies ?? 'NONE')"

# 5. Both module formats actually load, and ./node can read an artifact
node -e "
const pure = require('./packages/nlp/dist/index.cjs');
console.log('pure entry  ->', pure.NLP_VERSION);
const n = require('./packages/nlp/dist/node.cjs');
console.log('node entry  ->', n.artifactsDir());
console.log('vocab bytes ->', n.readArtifact('vocab.json').length);
"

# 6. Fixture + artifacts are byte-identical to the research repo
ls -la packages/nlp/fixtures/parity.json    # 1,360,558 bytes
ls -la packages/nlp/artifacts/              # vocab.json, prototypes.json, vectors.bin

# 7. Lint / format clean
npx eslint packages/nlp --ext .ts
npx prettier --check "packages/nlp/**/*.{ts,json,cjs}" docs/NLP_CHAT_PROGRESS.md
```

**What a pass looks like:** build exits 0; six JS files + two `.d.ts` in `dist/`;
check 3 prints nothing; check 4 prints `deps: NONE`; check 5 prints `0.1.0`, the
artifacts path, and `487267`; checks 7 exit 0.

### Notes / deviations from the plan

- **`rollupTypes` had to be turned off.** `packages/core/vite.config.ts` uses
  `dts({ rollupTypes: true })`, which flattens the whole package into one
  `.d.ts`. That is incompatible with two entries — it would collapse `./node`
  into `.` and destroy the purity guarantee. We use per-file declaration output
  instead, which is what makes both `dist/index.d.ts` and `dist/node.d.ts`
  exist. Documented at the top of `packages/nlp/vite.config.ts`.
- **`files` field instead of `.npmignore`.** The plan said `.npmignore`; the
  `files` allowlist in `package.json` is the same guarantee, stricter by
  default, and matches what `packages/core` already does.
- **The CJS bundle is `index.cjs`, not `index.cjs.js`.** Caught by actually
  `require()`-ing the build rather than trusting the file listing: this package
  declares `"type": "module"`, so Node parses **any** `.js` file as ESM. A
  CommonJS bundle named `index.cjs.js` therefore loads as an ESM module with no
  exports — `require(...).NLP_VERSION` came back `undefined`. `.cjs` is
  CommonJS regardless of the `type` field. **`packages/core` has this same
  latent bug** (`dist/janus-scheduler.cjs.js` under `"type": "module"`); it is
  invisible today because every consumer imports it as ESM. Not fixed here —
  out of scope, but worth a follow-up.
- **New root `.prettierignore`.** `packages/nlp/artifacts/` and
  `packages/nlp/fixtures/` are frozen data, not source. Prettier wanted to
  reformat all four files, which would break the `cmp` provenance check against
  the research repo and inflate a 1.3 MB golden fixture. The repo had no
  `.prettierignore` at all before this.
- **Artifacts were already in place and are byte-identical** to
  `NLP-Learn/static-embedding/packages/nlp/src/artifacts/` — verified with
  `cmp` on all three files. Nothing was re-copied.

---

## Step 1 — `packages/nlp` port + parity 120/120 ✅

The frozen classifier, ported from the research repo's `bin/index.js` into 11
typed ES modules.

**Source correction (recorded here so it survives context loss):** the brief
said `packages/nlp/reference/index.js`. That path does not exist. The
parity-verified implementation is at
`C:/Users/HP/Desktop/NLP-Learn/static-embedding/packages/nlp/bin/index.js`
(445 lines), and the parity harness is `bin/parity_check.js` (141 lines). The
research repo's own `src/embed.ts` / `src/intent.ts` are Phase-1 pseudocode —
`PROJECT.md` calls them "a trap"; they were not used as the port source.

### What changed

| file                        | source lines in `bin/index.js`          | contents                                                     |
| --------------------------- | --------------------------------------- | ------------------------------------------------------------ |
| `src/constants.ts`          | 30-40, 54-84, 173-204, 215-232, 297-303 | every frozen constant, one file, each gotcha commented       |
| `src/types.ts`              | new                                     | `Intent`, `Route`, `Gate`, `Artifacts`, `Prototype`, results |
| `src/normalize.ts`          | 42-101                                  | `escapeRe`, `alternation`, `normalize`                       |
| `src/wordpiece.ts`          | 107-137                                 | greedy longest-match, whole-word `[UNK]` rule                |
| `src/embed.ts`              | 141-169, 256-260                        | dequantize → Zipf mean → L2; `cosine`                        |
| `src/preprocess.ts`         | 173-252                                 | `stripSlots`, `headVerbPhraseLexicon`                        |
| `src/classify.ts`           | 262-293                                 | dual-vector kNN, max-per-intent vote, `none`-skipping margin |
| `src/gates.ts`              | 297-372                                 | anchors, negation, `routeFromClassification`, `routeQuery`   |
| `src/artifacts.ts`          | 376-401 (decode half)                   | **pure** `parseArtifacts` / `parsePrototypes`                |
| `src/index.ts`              | new                                     | pure entry — no `fs`, no `fetch`                             |
| `src/node.ts`               | 376-401 (fs half)                       | `loadArtifacts` / `loadPrototypes`                           |
| `tests/parity.test.ts`      | port of `bin/parity_check.js`           | the 120/120 acceptance gate                                  |
| `tests/pipeline.test.ts`    | new                                     | end-to-end smoke: classify + all gates                       |
| `tests/node-loader.test.ts` | new                                     | the fs loader, tested against the real build                 |

**The algorithm is FROZEN.** Every decision that looks like a bug carries a
comment naming the ALGORITHM.md section that justifies it — `none`'s α=1/β=0
asymmetry (§7 / Task 4.5), the margin skipping `none` even when `none` wins
(§7 / Check 4), gates running on pre-strip raw text (§8), the whole-word `[UNK]`
rule (§2), the six deliberately-omitted contractions (§1), `lunch` left in
`EVENT_NOUNS` (§8), unreachable verbs retained in `INTENT_VERBS` (§6). Nothing
was "improved".

### How to verify it yourself

```bash
# The acceptance gate — 120/120 parity plus the smoke and loader suites
npm run build -w @janus-scheduler/nlp   # node-loader.test.ts needs dist/
npm test -w @janus-scheduler/nlp

# Look for these three lines in the output:
#   Test Suites: 3 passed, 3 total
#   Tests:       633 passed, 633 total
#   ✓ 120/120 fixtures pass all four assertions

# Try it by hand on a sentence of your own
node -e "
const { routeQuery } = require('./packages/nlp/dist/index.cjs');
const { loadArtifacts, loadPrototypes } = require('./packages/nlp/dist/node.cjs');
const a = loadArtifacts(), p = loadPrototypes();
for (const q of process.argv.slice(1)) {
  const r = routeQuery(q, a, p);
  console.log(\`\${r.route.padEnd(8)} \${(r.gate ?? '-').padEnd(20)} \${r.intent.padEnd(13)} conf=\${r.confidence.toFixed(3)} margin=\${r.margin.toFixed(3)}  \${JSON.stringify(q)}\`);
}
" "schedule a design sync tomorrow at 10am" "cancel the standup" "schedule a meeting with sarah" "what is the weather like"

# Repo-wide checks still clean
npm run lint
npx tsc --noEmit -p packages/nlp/tsconfig.json
```

**What a pass looks like:** 633/633 tests, the `120/120` test green, `lint`
exit 0, `tsc` silent. The hand-run prints `PROCEED` for the first sentence,
`CLARIFY`/`REJECT` with a named gate for the rest.

### My run

```
Test Suites: 3 passed, 3 total
Tests:       633 passed, 633 total       (120 fixtures × 5 + smoke + loader)
Coverage:    91.6% stmts / 73.75% branch

  parity.test.ts     611 passed   — incl. "120/120 fixtures pass all four assertions"
  pipeline.test.ts    22 passed   — classify + every gate
  node-loader.test.ts  6 passed   — fs loader against dist/

npx tsc --noEmit -p tsconfig.json     → clean
npm run lint (whole repo)             → exit 0
purity grep on dist/index.*           → no match (no fs in the pure entry)
```

### Notes / deviations

- **A REAL JS↔Python divergence was found, and deliberately NOT fixed.**
  ALGORITHM.md §6 step 3 says the verb-phrase fallback is "the first `\w+`
  token". Python's `re` treats `\w` as Unicode-aware on `str` patterns; JS
  hard-wires it to `[A-Za-z0-9_]`. So for the fixture
  `"café meeting at naïve resort"` Python yields `"café"` and JavaScript yields
  `"caf"` — and the reference `bin/index.js` yields `"caf"` too, so this is a
  pre-existing property of the JS side, not a porting error.

  It is **inert**: `normalize()` runs next and strips non-ASCII via `PUNCT_RE`,
  so both spellings normalize to `"caf"` and produce identical `ids_verb` and
  `vec_verb`. That is exactly why all four official parity assertions pass
  120/120, and why `bin/parity_check.js` — which only checked normalized text,
  ids and cosines — never surfaced it. Fixing it would be an unrequested change
  to a frozen algorithm with no Python left to re-verify against. It is pinned
  by two tests instead, so a _second_ divergence would fail loudly.

- **The parity test loads artifacts via the pure `parseArtifacts()`, not via
  `src/node.ts`.** `src/node.ts` uses `import.meta.url`, which is correct in the
  shipped ESM build and rewritten by Vite for the CJS build — but ts-jest
  transpiles straight to CommonJS, where `import.meta` is a _syntax_ error even
  in a dead branch. The loader is covered instead by `node-loader.test.ts`
  against the real `dist/node.cjs`, which is the stronger test anyway: it proves
  what consumers actually `require()` finds its own artifacts.

- **Two `TIME_RE` instances instead of one shared `/gi`.** `preprocess.ts` keeps
  the `/gi` instance for `.replace`; `gates.ts` builds a `/i` instance from the
  same exported source string for `.test`. The original shared one object and
  worked only because of a manual `lastIndex = 0` reset before each test
  (`bin/index.js` L313), since `.test` on a global regex is stateful.
  Behaviour is identical; the failure mode is removed.

- **`node.ts` shows 0% coverage.** It is fully exercised, but through the built
  `dist/node.cjs`, which Jest cannot attribute back to the source file. Not a
  gap.

- **ALGORITHM.md §5 is "Slot stripping", not a list of gotchas.** The brief said
  "§5 lists decisions that look like bugs". The doc has no such list — those
  decisions are spread across §1, §2, §5–§8, plus the Task 4.5 and Check 4
  sections. Comments in the code cite the section that actually justifies each
  one.

---

## Step 2 — `routing_fixtures.json` + routing 237/237 ✅

`PROJECT.md` §7 listed generating this fixture as a "do this **before**
migrating" TODO that was never executed. It is executed now — once — and its
output committed.

> **This asserts JS ≡ Python agreement, not classification accuracy.**
> ALGORITHM.md's own measured numbers are 87.5% `none`-recall and 2.86%
> false-accept — 100% accuracy is impossible by construction. What must be 100%
> is that the TypeScript port makes the _identical decision_ Python does on all
> 237 rows. It is the only thing that can catch a wrong `CONF_FLOOR`, an
> inverted margin, a reordered gate or a typo in `EVENT_NOUNS`, because
> `parity.json` structurally cannot — it never calls `classify()` or any gate.

**Python is not a dependency of anything.** It ran once, on this machine, to
produce a static JSON file. The test suite, CI, and the published npm package
all read the committed JSON. `package.json`'s `files` allowlist is
`["dist", "artifacts", "docs"]`, so `fixtures/` is not even published.

### What changed

| file                                                  | why                                                   |
| ----------------------------------------------------- | ----------------------------------------------------- |
| `packages/nlp/fixtures/routing_fixtures.json`         | 237 Python-generated golden rows                      |
| `packages/nlp/fixtures/README.md`                     | full provenance for both fixtures + how to regenerate |
| `packages/nlp/fixtures/tools/gen_routing_fixtures.py` | the generator, kept so the fixture is reproducible    |
| `packages/nlp/fixtures/tools/spacy_stub/`             | inert import shim (see below)                         |
| `packages/nlp/tests/routing.test.ts`                  | the 237/237 agreement test                            |
| `.prettierignore`                                     | narrowed from `fixtures/` to `fixtures/*.json`        |

| source                                       | rows                      |
| -------------------------------------------- | ------------------------- |
| `corpus/dev.jsonl`                           | 105                       |
| `scripts/typo_robustness_check.py` TYPO_ROWS | 12                        |
| `src/artifacts/parity.json` texts            | 120                       |
| **total**                                    | **237**, all texts unique |

### How to verify it yourself

```bash
npm run build -w @janus-scheduler/nlp   # node-loader.test.ts needs dist/
npm test -w @janus-scheduler/nlp

# Look for:
#   Test Suites: 4 passed, 4 total
#   Tests:       1112 passed, 1112 total
#   ✓ 237/237 rows agree with Python
#   gates.ts coverage: 100% statements, 100% branches

# Spot-check the fixture is Python's, not a snapshot of my own code:
node -e "
const f = require('./packages/nlp/fixtures/routing_fixtures.json');
console.log('rows:', f.length, '| unique texts:', new Set(f.map(r=>r.text)).size);
const g = {}; for (const r of f) g[r.gate ?? 'PROCEED'] = (g[r.gate ?? 'PROCEED']||0)+1;
console.table(g);
"
```

**What a pass looks like:** 1112/1112, the `237/237` test green, and the console
line `worst |ts - py| across 237 rows: 1.212e-7`.

### My run

```
Test Suites: 4 passed, 4 total
Tests:       1112 passed, 1112 total
  routing.test.ts   479 passed  — incl. "237/237 rows agree with Python"
  worst |ts - py| across 237 rows: 1.212e-7   ("do i have any calls this afternoon")

Coverage moved by this step:
  gates.ts     93.18% → 100%   stmts     80.76% → 100%   branch
  overall      91.60% → 92.65% stmts     73.75% →  80%   branch

Python generator output:
  loaded 11949 tokens, 222 prototypes · collected 237 input rows
  PROCEED 59 · CLARIFY 93 · REJECT 85
  gate1_confidence 34 · gate2_nearest_none 27 · gate3_no_anchor 24
  gate3b_resource_only 30 · gate4_margin 3 · gate5_missing_slot 32 · negation 28
```

Every gate fires at least 3 times, so "237/237 agree" covers the whole gate
layer rather than a few popular paths — the test asserts this explicitly.

### Notes / deviations

- **The research repo had no `.venv`.** The plan said it was "already
  populated"; it was not, and there is no Python on `PATH` under that name
  (`python` hits the Windows Store shim; `py` gives 3.13.1). A throwaway venv
  was created in the scratchpad — outside both repos — with **numpy only**.

- **`spacy` is stubbed, not installed.** `scripts/requirements.txt` lists it and
  `scripts/preprocess.py` imports it at module top, but the only callers are
  `head_verb_phrase()` and `content_words()`, and `route_query` reaches
  neither — it goes through `strip_slots` / `head_verb_phrase_lexicon` /
  `embed_text`, all pure regex plus numpy. The stub **raises** on any real use
  rather than returning a dummy, and the generator asserts it is running against
  the stub, so a degraded run cannot silently produce fixtures. Approved by you
  before running.

- **`confidence`/`margin` are compared with a 1e-5 tolerance, not exactly.**
  This is forced, not a shortcut: NumPy accumulates the dot product in float32
  (and BLAS may reassociate), while JavaScript has no float32 arithmetic and
  accumulates float32 inputs in a float64 number. Bit-equality is impossible.
  `intent`, `route` and `gate` — the actual decision — are compared exactly.
  Measured worst case is 1.2e-7, and a separate test asserts it stays below
  `tolerance / 10` so the tolerance can never quietly widen to mask a real
  divergence.

- **The generator and stub are committed** under `fixtures/tools/`. They are not
  part of the build, not linted, and not published — but without them the
  fixture could never be regenerated if the model is retrained. Say the word if
  you would rather they lived outside the repo.

- **`.prettierignore` narrowed** from `packages/nlp/fixtures/` to
  `packages/nlp/fixtures/*.json`, so the new README is formatted normally while
  the golden JSON stays byte-stable.

---

## Step 3 — Entity extraction + time resolver ✅

**This did not exist in any form.** The frozen pipeline _detects_
times/resources/participants only in order to **delete** them (`stripSlots`),
and terminates at `{intent, confidence, margin, route, gate}` — confirmed
against `architecture.drawio`'s runtime page, which has no entity node anywhere.
The design's parse card needs `Alex Rivera` / `Wed 10:00 AM` / `Room A` as
structured chips, so this is new, **additive** code. It never runs inside
`classify()` or any gate and cannot change a routing decision — the frozen
suites confirm it: 1084/1084 still pass, unchanged.

### What changed

| file                     | contents                                                                           |
| ------------------------ | ---------------------------------------------------------------------------------- |
| `src/datetime.ts`        | time-phrase parsing + resolution, zero-dep `Intl` timezone maths                   |
| `src/entities.ts`        | catalog matching (who/where) + title extraction                                    |
| `src/types.ts`           | `TimeSpan`, `ResolvedTime`, `EntityCatalog`, `EntityMatch`, `ExtractedEntities`, … |
| `src/index.ts`           | re-exports, under an explicit "not part of the frozen pipeline" banner             |
| `tests/datetime.test.ts` | 66 tests — DST, midnight, week/month/year rollover, timezones                      |
| `tests/entities.test.ts` | 37 tests — matching, partials, titles, purity                                      |

The API:

```ts
extractEntities(text, { catalog, now, timezone });
//   → { timeSpan, time, resources, participants, title }
resolveTime(span, { now, timezone });
//   → { startISO, endISO, localDate, localTime, weekday, durationMinutes, assumptions }
```

`now` and `timezone` are **injected**, never read from the environment, so
results are deterministic and the tests do not depend on when they run.

### How to verify it yourself

```bash
npm run build -w @janus-scheduler/nlp
npm test -w @janus-scheduler/nlp
#   Test Suites: 6 passed   ·   Tests: 1215 passed

# The end story, end to end — classification AND extraction together:
cd packages/nlp && node -e "
const nlp = require('./dist/index.cjs');
const { loadArtifacts, loadPrototypes } = require('./dist/node.cjs');
const a = loadArtifacts(), p = loadPrototypes();
const catalog = {
  resources:    [{ id: 'r1', name: 'Room A', type: 'room' }],
  participants: [{ id: 'p1', name: 'Alex Rivera', type: 'person' }],
};
const text = 'Schedule a design sync with Alex tomorrow at 10am in Room A';
const r = nlp.routeQuery(text, a, p);
const e = nlp.extractEntities(text, { catalog, now: new Date('2026-08-05T08:30:00Z'), timezone: 'Asia/Colombo' });
console.log('route', r.route, '| intent', r.intent);
console.log('title', e.title, '| who', e.participants.map(x=>x.name), '| where', e.resources.map(x=>x.name));
console.log('when', e.time.weekday, e.time.localDate, e.time.localTime, '->', e.time.startISO);
console.log('assumed', e.time.assumptions);
"
```

### My run

```
Test Suites: 6 passed, 6 total
Tests:       1215 passed, 1215 total          (was 1112 — +103 new)
  datetime.test.ts  66 · entities.test.ts  37

Coverage:  94.57% stmts (was 92.65%) · 86.8% branch (was 80%)
  datetime.ts 96.51% · entities.ts 95.79% · gates.ts 100%

Frozen suites re-run on their own:  1084/1084 unchanged
eslint CLEAN · tsc CLEAN · purity grep on dist/index.* → no match

End-to-end:
  "Schedule a design sync with Alex tomorrow at 10am in Room A"
    route   : PROCEED | intent add_event | conf 0.912
    title   : design sync
    who     : Alex Rivera (partial)
    where   : Room A
    when    : thursday 2026-08-06 10:00 (60min) -> 2026-08-06T04:30:00.000Z
    assumed : no duration given — assumed 60 minutes

  "schedule a meeting with Alex"
    route   : CLARIFY [gate5_missing_slot] | intent add_event | conf 0.960
    title   : meeting     who: Alex Rivera (partial)     when: (unresolved)
```

That CLARIFY row is Step 5's input: everything is known except the time, and
the gate says which slot is missing.

### Design decisions worth knowing

- **`assumptions` is part of the contract.** Every value the resolver invented —
  the 60-minute duration, a 09:00 default, "assumed tomorrow" — is listed in
  plain English. The parse card is a _verification_ surface; if the system
  invents a value and hides it, the user is confirming something they were never
  shown.

- **Unresolvable means `null`, not a guess.** `"next sprint"` has no calendar
  definition this package can know, so it returns `null` → CLARIFY → the user is
  asked. Exactly what gate 5 already does for a missing time.

- **Partial name matching is opt-in, defaulting to `type === "person"`.** This
  was forced by a bug the tests caught: a group called "Design Team" matched the
  word "design" in _"schedule a design sync"_ — inventing a participant nobody
  mentioned _and_ eating the word out of the title. A blocklist of "words too
  common to match on" cannot fix this, because "design" is also a legitimate
  name token; only knowing what KIND of thing the entry is can. Callers can
  override per entry with `matchPartial`.

- **`zonedToUtcMs` samples the timezone offset twice.** The single-pass version
  (which `packages/core/src/utils/time.ts` uses) measures the offset at the
  nominal UTC instant and lands an hour out within one offset-width of a DST
  transition. That is fine for core — it converts times a user typed into a
  picker — but this module _synthesises_ wall-clock times like "next Sunday
  09:00" that can land exactly on a transition. Four DST tests pin it.

- **Extraction and the frozen `hasTimeAnchor()` must agree**, and a test asserts
  it. If they drifted, an utterance could clear gate 5 ("has a time") and then
  produce a parse card with an empty _when_. The extraction patterns therefore
  reproduce the frozen list's quirks rather than tightening them.

### Notes / deviations

- **Three real bugs were caught by the tests, not by inspection:** the
  "Design Team" over-match above; a `\b` anchor that made any catalog name
  ending in punctuation (`"Room (B) [main]"`) unmatchable; and a stranded `"."`
  token that stopped a dangling `"at"` from being cleaned out of a title
  (`"all-hands at"`).

- **The title cleanup was rewritten from regexes to token operations.** The
  first version chained alternation patterns in a fixpoint loop; the linter
  correctly flagged super-linear backtracking. The token version is linear,
  and easier to read as the rule it encodes: drop a function word when whatever
  it pointed at is gone.

- **`leadingVerbPrefixLength` inherits a frozen limitation on purpose.**
  _"i need to cancel the demo"_ consumes only `"i need "` — after the wrapper,
  the remainder starts with `"to"`, which is not in the verb lexicon, and the
  lexicon is anchored rather than scanned. `headVerbPhraseLexicon` behaves
  identically. Diverging would compute the title against a different reading of
  the sentence than the intent was, so the limit is pinned by a test instead.

---

## Step 4 — `<janus-chat>` five states ✅

New Lit component in `packages/ui`, ported from the design's chat section.
`<janus-ai-bar>` **stays** as the entry point (the design: _"The clean input is
the entry point — pressing it opens a full conversation"_), so all existing
`ai-submit` consumers keep working untouched.

**Driven by static fixtures — no classifier, no store.** That is deliberate:
the component is a pure view, so it can be checked against the design before any
live wiring exists, and later a visual regression can be told apart from a
classification regression.

### What changed

| file                                             | contents                                                        |
| ------------------------------------------------ | --------------------------------------------------------------- |
| `packages/ui/src/chat-types.ts`                  | view-model types — what the component renders, not domain state |
| `packages/ui/src/chat-styles.ts`                 | the design's `--janus-*` palette + all chat styles, light/dark  |
| `packages/ui/src/janus-chat.ts`                  | the component                                                   |
| `packages/ui/src/index.ts`                       | exports both                                                    |
| `packages/wrappers/react-wrapper/index.ts`       | `<Chat>` binding + 11 chat types re-exported                    |
| `demo/react-demo/src/components/ChatGallery.tsx` | 10-scenario review harness                                      |
| `demo/react-demo/src/App.tsx`                    | `?chat=1` flag                                                  |
| `demo/react-demo/src/App.css`                    | gallery chrome                                                  |

### How to verify it yourself — **your eye is the only real test here**

```bash
npm run dev:react-demo
```

Then open **<http://localhost:5173/?chat=1>** and click through the ten
scenarios in the left rail. Every button is live and logs to the panel at the
bottom-left, so you can confirm the right event fires with the right payload.

What to check, in rough priority order:

1. **Parse card (4)** — the end story. Chips read violet/blue/orange for
   who/when/where; "96% confident" pill; Confirm & schedule + Edit.
2. **Assumptions (4b)** — dashed chip borders and the notes list. This is the
   thing that makes the card a _verification_ surface rather than a summary.
3. **Clarification (5)** — warning border, tappable chip answers.
4. **Thinking (3)** — three dots, 1.2s stagger.
5. **Success (8)** — green card, monospaced summary, View + Undo.
6. **Reject (9)** — plain message, no card. Correct reading of gates 2/3.
7. **Delete (7)** — red confirm and red border for destructive intent.
8. **Suggestions (2)** — click the composer and press ↑/↓, then Enter and
   Escape. Enter picks the highlighted row rather than sending, which is the
   behaviour that stops a constant misfire.
9. **Theme** — the Light / Dark / Auto switch at the top of the rail. Light is
   the default and is what matches the rest of Janus today; Auto follows your
   OS. The gallery chrome follows the same choice, so the panel is never a dark
   rectangle on a light page.
10. **Narrow** — drag the window under 900px.

### My run

```
npm run build -w @janus-scheduler/ui      ✓ built (22 modules)
npm run build -w @janus-scheduler/react   ✓ built
npm run build -w react-demo               ✓ built (84 modules, tsc -b clean)
eslint packages/ui packages/wrappers/react-wrapper demo/react-demo → exit 0
dev server: http://localhost:5173/?chat=1
```

No automated tests: `packages/ui` has none by design (see `CLAUDE.md` — core is
the only tested package), and a snapshot test of markup would pin the DOM
without saying anything about whether it looks right.

### Design decisions worth knowing

- **The component is a view and cannot commit anything.** `chat-confirm` is a
  _request_; the success bubble appears only when a controller pushes one. The
  verify-then-act contract therefore lives in the controller (Step 5/6) and this
  component has no path that could bypass it.

- **Chip colours are semantic, not decorative.** person → AI violet, time →
  info blue, place → primary orange. A reader scans for who/when/where by hue,
  so the mapping is pinned in `chat-types.ts`.

- **Assumed values get a dashed chip border plus a notes list.** Not in the
  original design — added because Step 3 produces `ResolvedTime.assumptions`
  and a confirmation surface that hides its own guesses is not a confirmation
  surface. Scenario 4b shows it.

- **Tokens live on `:host`, each with a fallback.** Custom properties inherit
  through shadow boundaries, so a host app can still override any of them.
  `--janus-primary` defers to `--janus-primary-color`, the hook this package
  already honours — so the existing theming still retints the chat with no
  chat-specific configuration.

- **Light is the default theme, and dark is opt-in.** First version followed
  `prefers-color-scheme` unconditionally, which you caught immediately: the
  panel rendered dark on a dark-OS machine. That is a real bug in context —
  **every other component in this package is light-only** (`ai-bar-styles.ts`,
  `timeline-styles.ts` … all hardcode their colours), so an OS-following chat
  would have been a dark panel bolted onto a light timeline. Now
  `theme="light"` (default) · `theme="dark"` · `theme="auto"` (restores
  OS-following, for hosts that are themselves dark-aware). The dark palette is
  a single `darkTokens` fragment used by both the explicit and the auto
  selector, so the values cannot drift apart.

- **Auto-scroll only fires when the row count grows.** Re-rendering an existing
  message (a card losing its buttons after confirmation) must not yank a user
  who has scrolled up to read history.

### Notes / deviations

- **The design's "five states" are really nine.** The `EVERY STATE` strip shows
  five, but the mock-ups also contain a reschedule card (before → after,
  monospaced, struck-through old time), a destructive variant, a plain REJECT
  reply and a "Today" divider. All are implemented; the gallery has ten
  scenarios so each is reviewable on its own.

- **The React `<Chat>` binding unwraps its nine events from a table** rather
  than nine near-identical ternaries. The other wrappers in that file spell each
  one out, which is fine at two events and would be nine places for a typo to
  hide at nine.

- **Chat types live in `@janus-scheduler/ui`, not `core`.** `docs/TYPE_GUIDE.md`
  puts public API types in `core/src/api/api.types.ts`, but these describe what a
  component _renders_ — they are not domain state and nothing in `core` produces
  or consumes them. They are still re-exported through the React wrapper, so the
  facade rule (host apps import from one package) holds. Revisit at Step 6 if the
  dialogue manager ends up needing them in `core`.

- **Only the React wrapper has the binding so far.** Angular and Solid come in
  Step 6 with the rest of the wiring; adding them now would mean touching them
  twice.

- **`?chat=1` is temporary scaffolding.** The demo has no router. Step 6 wires
  the chat into the app proper and this branch goes away.

---

## Step 5 — Dialogue manager (slot filling) ✅

93 of the 237 corpus rows route to **CLARIFY**. Until now every one of them was
a dead end: the gate said "ask the user" and nothing asked. This step asks.

**The one rule that matters:** answering a question never lowers the bar for the
other gates. It is enforced structurally, not by convention — a satisfied gate
is suppressed only through an input `routeFromClassification` already takes (its
`marginFloor` parameter, or a text with the negation cue blanked), and then the
**whole ladder is re-run from the top**. No gate is ever skipped by index, and
`gates.ts` stays the single source of truth for the ordering.

### What changed

| file                                          | contents                                                      |
| --------------------------------------------- | ------------------------------------------------------------- |
| `packages/nlp/src/session.ts`                 | the state machine — `beginSession` / `provideAnswer`          |
| `packages/nlp/src/types.ts`                   | `SessionState`, `SessionDraft`, `SessionQuestion`, `SlotName` |
| `packages/nlp/src/index.ts`                   | re-exports + the entity/session types Step 3 never exported   |
| `packages/nlp/tests/session.test.ts`          | 130 tests                                                     |
| `demo/react-demo/src/chat/useNlpEngine.ts`    | fetches + decodes the artifacts **in the browser**            |
| `demo/react-demo/src/chat/presentSession.ts`  | `SessionState` → `ChatMessage[]`                              |
| `demo/react-demo/src/components/ChatLive.tsx` | the live panel + a gate inspector                             |
| `demo/react-demo/src/App.tsx`                 | `?chat=live`                                                  |
| `demo/react-demo/src/App.css`                 | rail styles for the inspector                                 |
| `demo/react-demo/package.json`                | depends on `@janus-scheduler/nlp`                             |

**Questions come from the gate, never invented.** Only the three CLARIFY gates
get one; the three REJECT gates deliberately do not, because a follow-up
question about an utterance you did not understand produces nonsense.

| gate                   | slot      | question                                       |
| ---------------------- | --------- | ---------------------------------------------- |
| `gate5_missing_slot`   | `when`    | "When should “design sync” be?"                |
| `gate3b_resource_only` | `when`    | "When would you like Room A?"                  |
| `gate4_margin`         | `intent`  | "I'm not sure what you'd like to do — which?"  |
| `negation`             | `confirm` | "That reads like a negative — do you want me…" |

### How to verify it yourself

```bash
npm run build -w @janus-scheduler/nlp   # the demo resolves the BUILT package
npm test -w @janus-scheduler/nlp
#   Test Suites: 7 passed   ·   Tests: 1345 passed
```

Then **<http://localhost:5174/?chat=live>** — note the port, 5173 was already
taken. This is the real classifier running in your browser, not fixtures.

The left rail has one button per route so you don't have to guess wording, and
a **"What the gates decided"** inspector showing route / gate / intent /
confidence / margin / rounds / the merged text for the current turn.

The thing to actually check is **the conversation**:

1. Click **Missing the time** — _"schedule a meeting with Alex"_. It should ask
   "When should “meeting” be?" rather than dead-ending, and the inspector should
   read `CLARIFY · gate5_missing_slot`.
2. Answer it — tap a chip, or type **"tomorrow at 3pm"**. The parse card should
   come back complete, and the inspector's **merged text** should read
   _"schedule a meeting with Alex tomorrow at 3pm"_. That merge is the whole
   feature.
3. Type **"tomorrow"** instead. It still completes, but at 09:00 with
   _"no time of day given"_ in the notes — an assumption you can see and correct
   rather than one hidden behind a confident-looking card.
4. **Negative phrasing** — _"i don't want the standup tomorrow at 9am"_ asks a
   yes/no question. **No** stops cleanly. **Yes** re-routes; watch the inspector
   `answered` row fill in and the gate change to something else (or to nothing).
5. **Room, nothing else** — _"book the demo room"_ → the parking case.
6. **Not scheduling at all** → a plain message and no card.
7. Answer "when?" with nonsense twice — it gives up with _"starting over will be
   quicker"_ rather than looping forever.
8. Nothing is written anywhere. **Confirm** shows a success bubble and that is
   all — the commit is Step 6.

### My run

```
Test Suites: 7 passed, 7 total
Tests:       1345 passed, 1345 total          (was 1215 — +130 new)
  session.test.ts  130 passed

Coverage:  94.92% stmts (was 94.57%) · 87.65% branch (was 86.8%)
  session.ts  95.57% stmts · 90.54% branch   (uncovered: 3 defensive branches)

Frozen suites unchanged:  1215 → still 1215, byte for byte
npm run lint (whole repo)  → exit 0
npm run build -w react-demo → tsc -b clean, 92 modules

Browser artifact loading, from the production build:
  dist/assets/vectors-*.bin      3,058.94 kB
  dist/assets/prototypes-*.json  2,490.03 kB
  dist/assets/vocab-*.json         487.27 kB
  dist/assets/index-*.js           592.18 kB   ← artifacts NOT inlined
```

### Design decisions worth knowing

- **A confirmed negation is re-routed on the ORIGINAL classification, not a
  re-classified sentence.** This looks like a detail and is not:

  ```
  "don't book Room A"  classifies as a cancellation
  "book Room A"        classifies as a booking
  ```

  The confirmation question is phrased from the draft's intent — _"do you want
  me to cancel Room A?"_. If confirming re-classified the cue-free sentence, the
  user would answer a question about cancelling and get a booking. So the cue is
  removed for exactly one purpose (stopping an already-answered gate from firing
  again) and for nothing else. My first version of the test asserted the wrong
  one of these and caught it.

- **The negation cue list is not re-declared.** `stripNegationCues` uses the
  frozen `hasNegation` itself as the oracle: a token is a cue if the detector
  fires on that token alone, and an adjacent pair is a cue if it fires on the
  pair — which finds "no longer" and "no more" today and any future two-word
  form for free. That is what stops a second copy of the list from drifting out
  of sync with `gates.ts`. It blanks **only** the cue, never a prefix, because
  removing anything else could delete a time anchor and turn a confirmed
  utterance into a `gate3_no_anchor` rejection. A test asserts exactly that over
  all 28 negation rows.

- **The "when" chips are load-bearing, not decoration.** Each one is merged into
  the utterance verbatim, so every one has to be a phrase the frozen
  `TIME_PATTERNS` recognises **and** `datetime.ts` can resolve. If one were not,
  tapping it would re-trigger the gate it was meant to satisfy — an infinite
  loop presented as a button. Two tests pin it.

- **Only the time phrase is merged, not the whole reply.** _"make it next
  tuesday at 2pm"_ appends `next tuesday at 2pm`; the filler is dropped, so the
  merged sentence still reads like something a person wrote and the intent the
  user already established does not shift.

- **Two rounds, then stop.** A third identical prompt is a loop, not a
  conversation. The session ends `declined` with a reason the UI shows.

- **The draft is populated while `awaiting`, not just when ready.** A blank
  panel next to "when?" makes the user repeat what they already said.

- **The session cannot commit anything.** It has no store, no manager, no I/O —
  `beginSession` and `provideAnswer` are pure functions returning a snapshot.
  Verify-then-act is therefore structural rather than a convention someone has
  to remember.

### Notes / deviations

- **⚠️ A real limitation found here that will bite in Step 6: a catalog name is
  not a domain anchor.** Gate 3 asks "is there a domain anchor?" and answers it
  from the **frozen 23-name research corpus** — `sarah`, `alice`, `marketing`,
  `team`. A name from the host's actual directory is not in that list, so:

  ```
  "schedule with Alex"    → REJECT, gate3_no_anchor
  "schedule with sarah"   → CLARIFY, gate5_missing_slot
  ```

  The catalog has no say in it, because catalog matching happens in extraction,
  **after** routing. _"schedule a meeting with Alex"_ works only because
  "meeting" is an event noun — that is the anchor, not the name. Pinned by a
  test. Fixing it means either feeding the catalog into gate 3 (a change to
  frozen behaviour, and one that would break the 237-row agreement fixture) or
  accepting it. **Worth your decision at Step 6** — I have not touched it.

- **`session.ts` lives in `packages/nlp`, not `packages/ui` as the plan said.**
  The plan named it `packages/ui/src/chat-session.ts`. It is business logic that
  depends on the classifier, and `CLAUDE.md` says `packages/ui` is "rendering
  only, no business logic" — putting it there would have made a render-only
  package import the classifier. In `nlp` it is pure, zero-dep, and testable by
  the Jest suite that already exists, which is how it got 130 tests.

- **The presenter is in the demo, deliberately, and Step 6 decides its home.**
  `presentSession.ts` maps `SessionState` → `ChatMessage[]`. It cannot live in
  `nlp` (that package must not know what a chat bubble is) and putting it in
  `ui` has the same problem as above. Demo-local is honest scaffolding until the
  live wiring shows what Angular and Solid actually need.

- **The demo resolves `@janus-scheduler/nlp` to `dist/`, not `src/`.** After
  changing anything in `packages/nlp/src`, run
  `npm run build -w @janus-scheduler/nlp` or the browser keeps the old build.
  Vite gives no warning about this.

- **6 MB of artifacts, fetched not bundled.** `?url` imports resolve through the
  package's `"./artifacts/*"` export and emit three separate assets, so the JS
  bundle stays at 592 kB. But `prototypes.json` alone is 2.49 MB purely because
  it stores float vectors as JSON text. Packing it the way `vectors.bin` already
  is would cut that hard. Step 7, not a correctness issue.

- **`?chat=live` is temporary scaffolding**, same as `?chat=1`. Both go away in
  Step 6.

- **Step 3 never exported its own types from `index.ts`.** `TimeSpan`,
  `ResolvedTime`, `EntityCatalog` and friends were reachable only through
  `src/types`. The demo needed them, so they are exported now — a gap, found by
  using the package rather than by reading it.

- **Three uncovered branches in `session.ts` are defensive**: the `subjectOf`
  "this" fallback, an unreachable `default` in `buildQuestion` (only CLARIFY
  gates reach it), and the "no question could be built" guard.

---

## Step 6 — Wire to SchedulerManager + React demo 🟦

The dead stub is gone. What was

```ts
console.log("AI prompt submitted:", prompt);
// TODO: hook into your NLP integration here
```

now opens a conversation, classifies the prompt, shows what it understood, and
writes to the scheduler **only** after the user presses Confirm.

### What changed

| file                                                                  | contents                                                |
| --------------------------------------------------------------------- | ------------------------------------------------------- |
| `packages/nlp/src/session.ts`                                         | the catalog fallback (your Step 5 decision)             |
| `packages/nlp/src/types.ts`                                           | `SessionState.softened`, `SessionContext.catalogAnchor` |
| `packages/nlp/tests/session.test.ts`                                  | +9 tests for the fallback (139 total)                   |
| `demo/react-demo/src/chat/commitToScheduler.ts`                       | **the act half** — the only route to `SchedulerManager` |
| `demo/react-demo/src/chat/useChatConversation.ts`                     | one conversation: thread, session, undo registry        |
| `demo/react-demo/src/components/ChatDock.tsx`                         | the docked panel, catalog fed from the live store       |
| `demo/react-demo/src/components/SchedulerView.tsx`                    | the AI bar now opens the dock                           |
| `demo/react-demo/src/components/ChatLive.tsx`                         | refactored onto the shared hook                         |
| `demo/react-demo/src/App.css`                                         | dock positioning                                        |
| `packages/wrappers/angular-wrapper/src/lib/chat.component.ts`         | Angular binding                                         |
| `packages/wrappers/angular-wrapper/src/lib/types.ts` + `src/index.ts` | 18 chat types                                           |
| `packages/wrappers/solid-js-wrapper/index.tsx`                        | Solid binding + 18 chat types + element registration    |

### How to verify it yourself

```bash
npm run build -w @janus-scheduler/nlp    # the demo resolves the BUILT package
npm run dev:react-demo
```

Open **<http://localhost:5174/>** — the **main app**, not `?chat=…`. Type into
the AI bar at the bottom.

**The acceptance test, in order:**

1. **The end story.** Type
   _"Schedule a design sync with Sarah tomorrow at 10am in Operating Room 1"_.
   → thinking → parse card with who/when/where chips and a confidence pill →
   **Confirm & schedule** → the event appears on the timeline, on the right
   rows, at the right time → **Undo** on the success bubble removes it again.
2. **CLARIFY.** _"schedule a meeting with Sarah"_ → asks "When should “meeting”
   be?" → answer it → card completes → Confirm → it lands.
3. **The catalog fallback.** _"book MRI Scanner A"_ → asks "When would you like
   MRI Scanner A?" This is the case you chose to handle; without it the frozen
   gate 3 rejects it outright, because "MRI Scanner A" is in your store and not
   in the frozen 23-name research corpus.
4. **Delete.** Type _"cancel the Appendectomy"_ → red card, "Cancel event" →
   Confirm → it goes → Undo puts it back with its resources and colour intact.
5. **REJECT.** _"what's the weather like tomorrow"_ → plain message, no card,
   nothing created.
6. **The timeline still works while the panel is open** — drag an event behind
   it. The dock is an assistant, not a modal.

`?chat=1` (design gallery) and `?chat=live` (gate inspector) both still work —
see the note below on why they stayed.

### My run

```
Tests:  nlp   1354 passed, 7 suites     (was 1345 — +9 for the fallback)
        core    65 passed, 9 suites     (unchanged)
lint (whole repo)                → exit 0
build --workspaces --if-present  → all 8 built
build -w @janus-scheduler/angular → explicit tsc rebuild, dist/lib/chat.component.js present
```

**End-to-end, run headless against the real `SchedulerManager`** (classifier →
session → draft → manager → undo, no browser):

```
=== 1. HAPPY PATH ===
  route=PROCEED gate=null status=ready
  title=design sync   who=Dr. Sarah Chen   where=Operating Room 1
  when=2026-08-08 10:00
  committed   -> events 0 -> 1
  on timeline : "design sync" @ 2026-08-08T04:30:00.000Z rows=r4,r1
  isValid()   : true
  UNDO        -> events 0

=== 2. CLARIFY PATH ===
  gate=gate5_missing_slot   asks: "When should “meeting” be?"
  merged: "schedule a meeting with sarah tomorrow at 3pm"
  status=ready  when=2026-08-08 15:00

=== 3. CATALOG FALLBACK ===
  frozen verdict : REJECT / gate3_no_anchor      ← unchanged
  session status : awaiting
  asks           : "When would you like MRI Scanner A?"

=== 4. REJECT ===
  declined  REJECT  gate2_nearest_none  "what's the weather like tomorrow"
  declined  REJECT  gate2_nearest_none  "what is the capital of France"
  declined  REJECT  gate2_nearest_none  "tell me a joke"

=== 5. DELETE + UNDO ===
  intent=delete_event  title=standup  resolved targets: 1
  deleted -> 0 (was 1)     UNDO -> 1
```

### ⚠️ The one result that is not what the plan predicted

The plan's REJECT example was _"what's for lunch today"_. It does **not**
reject:

```
ready   PROCEED   -   "what's for lunch today"
```

This is **correct, and expected**. It is documented false accept #1 —
`lunch` is deliberately left in `EVENT_NOUNS`, and ALGORITHM.md says so. The
plan even flagged it: _"worth eyeballing that it behaves as ALGORITHM.md
predicts rather than as we'd wish."_ It does.

It is worth seeing in the browser, because it is the clearest demonstration of
why the whole architecture is verify-then-act: the classifier is wrong, the
user is shown a parse card for a lunch appointment, and **nothing is created**
unless they press Confirm. A system that acted on classification alone would
have silently booked it.

### Design decisions worth knowing

- **`commitToScheduler.ts` is the only file that can change the calendar**, and
  it is called from exactly one place — `onConfirm`, which fires from a parse
  card. The classifier cannot reach it and the session state machine has no I/O
  at all, so verify-then-act is a property of the wiring rather than a rule
  someone has to remember.

- **Every mutation goes through `SchedulerManager`, never `schedulerStore`** —
  per `CLAUDE.md`, and because the manager is what provides the optimistic
  update + rollback that Undo rides on.

- **Undo snapshots before it acts.** Deleting captures the whole event —
  resources, colour, recurrence rule — so Undo restores what was there rather
  than a reconstruction of it. A moved event stores its previous start/end.

- **Undo is per success bubble, not global.** Two commits in one thread each
  get their own; undoing the older must not touch the newer. The bubble then
  says "Undone" rather than vanishing, because it did happen.

- **Delete and move refuse rather than guess.** Resolving "cancel the standup"
  to an event is exact-title-first, then substring; **anything other than
  exactly one match is a readable refusal**, never a best guess. Deleting the
  wrong event is far worse than asking again.

- **The catalog comes from `manager.getAllResources()`**, rebuilt when the
  roster actually changes. This is the whole reason `extractEntities` takes a
  catalog parameter instead of importing from core — real rooms and real people
  resolve, and the frozen research corpus never reaches a user's screen.
  People get their honorific stripped into an alias, so "Sarah" and
  "Dr. Sarah Chen" both match.

- **An event with no resource cannot exist** — `Event.isValid()` requires one,
  so it would never appear on the timeline. When nothing is named the commit
  falls back to the first row **and says so in the success line**, rather than
  silently misplacing it.

- **The dock does not block the timeline.** `pointer-events: none` on the
  wrapper, `auto` on the panel, so you can keep dragging events while it is
  open.

### Notes / deviations

- **`?chat=1` and `?chat=live` stayed.** The plan said both branches go away at
  Step 6. The gallery is the only way to review a state against the design
  without engineering the classifier into producing it, and `?chat=live` is now
  the gate inspector — it shows route / gate / confidence / margin / merged text
  / softened for the current turn, which is how you tell a UI bug from a
  classification one. Both are behind URL flags and cost nothing. Say the word
  and I will delete them.

- **`ChatLive` now runs the SAME hook as the dock**, with no commit attached.
  An inspector that reimplements the flow it is inspecting is worse than no
  inspector, so they share `useChatConversation` and differ only in whether
  `onConfirm` is supplied.

- **The presenter is still demo-local.** `presentSession.ts` maps
  `SessionState` → `ChatMessage[]`. It cannot go in `nlp` (that package must not
  know what a chat bubble is) and `ui` is render-only. Since only the React demo
  is being wired up — the plan keeps Angular/Solid/Vue on the existing `ai-bar` —
  one copy is all that exists. If a second framework ever needs it, that is the
  moment to promote it, not before.

- **All three wrappers now export `<Chat>` and the 18 chat types**, per
  [TYPE_GUIDE.md](./TYPE_GUIDE.md): react `index.ts`; solid `index.tsx` (import
  **and** export blocks, plus the custom-element registration and the JSX
  `IntrinsicElements` entry, which the guide does not mention but the build
  needs); angular `src/lib/types.ts` **and** `src/index.ts`. Angular was rebuilt
  explicitly with `npm run build -w @janus-scheduler/angular` — it uses `tsc`
  and its `dist` goes stale silently.

- **The Angular binding wires its nine events from a table.** At nine, spelling
  each out is nine places for a typo and nine chances to forget the matching
  `removeEventListener`; the table makes the teardown symmetric by construction.

- **`EventListener` is not a global in the Angular package's lint config.** The
  listener type is written `(e: Event) => void` instead. Same thing to
  TypeScript, and it lints.

- **Rebuild `@janus-scheduler/nlp` after touching its `src`.** The demo resolves
  the package to `dist/`, so a source change is invisible to the browser until
  it is rebuilt. This bit once during this step, when `SessionState.softened`
  "did not exist".

---

## Step 6b — Ask for missing details 🟦

**Not in the plan. Found by you**, on this card:

```
you: schedule a meeting at 5pm today
  ▸ Here's what I understood — meeting
      🕐 Fri 5:00 PM   ⏱ 1 hr
      • no duration given — assumed 60 minutes
      ✓ 100% confident
      [Confirm & schedule]  [Edit]
```

No room. Nobody in it. And **Confirm was live.**

### Three defects, not one

1. **The dialogue manager only asked what the GATES asked.** Deliberate in
   Step 5 — I kept it strictly gate-driven so it would not invent policy. But
   the frozen gates only require a **time** for `add_event`. Who and where are
   not gates, so nothing ever asked. The conversation stopped when the
   _classifier_ was satisfied, which is not when the _event_ is complete.

2. **A hidden guess, which is worse than the one you spotted.** `where` was
   empty and the card showed **no chip for it at all** — then `commitSession`
   silently assigned the event to the **first resource row**, disclosing it
   only afterwards in the success line. The duration guess was declared; the
   resource guess was not. That is the exact failure the whole design is
   supposed to prevent.

3. **"100% confident" was misleading.** It is `route.confidence` — the
   classifier's certainty about the **intent** — and it genuinely is 1.0000.
   Next to a card missing who and where, it reads as a guarantee about the
   card.

### What changed

| file                                              | contents                                                   |
| ------------------------------------------------- | ---------------------------------------------------------- |
| `packages/nlp/src/types.ts`                       | `RequiredSlot`, `SessionRequirements`, `skipped`, `source` |
| `packages/nlp/src/session.ts`                     | requirement questions, Skip, per-slot round cap            |
| `packages/nlp/tests/session.test.ts`              | +16 tests (155 in the file)                                |
| `packages/ui/src/janus-chat.ts`                   | honest confidence label + tooltip                          |
| `packages/ui/src/chat-types.ts`                   | `confidenceLabel`                                          |
| `demo/react-demo/src/chat/presentSession.ts`      | fallback disclosed as a dashed chip + note                 |
| `demo/react-demo/src/chat/useChatConversation.ts` | passes `requires` / `fallbackResourceName`                 |
| `demo/react-demo/src/components/ChatDock.tsx`     | declares what a complete event is                          |

**The host declares completeness, not this package:**

```ts
requires: {
  add_event: ["when", "resource"],
  modify_event: ["when"],
}
```

`resource` covers people and rooms alike — both are rows on the timeline, and
`Event.isValid()` needs at least one. Default is `{}`: no requirements, purely
gate-driven, exactly the old behaviour. Guessing what "complete" means would be
the same mistake as the frozen 23-name corpus guessing who your users are.

### How to verify it yourself

```bash
npm run build -w @janus-scheduler/nlp && npm run build -w @janus-scheduler/ui
npm run build -w @janus-scheduler/react
npm run dev:react-demo
```

At **<http://localhost:5174/>**, in the AI bar:

1. **The exact case you reported** — _"schedule a meeting at 5pm today"_. It
   now asks **"Which room or person is “meeting” for?"** with your real roster
   as chips, plus **Skip**.
2. Tap a room → card completes, and the merged text reads
   _"schedule a meeting at 5pm today **in Operating Room 1**"_ — a sentence,
   not a bare append. Tap a person and it says **"with"** instead.
3. **Type** a room name instead of tapping. Same path, same result.
4. Tap **Skip** → you still get a card, but now with a **dashed chip naming
   the row it will actually use** and a note saying so. The guess is visible
   _before_ Confirm, which is the whole point.
5. **Already-complete utterances are untouched** — _"book Operating Room 1
   tomorrow at 10am for standup"_ still goes straight to a card, no extra turn.
6. The confidence pill now reads **"100% sure this is a booking"**, and hovering
   explains it says nothing about the details.

### My run

```
Tests:  1370 passed, 7 suites        (was 1354 — +16)
        session.test.ts  155
lint (whole repo)  → exit 0
builds: nlp · ui · react · react-demo (tsc -b clean)
```

```
### BEFORE (what you saw)
  status ready · who [] · where [] · when 2026-08-07 17:00

### NOW — turn 1
  status awaiting
  asks   "Which room or person is “meeting” for?"
  source requirement  skippable=true
  chips  Operating Room 1 | MRI Scanner A | Dr. Sarah Chen | Dr. Michael Ross | Skip

### NOW — turn 2, tapping "Operating Room 1"
  status ready · where [Operating Room 1]
  merged "schedule a meeting at 5pm today in Operating Room 1"

### NOW — turn 2, tapping "Skip"
  status ready · skipped [resource]
  → card shows a dashed "Dr. Sarah Chen" chip and says it will go there

### Already complete — no extra turn
  "book Operating Room 1 tomorrow at 10am for standup" → ready
```

### Design decisions worth knowing

- **Requirements run only AFTER every gate has passed.** They can turn `ready`
  into `awaiting`; they can never turn `declined` into `ready`. This layer gets
  stricter, never looser — asserted over all 237 fixture rows.

- **Skip exists, and only for host requirements.** The host said the field
  matters, not that it is always obtainable; forcing an answer turns a helper
  into an obstacle. **No gate question is ever skippable** — a gate fires
  because the system does not understand the utterance, and Skip there would be
  a way to walk straight past the classifier. Sending the sentinel to a gate
  question is treated as an ordinary unparseable answer. Both pinned by tests.

- **Skipping does not invent a value.** It records `skipped: ["resource"]` and
  leaves the draft empty; the caller must disclose whatever it substitutes.
  That is what the dashed chip and the note are for.

- **Answers are merged as text, like every other slot.** The draft stays a pure
  function of the accumulated utterance, `extractEntities` does the matching
  exactly once, and a tapped chip and a typed name are literally the same code
  path.

- **A latent bug in the round cap, fixed here.** `rounds` counted every answer
  and capped at 2, so a legitimate three-question fill died on the third.
  It now counts **consecutive asks of one slot** and resets when the topic
  moves on. Filling three empty fields is a conversation; asking "when?" three
  times is a loop. The old same-slot behaviour is unchanged and still tested.

- **An empty catalog is not interrogated.** If there is nothing to offer, the
  `resource` requirement is skipped silently — that is the host's problem, not
  something to ask the user about.

### Notes / deviations

- **`title` is available as a requirement but the demo does not use it.**
  Extraction almost always produces something, so requiring it would add a turn
  for little gain. It is there for a host that wants it.

- **`modify_event` requires only `when`.** The target event is resolved by
  title at commit time, and that already refuses rather than guesses when the
  match is not unique.

---

## Step 6c — Typo tolerance + honest disclosure 🟦

**Also not in the plan. Also found by you**, from this transcript:

```
you: schedule a meeting tommorow
  ▸ When should "meeting tommorow" be?      ← you had just said when
you: tomorrow morning
  ▸ Which room or person is "meeting tommorow" for?
you: Dr. Sarah Chen
  ▸ Here's what I understood — meeting tommorow
      Dr. Sarah Chen · Sat 9:00 AM
```

### Four defects

1. **It asked "when?" about a sentence that said when.** `tommorow` is not in
   the frozen `TIME_PATTERNS`, so there is no time anchor and gate 5 fires.
2. **The typo became the event name.** The title is whatever survives after
   recognised spans are removed, so an unrecognised word stays in it. Confirm
   that card and you create an event called **"meeting tommorow"**.
3. **The merged utterance turned self-contradictory** —
   _"schedule a meeting tommorow tomorrow morning"_.
4. **"Sat 9:00 AM" was not marked as assumed.** _My bug._ You never said 9:00;
   the word "morning" did, and 09:00 is this module's choice. The chip rendered
   as though you had stated it.

### Defect 4 first — it was a design fault, not a typo

`draftChips` was **matching on the assumption prose**, and the resolver has two
wordings for the same fact:

```
"morning" taken as 09:00                 ← the regex missed this
no time of day given — assumed 09:00     ← the regex caught this
```

`ResolvedTime` now carries a machine-readable twin of `assumptions`:

```ts
assumed: {
  date: boolean;
  timeOfDay: boolean;
  duration: boolean;
}
```

The UI reads the flags and never the prose. A test asserts the number of set
flags always equals the number of sentences, so the two cannot drift again.

### Defects 1-3 — correction before the pipeline

New `packages/nlp/src/spelling.ts`. Bounded edit distance against a
15-word closed vocabulary. No dictionary, no model, still zero-dependency.

**Running before the pipeline is the load-bearing part.** The gate and the
extractor then see the same corrected string, so the Step 3 invariant that
`hasTimeAnchor()` and `parseTimeSpan()` agree still holds. Correcting inside
only one of them would let an utterance clear gate 5 and still produce a card
with an empty _when_.

A token is only changed when **all four** hold:

| guard                                 | what it prevents                           |
| ------------------------------------- | ------------------------------------------ |
| at least 5 characters                 | "may"→"day", "mon"→"noon", "wed"→"week"    |
| not already a time anchor             | never "fixing" what works                  |
| not a word the model or catalog knows | overruling the user on a real word or name |
| exactly ONE candidate in range        | guessing silently between two days         |

**`tommorow` → `tomorrow` is edit distance 2, not 1** — drop an `m`, add an
`r`. A doubled letter in the wrong place is one slip to a human and two to an
algorithm, which is why the allowance widens to 2 at eight characters and up.
My first implementation used a flat 1 and did not fix your actual typo.

### How to verify it yourself

At **<http://localhost:5174/>**, in the AI bar:

1. **Your sentence** — _"schedule a meeting tommorow"_. It should go straight
   to **"Which room or person is “meeting” for?"** — no "when?" question, and
   the title is **"meeting"**, not "meeting tommorow".
2. The finished card should carry a note **`read "tommorow" as "tomorrow"`**,
   and the time chip should now be **dashed** with `no time of day given —
assumed 09:00`.
3. **A typo in an answer** works too — reply _"tommorow mornning"_ to a "when?"
   question and both are corrected.
4. **It should leave your words alone** — "meeting", "standup", a resource
   called "Monday Room", a person called "Tomas Fridays". None are touched.
5. `tmrw` is **not** corrected — four characters, below the floor. That is
   deliberate; it is an abbreviation, not a slip.

### My run

```
Tests:  1419 passed, 8 suites        (was 1382 — +37)
        spelling.test.ts  37
lint (whole repo) → exit 0 · nlp + react-demo build clean
```

```
### YOUR EXACT SEQUENCE, corrected
turn 1  "schedule a meeting tomorrow"
  asks        "Which room or person is “meeting” for?"
  corrections ["tommorow -> tomorrow"]

turn 2  "schedule a meeting tomorrow with Dr. Sarah Chen"
  status      ready
  title       "meeting"          ← was "meeting tommorow"
  when        saturday 09:00
  assumed     date=false timeOfDay=true duration=true
  notes       ["read \"tommorow\" as \"tomorrow\"",
               "no time of day given — assumed 09:00",
               "no duration given — assumed 60 minutes"]

### A typo in the ANSWER is handled too
  "tommorow mornning" → ["tommorow -> tomorrow", "mornning -> morning"]

### Correction is OPT-IN — off, nothing changes
  gate=gate5_missing_slot   title="meeting tommorow"
```

### Design decisions worth knowing

- **Corrections are disclosed, never silent.** `SessionState.corrections`
  feeds a card note reading `read "tommorow" as "tomorrow"`, listed **first**,
  before the chips it produced. Rewriting what somebody typed is a guess like
  any other.

- **Opt-in, defaulting off**, exactly like `requires`. What counts as a typo is
  a product judgement; the package's default stays strictly frozen.

- **The vocabulary is pinned to the frozen gate.** A test asserts every entry
  satisfies `hasTimeAnchor()`, so a "correction" can never produce a word gate
  5 still refuses — a fix that silently does nothing. `minutes` was dropped
  during this check: `TIME_PATTERNS` only matches it as `\d+\s+minutes?`, so
  the bare word is not an anchor.

- **Brute-force property test, because the risk is asymmetric.** A correction
  landing on the wrong day is far worse than one that does not fire. Every
  vocabulary word is mangled every way a single slip can — deletion, doubling,
  transposition, nine substitutions per position — and the result must be
  either the word it came from or **no correction at all**. Never a different
  word. 100+ corrections fire, so the assertion is not vacuous.

- **Ambiguity is possible and that is fine.** "thursday" and "saturday" are
  only 4 apart, so an input can sit within 2 of both. The guarantee is not that
  this never happens; it is that nothing is corrected when it does.

### Notes / deviations

- **Damerau, not plain Levenshtein.** "tomrorow" and "wendesday" are single
  transpositions, which plain Levenshtein scores as 2. Without the
  transposition case the two most common real typos would both be missed.

- **Answers are corrected too**, not just the opening utterance — otherwise a
  typo in "tommorow morning" would fail to parse as a time and be appended
  whole, re-triggering the very question being answered.

---

## Step 7 — Tokens / responsive / a11y + CI + docs ⬜

Adopt the design's `--janus-*` token palette, responsive layout, keyboard/ARIA
pass; add the nlp suite to `.github/workflows/build.yml`; add an
`@janus-scheduler/nlp` section to root `CLAUDE.md`.

---

## End-to-end acceptance (Step 6 onward)

- **Happy path:** type _"Schedule a design sync with Alex tomorrow at 10am in
  Room A"_ → thinking → parse card with 3 chips + confidence → **Confirm** →
  event appears on the timeline at the right resource and time → **Undo**
  removes it.
- **CLARIFY path:** _"schedule a meeting with Alex"_ (no time) → gate 5 → chip
  question → answer → event created with that time.
- **REJECT path:** _"what's for lunch today"_ → declined, nothing created. This
  is one of the 3 documented false accepts — worth eyeballing that it behaves as
  ALGORITHM.md predicts rather than as we would wish.

## Known environmental issue

`npm run validate` fails intermittently on **pre-existing** Windows `EPERM`
locks on `dist/` files — a different file each run, including ones this work
never touches. `npm run lint` and `npm run build` each pass individually. Not
caused by this feature.
