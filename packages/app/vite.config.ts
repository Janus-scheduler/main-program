import { defineConfig, PluginOption } from "vite";
import dts from "vite-plugin-dts";
import { resolve } from "path";

/**
 * Two entries:
 *   - `index` ships `<janus-app>` itself. It is a plain custom element, so it
 *     works in Vue, Angular, Solid and vanilla with no framework glue.
 *   - `react` ships the @lit/react binding, needed for idiomatic props and for
 *     React 18 (which has no native custom-element property support).
 */
export default defineConfig({
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, "src/index.ts"),
        react: resolve(__dirname, "src/react.ts"),
      },
      formats: ["es", "cjs"],
      // `.cjs`, not `.cjs.js` — see packages/core/vite.config.ts.
      fileName: (format, entryName) =>
        format === "cjs" ? `${entryName}.cjs` : `${entryName}.es.js`,
    },
    rollupOptions: {
      // Every @janus-scheduler/* package stays external, or this bundle would
      // carry its own copy of core and give the consumer a second Zustand store.
      external: [
        /^@janus-scheduler\//,
        /^lit/,
        "@lit/react",
        "react",
        "react-dom",
      ],
      output: { globals: {} },
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
    }) as PluginOption,
  ],
});
