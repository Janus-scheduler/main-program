import { defineConfig } from "vite";
import dts from "vite-plugin-dts";
import { resolve } from "path";

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "JanusScheduler",
      // The CJS build gets a real `.cjs` extension, NOT `.cjs.js`. This
      // package.json declares `"type": "module"`, which makes Node parse every
      // `.js` file as ESM — so a file named `janus-scheduler.cjs.js` containing
      // `exports.x = ...` is silently unloadable by `require()`.
      fileName: (format) =>
        format === "cjs" ? "janus-scheduler.cjs" : "janus-scheduler.es.js",
      formats: ["es", "cjs"], // ESM + CommonJS
    },
    rollupOptions: {
      // `zustand` MUST stay external: two copies means two `schedulerStore`
      // singletons, and the UI then silently renders nothing. Regex, not a
      // bare name — core imports `zustand/vanilla`.
      //
      // `rrule` is deliberately NOT external. rrule@2.8.1 declares no
      // `exports` map and its `main` is CJS, so `import { RRule } from "rrule"`
      // throws under Node ESM (`Named export 'RRule' not found`); its ESM
      // build is reachable only through the bundler-only `module` field.
      // Inlining it is safe because rrule holds no singleton state.
      external: [/^zustand/],
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
      insertTypesEntry: true, // Generates janus-scheduler.d.ts
      rollupTypes: false,
    }),
  ],

  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
});
