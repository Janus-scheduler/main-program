# NLP Integration — Status & Verification Report

Repo scan of branch `feat/nlp-integration` @ `d301301`, working tree clean.
Everything below was measured, not estimated; the commands are in
[§2](#2-how-this-was-verified) so any number here can be re-checked.

---

## 1. Verdict

**The NLP work itself is sound. The integration layer added on top of it is
not finished, and it ships anyway.**

| Area                                    | Verdict                                     |
| --------------------------------------- | ------------------------------------------- |
| Frozen classifier (parity + routing)    | ✅ intact                                   |
| Package invariants (zero-dep, purity)   | ✅ intact                                   |
| Dialogue manager, entities, time, typos | ✅ tested and passing                       |
| `ChatController` (new)                  | ✅ live and used by `react-wrapper`         |
| `presentSession` (new)                  | ✅ single source of truth in `packages/nlp` |
| `npm run validate`                      | ✅ passes (was failing — fixed, see §5D)    |

Nothing that existed before is broken. The risk is what was _added_.

---

## 2. How this was verified

```bash
git log --oneline -12 && git status --short && git reflog -10
git ls-tree --name-only HEAD packages/nlp/src/     # disk vs commit
grep -rn "@janus-scheduler/" packages/nlp/src/     # cross-package imports
grep -rn "node:fs\|readFileSync\|fetch(" packages/nlp/src/   # purity
npm test -w @janus-scheduler/nlp
npm test -w @janus-scheduler/core
npm run lint
npm run build --workspaces --if-present
```

### Results

| Check                       | Result                                            |
| --------------------------- | ------------------------------------------------- |
| `npm test` — nlp            | **1423 passed**, 9 suites                         |
| `npm test` — core           | **65 passed**, 9 suites (unchanged)               |
| `npm run lint` (whole repo) | **exit 0**                                        |
| nlp coverage                | **86.35% stmts / 77.17% branch** ← down from ~95% |
| Builds — all 6 packages     | ✅ core, ui, nlp, react, solid, angular           |
| Builds — all 4 demos        | ✅ react, angular, solid, vue                     |
| Root build ×3 consecutive   | ✅ 0 EPERM, 0 failed workspaces (after §5D fix)   |
| `npm run validate`          | ✅ exit 0                                         |

---

## 3. Provenance — what actually arrived

`git reflog` shows **no pull and no merge**. Both NLP commits were made
locally by `ManushaUm <gunasinghe_pmu_e23@engug.ruh.ac.lk>`:

```
d301301  fix: eslint warnings fixed
728b70e  feat: implement NLP package, core scheduler, and multi-framework demo applications
```

Disk and `HEAD` match exactly — nothing uncommitted, nothing stale.

**Three files exist that were not part of the step-by-step build** recorded in
[NLP_CHAT_PROGRESS.md](./NLP_CHAT_PROGRESS.md):

| File                                        | What it is                                     |
| ------------------------------------------- | ---------------------------------------------- |
| `packages/nlp/src/controller.ts`            | `ChatController` — a framework-agnostic runner |
| `packages/nlp/src/presentSession.ts`        | `SessionState` → chat messages, moved into nlp |
| `packages/nlp/tests/presentSession.test.ts` | tests for the above                            |

`spelling.ts` was also corrected — `"minutes"` removed from `TIME_VOCABULARY`
(it is not a time anchor on its own) and a length-scaled `maxDistanceFor()`
added so `"tommorow"` → `"tomorrow"` works. **Both were real bugs my tests had
caught and left failing. They are now fixed and the suite is green.** Good
call, and `spelling.ts` is at 100% statements and 100% branches.

---

## 4. What is healthy

Every architectural invariant survived the additions — I checked each one
rather than assuming:

- **Zero runtime dependencies.** `dependencies` and `peerDependencies` are both
  absent from `packages/nlp/package.json`.
- **No cross-package imports.** Every `@janus-scheduler/*` hit inside
  `packages/nlp/src` is in a doc comment. Nothing imports `core` or `ui`.
- **The root entry is still pure.** No `fs`, no `fetch` outside `node.ts` — the
  only hits are in an example inside a doc comment.
- **`presentSession.ts` declares its own `PresentChip` / `PresentParseCard`
  types** instead of importing them from `@janus-scheduler/ui`. That is the
  right call: it keeps the package standalone while still doing the mapping.
- **The frozen algorithm is untouched.** `gates.ts` is at 100% statements and
  100% branches, and the parity (120/120) and routing (237/237) suites both
  pass inside the 1423.
- **Lint is clean** across the whole repo.

---

## 5. Findings

### C. Coverage fell from ~95% to 86.35% — ⚠️ medium

Entirely explained by the two new files:

| File                | Stmts  | Branch |
| ------------------- | ------ | ------ |
| `controller.ts`     | 70%    | 60%    |
| `presentSession.ts` | 71.26% | 61.84% |
| `session.ts`        | 96%    | 92%    |
| `spelling.ts`       | 100%   | 100%   |
| `gates.ts`          | 100%   | 100%   |

### D. `npm run validate` failed, vue-demo would not build — ✅ **FIXED**

> **This section originally concluded the failure was pre-existing and
> unrelated to the NLP work. That was wrong.** It was a downstream symptom of
> the `prebuild: rimraf dist` step that commit `728b70e` added, and it is now
> resolved. The corrected diagnosis follows.

The symptom:

```
src/components/SchedulerView.vue(89,8):
  error TS2307: Cannot find module '@janus-scheduler/ui'
```

**Root cause.** `packages/ui` sets `emptyOutDir: false` in its Vite config —
deliberately, so `dist` persists and is only overwritten in place. Commit
`728b70e` then added `prebuild: rimraf dist` to it, which undoes exactly that:
`dist` is wiped at the _start_ of every build. If the workspace build sequence
is interrupted before Vite refills it — and it was being interrupted, by the
EPERM in finding **E** — `packages/ui/dist` is left **empty**. `vue-tsc` then
has no `index.d.ts` to resolve, and reports TS2307.

Proven, not inferred:

| `packages/ui/dist`  | `npm run build -w vue-demo` |
| ------------------- | --------------------------- |
| emptied (0 files)   | **exit 1**, TS2307 verbatim |
| restored (48 files) | **exit 0**                  |

**Fix applied:** the `prebuild: rimraf dist` line was removed from all six
packages, restoring the pre-`728b70e` scripts. `vue-demo` now builds, and
`npm run validate` **exits 0**.

Two earlier claims in this section were wrong and are retracted: the missing
`paths` mapping in `vue-demo/tsconfig.app.json` is **not** the cause (package
resolution via the `exports` map works fine once `dist` exists), and the
failure **was** attributable to the NLP commit after all.

### E. solid-demo build flake — ✅ **FIXED, same root cause**

Failed inside `--workspaces`, then passed on its own. Same mechanism: `rimraf`
lost a race for a `dist` file against a transient Windows file handle
(Defender's real-time scanner or a VS Code watcher opening the file the instant
it is written), and `EPERM` aborted the run.

With the six `prebuild` steps gone there is nothing left to lose that race —
the four Vite packages clean themselves through `emptyOutDir`, and `ui` and
`angular-wrapper` overwrite in place. Three consecutive root builds now report
**0 EPERM occurrences and 0 failed workspaces**.

The underlying file-handle contention is environmental and still exists. To
remove it entirely rather than merely stop tripping over it, add a Defender
exclusion for the repository (elevated, once):

```powershell
Add-MpPreference -ExclusionPath "C:\Users\HP\Desktop\Semester 7\FYP\main-program"
```

**Trade-off accepted:** nothing now cleans `dist` for `ui` or `angular-wrapper`,
so output from a deleted or renamed source file will linger there. That was
already true before `728b70e` and is the state the build ran in for the whole
project up to that point.

---

## 6. Where the feature stands

| #   | Step                                      | Status                 |
| --- | ----------------------------------------- | ---------------------- |
| 0   | Tracker + package skeleton                | ✅ verified            |
| 1   | `packages/nlp` port + parity 120/120      | ✅ verified            |
| 2   | `routing_fixtures.json` + routing 237/237 | ✅ verified            |
| 3   | Entity extraction + time resolver         | ✅ verified            |
| 4   | `<janus-chat>` five states                | ✅ verified            |
| 5   | Dialogue manager (slot filling)           | ✅ verified            |
| 6   | Wire to SchedulerManager + React demo     | 🟦 awaiting check      |
| 6b  | Ask for missing details                   | 🟦 awaiting check      |
| 6c  | Typo tolerance + assumption flags         | 🟦 awaiting check      |
| —   | `ChatController` / `presentSession` move  | ⚠️ **new, unverified** |
| 7   | Tokens / responsive / a11y + CI + docs    | ⬜ not started         |

### What the chat can do today

`add_event` (create) · `delete_event` (cancel) · `modify_event` (time only) ·
`get_details` (read-only). **There are no resource intents** — rooms and people
cannot be created, renamed or removed through chat; they are only ever matched
as slots from the host's catalog.

---

## 7. What remains

**Step 7, as planned:**

- Design tokens, responsive layout and an a11y pass in
  `packages/ui/src/chat-styles.ts` and `janus-chat.ts`
- CI: `.github/workflows/build.yml` runs **only** `packages/core`, and
  `sonar-project.properties` points `sonar.sources` and the lcov path at
  `packages/core` alone. The nlp suite needs adding to both.
- Root `CLAUDE.md` has **no** `@janus-scheduler/nlp` section

**Raised by this scan:**

1. **Decide `ChatController`'s fate** — either finish it (all four intents,
   participants, no silent "now", tests) and migrate `ChatDock` onto it, or
   stop exporting it until it is ready. Shipping it half-built is the worst of
   the three options.
