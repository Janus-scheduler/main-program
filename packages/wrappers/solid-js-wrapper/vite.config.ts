import { defineConfig, PluginOption } from "vite";
import solidPlugin from "vite-plugin-solid";
import dts from "vite-plugin-dts";
import { resolve } from "path";

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, "index.tsx"),
      name: "JanusSchedulerSolid",
      fileName: (format) => `janus-scheduler-solid.${format}.js`,
      formats: ["es", "cjs"],
    },
    rollupOptions: {
      external: ["solid-js", "solid-js/web", "@janus-scheduler/ui"],
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
