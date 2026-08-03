import { defineConfig, PluginOption } from "vite";
import solidPlugin from "vite-plugin-solid";
import path from "path";

export default defineConfig({
  plugins: [solidPlugin() as PluginOption],
  server: {
    port: 3000,
  },
  build: {
    target: "esnext",
  },
  resolve: {
    alias: {
      "@janus-scheduler/solid": path.resolve(
        __dirname,
        "../../packages/wrappers/solid-js-wrapper/index.tsx",
      ),
      "@janus-scheduler/ui": path.resolve(
        __dirname,
        "../../packages/ui/src/index.ts",
      ),
    },
  },
});
