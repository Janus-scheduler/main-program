import { defineConfig, PluginOption } from "vite";
import dts from "vite-plugin-dts";
import { resolve } from "path";

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "JanusSchedulerUI",
      // `.umd.cjs`, not `.umd.js`: this package is `"type": "module"`, so Node
      // parses any `.js` as ESM and `require()` of a UMD `.js` file fails.
      fileName: (format) =>
        format === "umd"
          ? "janus-scheduler-ui.umd.cjs"
          : "janus-scheduler-ui.es.js",
      formats: ["es", "umd"],
    },
    rollupOptions: {
      external: [/^lit/, /^@janus-scheduler\//],
      output: {
        globals: {
          lit: "lit",
          "lit/decorators.js": "litDecorators",
        },
      },
    },
    sourcemap: true,
    minify: "esbuild",
    emptyOutDir: false,
  },

  plugins: [
    dts({
      insertTypesEntry: true,
      rollupTypes: false,
    }) as PluginOption,
  ],

  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
});
