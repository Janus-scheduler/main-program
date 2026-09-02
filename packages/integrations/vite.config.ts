import { defineConfig } from "vite";
import dts from "vite-plugin-dts";
import { resolve } from "path";

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "JanusSchedulerIntegrations",
      // `.cjs`, not `.cjs.js` — see packages/core/vite.config.ts.
      fileName: (format) =>
        format === "cjs"
          ? "janus-scheduler-integrations.cjs"
          : "janus-scheduler-integrations.es.js",
      formats: ["es", "cjs"],
    },
    rollupOptions: {
      // Externalize node built-ins and heavy server deps
      // so the browser bundle stays clean
      external: [
        /^@janus-scheduler\//,
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
    // `npm run build` is `vite build && tsc -p tsconfig.server.json`, and BOTH
    // write into this same `dist`. Without this, a future reordering (or a
    // watch rebuild) would wipe the tsc-emitted `dist/server/**`.
    emptyOutDir: false,
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
