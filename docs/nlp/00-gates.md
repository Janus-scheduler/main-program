# 00 · Automated gates

Run these before anything else, and again before every commit. If any fails,
stop — the manual steps below it are measuring a build you do not have.

## Commands

```bash
# from the repo root
npm run build -w @janus-scheduler/nlp     # typechecks, THEN bundles
npm test     -w @janus-scheduler/nlp      # typechecks, THEN runs jest
npm test     -w @janus-scheduler/core
npm run lint
npm run validate                          # lint + build, every workspace
```

## PASS conditions

| Check                                   | Must be                                           |
| --------------------------------------- | ------------------------------------------------- |
| `npm run build -w @janus-scheduler/nlp` | exit 0                                            |
| `@janus-scheduler/nlp` suite            | **1748 passed, 14 suites** — may rise, never fall |
| `@janus-scheduler/core` suite           | **134 passed, 10 suites**                         |
| `npm run lint`                          | exit 0, no errors                                 |
| `npm run validate`                      | exit 0                                            |

### The frozen zone must be untouched

```bash
git status --short \
  packages/nlp/src/constants.ts packages/nlp/src/normalize.ts \
  packages/nlp/src/wordpiece.ts packages/nlp/src/embed.ts \
  packages/nlp/src/preprocess.ts packages/nlp/src/classify.ts \
  packages/nlp/src/gates.ts
```

**PASS: prints nothing.** Any output at all is a fail, including a file that
differs only in line endings — a formatter run with a wide glob will do that,
and it defeats the check everything else relies on.

## Why the build gate exists

`vite build` bundles with esbuild, which strips types **without checking them**.
For a long time `packages/nlp` was type-checked by nothing: the build ignored
type errors and `jest.config.cjs` sets ts-jest `diagnostics: false`.

A half-applied edit shipped a bundle referencing an identifier that did not
exist. `npm run validate` passed. The chat then threw
`ReferenceError: MAX_TOTAL_ROUNDS is not defined` on **every question it asked**,
and the controller swallowed it — so the reply just never arrived.

`build` and `test` now run `tsc` first and short-circuit on failure. Do not
remove that.

## Optional probes

Two scratch harnesses were used throughout this work. They are not in the repo
(probes belong in a scratchpad, not in `git`), but they are worth rebuilding if
you are doing a large change:

- **a checklist sweep** — drives the built package through the 43 cases in
  steps 01–08 and prints `ok`/`FAIL` per case.
- **a crash fuzz** — every routing fixture as an opening line, each followed by
  a battery of hostile replies, catching anything that throws.
  Last run: 237 fixtures × 28 replies, **0 crashes**.

## Common failure

**`npm test` passes but the demo is broken.** You are running a stale `dist`.
The demos import the built package. Always
`npm run build -w @janus-scheduler/nlp` before checking anything by hand.
