import { defineConfig } from "vitest/config";
import dts from "vite-plugin-dts";
import { resolve } from "path";

/**
 * Multi-entry library build — the first in this repo.
 *
 * Two entries, deliberately separated:
 *   - `index` is the PURE entry. No `fs`, no `fetch`, no Node builtins. It is
 *     what browsers and bundlers get from `@janus-scheduler/nlp`.
 *   - `node`  is the filesystem loader. It is the ONLY module allowed to touch
 *     `node:fs`, and it is reachable only via `@janus-scheduler/nlp/node`.
 *
 * Because of this split we cannot use `rollupTypes: true` (as
 * packages/core/vite.config.ts does) — that flattens everything into a single
 * .d.ts and would collapse the two entries into one. Instead vite-plugin-dts
 * emits per-file declarations, giving us both dist/index.d.ts and
 * dist/node.d.ts, which the package.json "exports" map points at.
 */
export default defineConfig({
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, "src/index.ts"),
        node: resolve(__dirname, "src/node.ts"),
      },
      formats: ["es", "cjs"], // ESM + CommonJS
      // The CJS build gets a real `.cjs` extension, NOT `.cjs.js`. This
      // package.json declares `"type": "module"`, which makes Node parse every
      // `.js` file as ESM — so a file named `index.cjs.js` containing
      // `exports.x = ...` is silently unloadable by `require()`. `.cjs` is
      // CommonJS regardless of the `type` field. (packages/core emits
      // `*.cjs.js` and has this latent bug; we do not copy it.)
      fileName: (format, entryName) =>
        format === "cjs" ? `${entryName}.cjs` : `${entryName}.es.js`,
    },
    rollupOptions: {
      // Node builtins must never be inlined — keeping them external is what
      // lets a bundler tree-shake `./node` away from a browser build.
      // `chrono-node` is a real runtime dependency and stays external too, so
      // a host that also uses it does not end up with two copies.
      external: [
        "fs",
        "path",
        "url",
        "node:fs",
        "node:path",
        "node:url",
        /^chrono-node/,
      ],
      output: {
        globals: {},
      },
    },
    sourcemap: true,
    minify: "esbuild",
    emptyOutDir: false,
  },

  plugins: [
    dts({
      insertTypesEntry: false,
      rollupTypes: false,
      include: ["src/**/*.ts"],
    }),
  ],

  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },

  test: {
    globals: true,
  },
});
