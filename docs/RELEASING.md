# Releasing

Janus Scheduler publishes **seven** packages to npm under the `@janus-scheduler` scope.
They are versioned **in lockstep** — `.changeset/config.json` puts them all in one
`fixed` group, so every release bumps every package to the same version.

| Package                         | Notes                                                         |
| ------------------------------- | ------------------------------------------------------------- |
| `@janus-scheduler/core`         | Store, services, models, public types                         |
| `@janus-scheduler/ui`           | Lit web components                                            |
| `@janus-scheduler/nlp`          | **Not optional** — a runtime dependency of all three wrappers |
| `@janus-scheduler/integrations` | Google Calendar sync; needs its own Node backend to be useful |
| `@janus-scheduler/react`        |                                                               |
| `@janus-scheduler/angular`      | ESM-only (bundler required); `tsc` build, not Vite            |
| `@janus-scheduler/solid`        |                                                               |

There is no `@janus-scheduler/vue`. The Vue demo consumes `core` + `ui` directly.

## Normal release

1. Land your change with a changeset:
   ```bash
   npx changeset          # pick packages + bump type, write a summary
   git add .changeset && git commit
   ```
2. Merge to `main`. `.github/workflows/release.yml` opens a **"Version Packages"** PR.
3. Merge that PR. The same workflow publishes to npm and pushes git tags.

The workflow gates the publish on `build:all`, `check:packages`, both Jest suites,
and `test:pack`. A red gate blocks the publish.

## Required secrets

| Secret        | Used for                                                                |
| ------------- | ----------------------------------------------------------------------- |
| `NPM_TOKEN`   | An **Automation** token from npmjs.com with publish rights on the scope |
| `SONAR_TOKEN` | Existing SonarQube scan                                                 |

The scope is owned by `janus-scheduler` (janus.scheduler@gmail.com).

## Local checks before publishing

```bash
npm run validate         # lint + build every workspace
npm run check:packages   # publint across all seven manifests
npm run test:pack        # THE important one — see below
```

### Why `test:pack` exists

Every demo aliases `@janus-scheduler/*` back to `src` in its Vite config, so
**nothing else in this repo consumes the library the way an npm user does.**
That is how v1.0.3 shipped broken: the React wrapper inlined its own copy of
`core` while `ui` resolved the real one from `node_modules`, giving consumers
two Zustand stores — `manager.addEvent()` wrote to one and `<janus-timeline>`
rendered from the other, so nothing appeared.

`npm run test:pack` packs the real tarballs, installs them into a throwaway app
outside the workspace, and asserts the store is a single shared instance and
that `require()` resolves. Do not publish with it red.

## Packaging invariants

Break any of these and the published packages break, silently and only for
real consumers:

- **All `@janus-scheduler/*` imports stay `external`** in every wrapper's Vite
  config. Inlining `core` duplicates the Zustand store.
- **`zustand` stays external in `core`.** Same reason.
- **`rrule` stays bundled in `core`.** `rrule@2.8.1` ships no `exports` map, so
  Node ESM resolves its CJS build and `import { RRule }` throws. It holds no
  singleton state, so inlining is safe.
- **CJS output uses a real `.cjs` extension.** These packages are
  `"type": "module"`, so Node parses any `.js` as ESM and a `.cjs.js` CommonJS
  file is unloadable by `require()`.
- **`prepublishOnly` must stay.** `dist/` is gitignored; without it a fresh
  clone publishes an empty tarball.

## Manual publish (fallback)

```bash
npm whoami               # must be authenticated; re-run `npm login` if 401
npm run build:all
npm run check:packages && npm run test:pack
npx changeset publish    # respects dependency order and the `fixed` group
```
