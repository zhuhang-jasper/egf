import { PROFILES_STORAGE_KEY,STORAGE_KEY } from "@/lib/constants";
import { normalizeSavedState, normalizeStoredProfile } from "@/lib/levels";

export function loadDraftFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {return null;}
    return normalizeSavedState(JSON.parse(raw));
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

export function loadProfilesFromStorage() {
  try {
    const raw = localStorage.getItem(PROFILES_STORAGE_KEY);
    if (!raw) {return [];}
    const parsed = JSON.parse(raw);
    const arr = Array.isArray(parsed.profiles) ? parsed.profiles : [];
    const out = [];
    for (const row of arr) {
      const n = normalizeStoredProfile(row);
      if (n) {out.push(n);}
    }
    out.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
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
