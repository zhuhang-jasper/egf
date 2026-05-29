import { PROFILES_STORAGE_KEY, STORAGE_KEY } from "@/lib/constants";
import {
  needsStorageUpgrade,
  normalizeSavedState,
  normalizeStoredProfile,
  toCanonicalStoragePayload,
} from "@/lib/levels";

export function loadDraftFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    const normalized = normalizeSavedState(parsed);
    if (normalized && needsStorageUpgrade(parsed)) {
      saveDraftToStorage(toCanonicalStoragePayload(normalized));
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
  return needsStorageUpgrade(row);
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
