import { FULL_PILLAR_COUNT, PROFILES_STORAGE_KEY, STORAGE_KEY } from "@/lib/constants";
import { normalizeSavedState, normalizeStoredProfile } from "@/lib/levels";

export function loadDraftFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    const normalized = normalizeSavedState(parsed);
    if (normalized && parsed.trackVariant == null) {
      saveDraftToStorage(normalized);
    }
    return normalized;
  } catch {
    return null;
  }
}

export function saveDraftToStorage(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* quota / private mode */
  }
}

function profileNeedsStorageMigration(row) {
  if (row == null || typeof row !== "object") {
    return false;
  }
  if (row.trackVariant == null) {
    return true;
  }
  return (
    !Array.isArray(row.levels) ||
    row.levels.length !== FULL_PILLAR_COUNT ||
    !Array.isArray(row.aiLevels) ||
    row.aiLevels.length !== FULL_PILLAR_COUNT
  );
}

export function loadProfilesFromStorage() {
  try {
    const raw = localStorage.getItem(PROFILES_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    const arr = Array.isArray(parsed.profiles) ? parsed.profiles : [];
    const out = [];
    let migrated = false;

    for (const row of arr) {
      if (profileNeedsStorageMigration(row)) {
        migrated = true;
      }
      const n = normalizeStoredProfile(row);
      if (n) {
        out.push(n);
      }
    }

    out.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));

    if (migrated) {
      writeProfilesToStorage(out);
    }

    return out;
  } catch {
    return [];
  }
}

export function writeProfilesToStorage(profiles) {
  try {
    localStorage.setItem(PROFILES_STORAGE_KEY, JSON.stringify({ profiles }));
  } catch {
    /* quota / private mode */
  }
}
