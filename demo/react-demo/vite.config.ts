import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@janus-scheduler/react": path.resolve(
        __dirname,
        "../../packages/wrappers/react-wrapper/index.ts",
      ),
      "@janus-scheduler/ui": path.resolve(
        __dirname,
        "../../packages/ui/src/index.ts",
      ),
      "@janus-scheduler/integrations": path.resolve(
        __dirname,
        "../../packages/integrations/src/index.ts",
      ),
    },
  },
});
