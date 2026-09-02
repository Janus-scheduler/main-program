import { defineConfig } from "vite";
import dts from "vite-plugin-dts";
import { resolve } from "path";

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "JanusSchedulerIntegrations",
      fileName: (format) => `janus-scheduler-integrations.${format}.js`,
      formats: ["es", "cjs"],
    },
    rollupOptions: {
      // Externalize node built-ins and heavy server deps
      // so the browser bundle stays clean
      external: [
        "@janus-scheduler/core",
        "express",
        "googleapis",
        "cors",
        "node-cron",
        "ws",
        "uuid",
        "dotenv",
        "fs",
        "path",
        "http",
        "crypto",
      ],
      output: {
        globals: {},
      },
    },
    sourcemap: true,
    minify: "esbuild",
  },
  plugins: [
    dts({
      insertTypesEntry: true,
      rollupTypes: true,
    }),
  ],
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
});
