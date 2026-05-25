import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

/** Used when `package.json` has no version and `npm_package_version` is unset. */
export const APP_VERSION_FALLBACK = "0.0.0";

/**
 * Semver baked into the client (`define`) and `dist/meta.json`.
 * Prefers `npm_package_version` (set when running via npm); otherwise reads root `package.json`.
 */
export const resolveAppVersion = () => {
  const fromNpm = process.env.npm_package_version?.trim();
  if (fromNpm) {
    return fromNpm;
  }
  try {
    const pkg = JSON.parse(readFileSync(path.join(repoRoot, "package.json"), "utf8"));
    const fromFile = pkg.version?.trim();
    return fromFile || APP_VERSION_FALLBACK;
  } catch {
    return APP_VERSION_FALLBACK;
  }
};
