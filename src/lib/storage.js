import { PILLAR_SCHEMA, PROFILES_STORAGE_KEY, SCORES_VISIBLE_FROM_URL, STORAGE_KEY } from "@/lib/constants";
import { needsStorageUpgrade, normalizeSavedState, normalizeStoredProfile, toCanonicalStoragePayload } from "@/lib/levels";

export function getDefaultChartDisplay() {
  return {
    levelsPolygonHidden: false,
    chartLegendHidden: false,
    chartTitleHidden: false,
    footerScoresHidden: !SCORES_VISIBLE_FROM_URL,
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
    footerScoresHidden:
      typeof parsed.footerScoresHidden === "boolean" ? parsed.footerScoresHidden : defaults.footerScoresHidden,
  };
}

/** Draft JSON: canonical pillar data + session chart display toggles. */
export function toDraftStoragePayload(state) {
  return {
    ...toCanonicalStoragePayload(state),
    pillarSchema: PILLAR_SCHEMA,
    levelsPolygonHidden: state.levelsPolygonHidden,
    chartLegendHidden: state.chartLegendHidden,
    chartTitleHidden: state.chartTitleHidden,
    footerScoresHidden: state.footerScoresHidden,
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
    const draft = { ...normalized, ...display };
    if (needsStorageUpgrade(parsed)) {
      saveDraftToStorage(toDraftStoragePayload(draft));
    }
    return draft;
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
