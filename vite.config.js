import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { fileURLToPath } from "url";

import { generateMetaPlugin } from "./vite-plugins/generate-meta.plugin";
import { ADMIN_PBKDF2, resolveAdminPasswordHash } from "./vite-plugins/resolve-admin-hash";
import { resolveAppVersion } from "./vite-plugins/resolve-app-version";
import { manualChunks } from "./vite.chunksplit";

const dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Project site: https://<owner>.github.io/<repo>/
 * GITHUB_PAGES_BASE is set by the deploy workflow from the repo name, so
 * forks (e.g. egf-stage) deploy under their own path without editing this file.
 */
const pagesBase = process.env.GITHUB_PAGES === "true" ? (process.env.GITHUB_PAGES_BASE ?? "/egf/") : "/";

export default defineConfig({
  base: pagesBase,
  plugins: [react(), tailwindcss(), generateMetaPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(dirname, "./src"),
    },
  },
  define: {
    "__APP_BUILD_TIME__": JSON.stringify(new Date().toISOString()),
    "import.meta.env.VITE_APP_VERSION": JSON.stringify(resolveAppVersion()),
    // Hashed at build time so the plaintext password never reaches the bundle.
    "import.meta.env.VITE_ADMIN_PASSWORD_HASH": JSON.stringify(resolveAdminPasswordHash()),
    "import.meta.env.VITE_ADMIN_PBKDF2": JSON.stringify(ADMIN_PBKDF2),
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
