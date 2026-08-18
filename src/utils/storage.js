import {
  BACKUP_REMINDER_EVERY,
  BACKUP_REMINDER_FIRST,
  FEATURE_CHART_ATTRIBUTION_SETTING,
  FEATURE_CHART_LEGEND_SETTING,
  FEATURE_CHART_STRUCTURE_SETTINGS,
  FEATURE_CHART_UHD_EXPORT_SETTING,
  PROFILE_SAVE_COUNT_KEY,
  PROFILES_STORAGE_KEY,
  RETIRED_STORAGE_KEYS,
  SCHEMA_VERSION,
  STORAGE_KEY,
} from "@/constants";
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
    chartAttributionHidden: false,
    chartUhdExport: false,
    chartBadgeHidden: false,
    chartTitleHidden: false,
    footerScoresHidden: false,
    footerScoresHiddenUserSet: false,
    levelKeyboardInputEnabled: false,
    // Per-cluster pillar-label colors (the theory hero chart's palette). Off by default: the cluster
    // wedges and legend already encode the grouping, and colored labels cost contrast against the
    // polygon without adding information.
    clusterLabelColors: false,
    // Strip the leading emoji from pillar labels (text-only spokes).
    pillarEmojiHidden: false,
  };
}

export function parseChartDisplay(parsed) {
  if (!parsed || typeof parsed !== "object") {
    return getDefaultChartDisplay();
  }
  const defaults = getDefaultChartDisplay();
  return {
    // EVERY ADMIN-GATED TOGGLE IS FORCED BACK TO ITS DEFAULT in the public build. Honouring a draft persisted
    // while one was still reachable would leave a user with a setting they can neither see nor undo, since the
    // control that set it is gone. Reading them off here is what heals those older drafts, and the healed value
    // is written back on the next persistDraft().
    // The first four each REMOVE something — the polygon, the level ticks, the legend, the credit line — so a
    // stale `true` means a degraded chart or an uncredited export. The fifth is the reverse: the hi-res flag adds
    // resolution, and a stale `true` would have a public user silently exporting oversized files they never asked
    // for and cannot switch off.
    levelsPolygonHidden: FEATURE_CHART_STRUCTURE_SETTINGS && parsed.levelsPolygonHidden === true,
    chartLevelTicksHidden: FEATURE_CHART_STRUCTURE_SETTINGS && parsed.chartLevelTicksHidden === true,
    chartLegendHidden: FEATURE_CHART_LEGEND_SETTING && parsed.chartLegendHidden === true,
    chartAttributionHidden: FEATURE_CHART_ATTRIBUTION_SETTING && parsed.chartAttributionHidden === true,
    chartUhdExport: FEATURE_CHART_UHD_EXPORT_SETTING && parsed.chartUhdExport === true,
    chartBadgeHidden: parsed.chartBadgeHidden === true,
    chartTitleHidden: parsed.chartTitleHidden === true,
    footerScoresHidden: Object.hasOwn(parsed, "footerScoresHidden") ? parsed.footerScoresHidden === true : defaults.footerScoresHidden,
    footerScoresHiddenUserSet: Object.hasOwn(parsed, "footerScoresHidden"),
    levelKeyboardInputEnabled: parsed.levelKeyboardInputEnabled === true,
    clusterLabelColors: parsed.clusterLabelColors === true,
    pillarEmojiHidden: parsed.pillarEmojiHidden === true,
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
    chartAttributionHidden: state.chartAttributionHidden,
    chartUhdExport: state.chartUhdExport === true,
    chartBadgeHidden: state.chartBadgeHidden,
    chartTitleHidden: state.chartTitleHidden,
    ...(state.footerScoresHiddenUserSet ? { footerScoresHidden: state.footerScoresHidden === true } : {}),
    levelKeyboardInputEnabled: state.levelKeyboardInputEnabled === true,
    clusterLabelColors: state.clusterLabelColors === true,
    pillarEmojiHidden: state.pillarEmojiHidden === true,
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

/**
 * The running total of profiles this device has ever created (PROFILE_SAVE_COUNT_KEY). 0 when absent,
 * unreadable, or garbage — a missing count reads as "has never created one", which is the same state a
 * brand-new device is in, so a wiped or corrupt value costs at most one extra reminder.
 */
export function readProfileCreateCount() {
  try {
    const n = Number(localStorage.getItem(PROFILE_SAVE_COUNT_KEY));
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}

/** Record one profile creation and return the new total (unchanged on a store we cannot write). */
export function bumpProfileCreateCount() {
  const next = readProfileCreateCount() + 1;
  try {
    localStorage.setItem(PROFILE_SAVE_COUNT_KEY, String(next));
  } catch {
    /* quota / private mode — the reminder just won't advance; nothing else depends on it */
  }
  return next;
}

/**
 * Whether a creation count is a backup-reminder milestone: the 1st, then every 10th (1, 10, 20, …).
 *
 * DERIVED FROM THE COUNT, with no "last shown at" companion key. The count only ever moves forward, and
 * only at the moment of a creation, so testing it once per creation shows each milestone exactly once —
 * a marker key would add a second thing to migrate and retire for no behaviour the count cannot give.
 */
export function isBackupReminderMilestone(count) {
  return count === BACKUP_REMINDER_FIRST || (count > 0 && count % BACKUP_REMINDER_EVERY === 0);
}

/**
 * Delete keys this app wrote previously and no longer reads. Called once per load from main.jsx.
 *
 * It deletes ONLY what RETIRED_STORAGE_KEYS names, never a `:v1` pattern: one legacy `:v1` key is still
 * read on every boot, and a pattern sweep would eat it. Unconditional rather than guarded by a "migrated"
 * marker, since `removeItem` on an absent key is a no-op and a marker would cost its own key.
 */
export function retireLegacyKeys() {
  for (const key of RETIRED_STORAGE_KEYS) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* private mode / disabled store — nothing to clean up in a store we cannot read either */
    }
  }
}