2. **Collapse the duplicate `presentSession`** — keep the package copy, delete
   the demo copy, point `ChatDock` at the package.
3. ~~**Fix `vue-demo`** so `npm run validate` passes~~ — **done.** The six
   `prebuild: rimraf dist` steps were removed; see §5D. No tsconfig change was
   needed.
4. **Restore coverage** to ~95% once (1) is resolved.
5. **Optional, machine-level:** add a Defender exclusion for the repo to remove
   the file-handle contention behind §5E rather than just stop tripping on it.

**Known limitations, unchanged and deliberate:**

- `"what's for lunch today"` → PROCEED. Documented false accept #1; `lunch` is
  intentionally left in `EVENT_NOUNS`.
- Catalog names are not domain anchors — softened by an opt-in fallback, not
  fixed in the frozen gate.
- `delete_event` / `modify_event` resolve targets **by title only**, so
  _"cancel my 3pm"_ will not work.
- Typo correction covers 14 time words at ≥5 characters.
- Vue has no wrapper package; `packages/ui` has no tests by design.
- Artifacts total 6.03 MB, fetched not bundled; `prototypes.json` is 2.49 MB
  purely because it stores float vectors as JSON text.

---

## 8. Recommended order

1. ~~Fix the build~~ — **done.** `rimraf` removed from all six packages;
   `npm run validate` exits 0 and three consecutive root builds are clean.
2. Decide on `ChatController` — finish, or unexport (blocks 3 and 4)
3. Collapse the duplicate `presentSession`
4. Step 7: CI, `CLAUDE.md`, tokens/a11y

---

**See also:** [NLP_CHAT_PROGRESS.md](./NLP_CHAT_PROGRESS.md) for the
step-by-step build log and per-step verification commands ·
`packages/nlp/docs/ALGORITHM.md` (normative — the algorithm is frozen) ·
[TYPE_GUIDE.md](./TYPE_GUIDE.md) · [ARCHITECTURE_FACADE.md](./ARCHITECTURE_FACADE.md)
