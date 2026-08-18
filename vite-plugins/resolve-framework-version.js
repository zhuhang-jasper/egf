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
 * Takes the first `version:` AFTER the `export const CHANGELOG = [` line, which is the newest CHANGELOG entry
 * and therefore the same value `FRAMEWORK_VERSION` derives from at runtime. That relies on the array's
 * newest-entry-first ordering, which the file's authoring rules already require and the runtime ranking
 * depends on just as much. Commented-out future entries sit BELOW the live ones, so they cannot win the match.
 *
 * ANCHORED ON THE ARRAY, not simply the file's first `version:`, because CHANGELOG_DRAFT is declared ABOVE
 * CHANGELOG and carries a version of its own. An unanchored match would publish the unreleased number.
 */
export const resolveFrameworkVersion = () => {
  try {
    const source = readFileSync(path.join(repoRoot, "src/constants/changelog.js"), "utf8");
    const published = source.slice(source.indexOf("export const CHANGELOG = ["));
    const match = published.match(/^\s*version:\s*"(?<version>[^"]+)"/m);
    return match?.groups?.version?.trim() || FRAMEWORK_VERSION_FALLBACK;
  } catch {
    return FRAMEWORK_VERSION_FALLBACK;
  }
};
