import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { fileURLToPath } from "url";

import { generateMetaPlugin } from "./vite-plugins/generate-meta.plugin";
import { resolveAppVersion } from "./vite-plugins/resolve-app-version";
import { manualChunks } from "./vite.chunksplit";

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss(), generateMetaPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(dirname, "./src"),
    },
  },
  define: {
    "__APP_BUILD_TIME__": JSON.stringify(new Date().toISOString()),
    "import.meta.env.VITE_APP_VERSION": JSON.stringify(resolveAppVersion()),
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks,
      },
    },
    reportCompressedSize: false,
    sourcemap: true,
  },
  // Expose selected env to import.meta.env (never put secrets in VITE_*)
  envPrefix: ["VITE_"],
});
