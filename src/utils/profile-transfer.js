import { PROFILES_STORAGE_KEY } from "@/constants";
import { normalizeStoredProfile } from "@/constants/levels";

export const EXPORT_FORMAT = "egf-profiles";

/**
 * Current export schema version. Bump this whenever the on-disk shape of an exported
 * profile changes, and add a matching entry to {@link MIGRATIONS} that maps a payload
 * of the previous version up to this one. Import walks that chain so old files keep working.
 */
export const EXPORT_VERSION = 1;

/** Build the JSON payload for a set of saved profiles (always the current version). */
export function toExportPayload(profiles) {
  return {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    source: PROFILES_STORAGE_KEY,
    profiles: profiles.map((p) => ({
      id: p.id,
      title: p.title,
      pillarLevels: p.pillarLevels,
      trackVariant: p.trackVariant,
      savedAt: p.savedAt,
    })),
  };
}

/** Trigger a browser download of the given profiles as a JSON file. */
export function downloadProfilesJson(profiles) {
  const payload = toExportPayload(profiles);
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const stamp = new Date().toISOString().slice(0, 10);
  const a = document.createElement("a");
  a.href = url;
  a.download = `egf-profiles-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Per-version upgrade steps. `MIGRATIONS[n]` transforms a version-`n` payload into a
 * version-`(n+1)` payload. Import applies them in order from the file's version up to
 * {@link EXPORT_VERSION}, so a v1→v3 file runs MIGRATIONS[1] then MIGRATIONS[2].
 *
 * Example for a future change:
 *   const MIGRATIONS = {
 *     1: (payload) => ({ ...payload, version: 2, profiles: payload.profiles.map(renameFooToBar) }),
 *   };
 */
const MIGRATIONS = {};

/**
 * Detect the schema version of an arbitrary parsed payload. Legacy/unversioned inputs —
 * a bare array of profiles, or a plain `{ profiles }` object with no `version` — are
 * treated as version 1 (the original shape).
 */
function detectVersion(parsed) {
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && Number.isInteger(parsed.version)) {
    return parsed.version;
  }
  return 1;
}

/** Coerce any accepted input into a `{ version, profiles }` object at its detected version. */
function toVersionedPayload(parsed) {
  const version = detectVersion(parsed);
  const profiles = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.profiles) ? parsed.profiles : [];
  return { version, profiles };
}

/**
 * Parse a JSON string exported by {@link toExportPayload} (or a legacy bare array /
 * `{ profiles }` object) into a list of normalized, current-schema profiles.
 *
 * Older versions are migrated forward through {@link MIGRATIONS} before normalization.
 * Malformed rows are dropped; returns `[]` for unparseable input or a version newer than
 * this app understands (a forward-incompatible file we shouldn't guess at).
 */
export function parseImportedProfiles(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return [];
  }

  let payload = toVersionedPayload(parsed);

  // Newer than we know how to read — refuse rather than silently mangle.
  if (payload.version > EXPORT_VERSION) {
    return [];
  }

  while (payload.version < EXPORT_VERSION) {
    const migrate = MIGRATIONS[payload.version];
    if (!migrate) {
      // No path forward from this version; bail rather than import a stale shape.
      return [];
    }
    payload = migrate(payload);
  }

  const out = [];
  for (const row of payload.profiles) {
    const n = normalizeStoredProfile(row);
    if (n) {
      out.push(n);
    }
  }
  return out;
}

/** Read a File as text via FileReader (returns a Promise resolving to the string). */
export function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsText(file);
  });
}
