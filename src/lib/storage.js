import { PROFILES_STORAGE_KEY, STORAGE_KEY } from "@/lib/constants";
import { normalizeSavedState, normalizeStoredProfile, toCanonicalStoragePayload } from "@/lib/levels";

export function getDefaultChartDisplay() {
  return {
    levelsPolygonHidden: false,
    chartLegendHidden: false,
    chartTitleHidden: false,
    footerScoresHidden: false,
    footerScoresHiddenUserSet: false,
    levelKeyboardInputEnabled: false,
  };
}

export function parseChartDisplay(parsed) {
  if (!parsed || typeof parsed !== "object") {
    return getDefaultChartDisplay();
  }
  const defaults = getDefaultChartDisplay();
  return {
    levelsPolygonHidden: parsed.levelsPolygonHidden === true,
    chartLegendHidden: parsed.chartLegendHidden === true,
    chartTitleHidden: parsed.chartTitleHidden === true,
    footerScoresHidden: Object.hasOwn(parsed, "footerScoresHidden")
      ? parsed.footerScoresHidden === true
      : defaults.footerScoresHidden,
    footerScoresHiddenUserSet: Object.hasOwn(parsed, "footerScoresHidden"),
    levelKeyboardInputEnabled: parsed.levelKeyboardInputEnabled === true,
  };
}

/** Draft JSON: pillar key-value data + session chart display toggles. */
export function toDraftStoragePayload(state) {
  return {
    ...toCanonicalStoragePayload(state),
    levelsPolygonHidden: state.levelsPolygonHidden,
    chartLegendHidden: state.chartLegendHidden,
    chartTitleHidden: state.chartTitleHidden,
    ...(state.footerScoresHiddenUserSet ? { footerScoresHidden: state.footerScoresHidden === true } : {}),
    levelKeyboardInputEnabled: state.levelKeyboardInputEnabled === true,
  };
}

export function loadDraftFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    const normalized = normalizeSavedState(parsed);
    if (!normalized) {
      return null;
    }
    const display = parseChartDisplay(parsed);
    return { ...normalized, ...display };
  } catch {
    return null;
  }
}

export function saveDraftToStorage(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toDraftStoragePayload(state)));
  } catch {
    /* quota / private mode */
  }
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
    for (const row of arr) {
      const n = normalizeStoredProfile(row);
      if (n) {
        out.push(n);
      }
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
