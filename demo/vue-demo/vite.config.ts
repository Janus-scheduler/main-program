import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import path from "path";

export default defineConfig({
  plugins: [
    vue({
      template: {
        compilerOptions: {
          // Tell Vue that all tags starting with "janus-" are custom elements
          // so it doesn't try to resolve them as Vue components.
          isCustomElement: (tag) => tag.startsWith("janus-"),
        },
      },
    }),
  ],
  build: {
    emptyOutDir: false,
  },
  resolve: {
    alias: {
      "@janus-scheduler/ui": path.resolve(
        __dirname,
        "../../packages/ui/src/index.ts",
      ),
      "@janus-scheduler/core": path.resolve(
        __dirname,
        "../../packages/core/src/index.ts",
      ),
    },
  },
});
