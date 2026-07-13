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

function exportFileName() {
  const stamp = new Date().toISOString().slice(0, 10);
  return `egf-profiles-${stamp}.json`;
}

/**
 * Write the given profiles to a JSON file the user picks, using the File System Access API
 * (`showSaveFilePicker`) so completion is observable. Resolves:
 *   - "saved"     — the file was actually written to disk.
 *   - "cancelled" — the user dismissed the save dialog (no file written).
 * Throws on a genuine write error. Only call when {@link canSaveWithPicker} is true.
 */
async function saveProfilesWithPicker(profiles, json) {
  let handle;
  try {
    handle = await window.showSaveFilePicker({
      suggestedName: exportFileName(),
      types: [{ description: "JSON", accept: { "application/json": [".json"] } }],
    });
  } catch (e) {
    // AbortError = user closed the picker without choosing. Anything else is a real failure.
    if (e?.name === "AbortError") {
      return "cancelled";
    }
    throw e;
  }
  const writable = await handle.createWritable();
  await writable.write(json);
  await writable.close();
  return "saved";
}

/** Fallback: anchor-click download. Fires-and-forgets — the browser gives no completion signal. */
function downloadViaAnchor(json) {
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = exportFileName();
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Whether the browser can report a truthful save-completion (Chromium: Chrome/Edge). */
export function canSaveWithPicker() {
  return typeof window !== "undefined" && typeof window.showSaveFilePicker === "function";
}

/**
 * Export the given profiles as a JSON file. Returns the outcome so the caller can decide when
 * (and whether) to show feedback:
 *   - "saved"     — file written and confirmed (File System Access API path).
 *   - "cancelled" — user dismissed the save dialog; no file written, show nothing.
 *   - "started"   — anchor-download fallback fired; completion is unobservable in this browser.
 */
export async function exportProfilesToFile(profiles) {
  const json = JSON.stringify(toExportPayload(profiles), null, 2);
  if (canSaveWithPicker()) {
    return saveProfilesWithPicker(profiles, json);
  }
  downloadViaAnchor(json);
  return "started";
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
  let profiles;
  if (Array.isArray(parsed)) {
    profiles = parsed;
  } else if (Array.isArray(parsed?.profiles)) {
    profiles = parsed.profiles;
  } else {
    profiles = [];
  }
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
