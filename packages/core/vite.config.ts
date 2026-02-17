import { defineConfig } from "vite";
import dts from "vite-plugin-dts";
import { resolve } from "path";

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "JanusScheduler",
      fileName: (format) => `janus-scheduler.${format}.js`,
      formats: ["es", "cjs"], // ESM + CommonJS
    },
    rollupOptions: {
      external: [], // Add dependencies here if needed (e.g., 'dayjs')
      output: {
        globals: {},
      },
    },
    sourcemap: true,
    minify: "esbuild",
  },

  plugins: [
    dts({
      insertTypesEntry: true, // Generates janus-scheduler.d.ts
      rollupTypes: true,
    }),
  ],

  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
});
