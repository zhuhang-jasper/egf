import { PROFILES_STORAGE_KEY, SCHEMA_VERSION, STORAGE_KEY } from "@/constants";
import { migrateBadgeKey, normalizeSavedState, normalizeStoredProfile, toCanonicalStoragePayload } from "@/constants/levels";

/** True when a stored payload predates the current schema (missing or lower `schemaVersion`). */
function isPreV2(parsed) {
  return !parsed || typeof parsed !== "object" || !(Number(parsed.schemaVersion) >= SCHEMA_VERSION);
}

export function getDefaultChartDisplay() {
  return {
    levelsPolygonHidden: false,
    chartLevelTicksHidden: false,
    chartLegendHidden: false,
    chartBadgeHidden: false,
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
    chartLevelTicksHidden: parsed.chartLevelTicksHidden === true,
    chartLegendHidden: parsed.chartLegendHidden === true,
    chartBadgeHidden: parsed.chartBadgeHidden === true,
    chartTitleHidden: parsed.chartTitleHidden === true,
    footerScoresHidden: Object.hasOwn(parsed, "footerScoresHidden") ? parsed.footerScoresHidden === true : defaults.footerScoresHidden,
    footerScoresHiddenUserSet: Object.hasOwn(parsed, "footerScoresHidden"),
    levelKeyboardInputEnabled: parsed.levelKeyboardInputEnabled === true,
  };
}

/** Draft JSON: pillar key-value data + session chart display toggles + linked-profile id. */
export function toDraftStoragePayload(state) {
  return {
    ...toCanonicalStoragePayload(state),
    // The saved profile this draft was loaded from, so the "Saved/Rename/Update" status survives a
    // refresh. Draft-only (never part of a saved profile's own shape); null when unlinked.
    activeSavedProfileId: state.activeSavedProfileId ?? null,
    levelsPolygonHidden: state.levelsPolygonHidden,
    chartLevelTicksHidden: state.chartLevelTicksHidden,
    chartLegendHidden: state.chartLegendHidden,
    chartBadgeHidden: state.chartBadgeHidden,
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
    let parsed = JSON.parse(raw);
    const needsMigration = isPreV2(parsed);
    if (needsMigration) {
      parsed = migrateBadgeKey(parsed);
    }
    const normalized = normalizeSavedState(parsed);
    if (!normalized) {
      return null;
    }
    const display = parseChartDisplay(parsed);
    const activeSavedProfileId = parsed?.activeSavedProfileId ?? null;
    const result = { ...normalized, ...display, activeSavedProfileId };
    // Persist the migrated draft back once so the legacy `trackVariant` key is dropped for good.
    if (needsMigration) {
      saveDraftToStorage(result);
    }
    return result;
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
    const needsMigration = isPreV2(parsed);
    const out = [];
    for (const row of arr) {
      const n = normalizeStoredProfile(needsMigration ? migrateBadgeKey(row) : row);
      if (n) {
        out.push(n);
      }
    }
    out.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
    // Persist the migrated list back once so legacy `trackVariant` rows are rewritten as v2.
    if (needsMigration) {
      writeProfilesToStorage(out);
    }
    return out;
  } catch {
    return [];
  }
}

export function writeProfilesToStorage(profiles) {
  try {
    localStorage.setItem(PROFILES_STORAGE_KEY, JSON.stringify({ schemaVersion: SCHEMA_VERSION, profiles }));
  } catch {
    /* quota / private mode */
  }
}
