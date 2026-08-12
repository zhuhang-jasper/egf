import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

/** Used when the constant cannot be read, so a build never fails over a metadata field. */
export const FRAMEWORK_VERSION_FALLBACK = "0.0";

/**
 * The framework revision, read out of `src/constants/changelog.js` for `dist/meta.json`.
 *
 * PARSED, NOT IMPORTED: that module is client ESM behind the `@/` alias and imports from `@/utils`, so
 * importing it into a build-time plugin would pull the alias resolver into the Vite config. A single string
 * extraction does not justify that.
 *
 * Takes the FIRST `version:` in the file, which is the newest CHANGELOG entry and therefore the same value
 * `FRAMEWORK_VERSION` derives from at runtime. That relies on the array's newest-entry-first ordering, which
 * the file's authoring rules already require and the runtime ranking depends on just as much. Commented-out
 * future entries sit BELOW the live ones, so they cannot win the match.
 */
export const resolveFrameworkVersion = () => {
  try {
    const source = readFileSync(path.join(repoRoot, "src/constants/changelog.js"), "utf8");
    const match = source.match(/^\s*version:\s*"(?<version>[^"]+)"/m);
    return match?.groups?.version?.trim() || FRAMEWORK_VERSION_FALLBACK;
  } catch {
    return FRAMEWORK_VERSION_FALLBACK;
  }
};
