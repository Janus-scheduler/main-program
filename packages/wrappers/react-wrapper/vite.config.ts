import { defineConfig, PluginOption } from "vite";
import dts from "vite-plugin-dts";
import { resolve } from "path";

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, "index.ts"),
      name: "JanusSchedulerReact",
      // `.cjs`, not `.cjs.js` — see packages/core/vite.config.ts.
      fileName: (format) =>
        format === "cjs"
          ? "janus-scheduler-react.cjs"
          : "janus-scheduler-react.es.js",
      formats: ["es", "cjs"],
    },
    rollupOptions: {
      // EVERY `@janus-scheduler/*` package must stay external. Previously only
      // `/ui` was listed, so `/core` and `/nlp` were inlined into this bundle
      // while `/ui` resolved the real `/core` from node_modules — giving the
      // consumer TWO Zustand stores. `manager.addEvent()` wrote to one and
      // `<janus-timeline>` rendered from the other, so nothing appeared.
      external: [/^@janus-scheduler\//, "react", "react-dom", "@lit/react"],
      output: {
        globals: {
          react: "React",
          "react-dom": "ReactDOM",
        },
      },
    },
    sourcemap: true,
  },
  plugins: [
    dts({
      insertTypesEntry: true,
      rollupTypes: false,
    }) as PluginOption,
  ],
});
