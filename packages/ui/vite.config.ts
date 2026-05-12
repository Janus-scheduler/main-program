import { defineConfig } from "vite";
import dts from "vite-plugin-dts";
import { resolve } from "path";

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "JanusSchedulerUI",
      fileName: (format) => `janus-scheduler-ui.${format}.js`,
      formats: ["es", "umd"],
    },
    rollupOptions: {
      external: [/^lit/, "@janus-scheduler/core"],
      output: {
        globals: {
          lit: "lit",
          "lit/decorators.js": "litDecorators",
        },
      },
    },
    sourcemap: true,
    minify: "esbuild",
  },

  plugins: [
    dts({
      insertTypesEntry: true,
      rollupTypes: true,
    }) as any,
  ],

  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
});
