import { defineConfig, PluginOption } from "vite";
import solidPlugin from "vite-plugin-solid";
import dts from "vite-plugin-dts";
import { resolve } from "path";

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, "index.tsx"),
      name: "JanusSchedulerSolid",
      // `.cjs`, not `.cjs.js` — see packages/core/vite.config.ts.
      fileName: (format) =>
        format === "cjs"
          ? "janus-scheduler-solid.cjs"
          : "janus-scheduler-solid.es.js",
      formats: ["es", "cjs"],
    },
    rollupOptions: {
      // All `@janus-scheduler/*` stay external — see the react wrapper's config
      // for why inlining `/core` here produced a second Zustand store.
      external: [/^@janus-scheduler\//, "solid-js", "solid-js/web"],
      output: {
        globals: {
          "solid-js": "Solid",
          "solid-js/web": "SolidWeb",
        },
      },
    },
    sourcemap: true,
  },
  plugins: [
    solidPlugin() as PluginOption,
    dts({
      insertTypesEntry: true,
      rollupTypes: true,
    }) as PluginOption,
  ],
});
