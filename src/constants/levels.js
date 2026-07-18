import { CANONICAL_PILLAR_IDS, DEFAULT_PILLAR_LEVEL, getPillarOrder, LEVEL_STEP, MAX_PROFILE_NAME_LENGTH, normalizeAttachedBadge } from "@/constants";
import { SCHEMA_VERSION } from "@/constants/storage";

export function clampLevel(v) {
  const step = LEVEL_STEP;
  const inv = 1 / step;
  const n = (() => {
    if (typeof v === "number" && Number.isFinite(v)) {
      return v;
    }
    let raw = String(v).trim().replace(",", ".");
    if (raw === "" || raw === "-") {
      return Number.NaN;
    }
    if (/^\.(?=\d)/.test(raw)) {
      raw = `0${raw}`;
    }
    return parseFloat(raw);
  })();
  if (!Number.isFinite(n)) {
    return 0;
  }
  const c = Math.max(0, Math.min(5, n));
  return Math.round(c * inv) / inv;
}

export function formatLevelForInput(v) {
  const x = clampLevel(v);
  const inv = 1 / LEVEL_STEP;
  const stepped = Math.round(x * inv) / inv;
  if (Math.abs(stepped - Math.round(stepped)) < 1e-9) {
    return String(Math.round(stepped));
  }
  const decimals = Math.max(1, Math.ceil(-Math.log10(LEVEL_STEP)));
  return stepped.toFixed(decimals);
}

export function createDefaultPillarLevels() {
  const levels = {};
  for (const id of CANONICAL_PILLAR_IDS) {
    levels[id] = DEFAULT_PILLAR_LEVEL;
  }
  return levels;
}

/** Fill missing pillar keys with defaults (forward-compatible when new pillars are added). */
export function fillPillarLevels(map) {
  const next = {};
  for (const id of CANONICAL_PILLAR_IDS) {
    next[id] = clampLevel(map?.[id] ?? DEFAULT_PILLAR_LEVEL);
  }
  return next;
}

export function pillarLevelsToArray(pillarLevels) {
  const order = getPillarOrder();
  return order.map((id) => clampLevel(pillarLevels[id] ?? DEFAULT_PILLAR_LEVEL));
}

export function syncLevelsArrayFromMap({ pillarLevels }) {
  return {
    levels: pillarLevelsToArray(pillarLevels),
  };
}

function isPillarLevelsMap(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

/**
 * Migrate a pre-v2 payload's legacy `trackVariant` to the current `attachedBadge` field:
 * legacy `"be"` → `"be"`, everything else (incl. `"fe"` and absent) → `"none"`. Reads the legacy
 * key by design (this is one of the only two places `trackVariant` is still referenced).
 */
export function migrateBadgeKey(row) {
  if (!row || typeof row !== "object") {
    return row;
  }
  const { trackVariant, ...rest } = row;
  const attachedBadge = trackVariant === "be" ? "be" : (rest.attachedBadge ?? "none");
  return { ...rest, attachedBadge };
}

/** Persistable snapshot for drafts and saved profiles. */
export function toCanonicalStoragePayload(state) {
  return {
    schemaVersion: SCHEMA_VERSION,
    title: state.title,
    pillarLevels: fillPillarLevels(state.pillarLevels ?? {}),
    attachedBadge: normalizeAttachedBadge(state.attachedBadge),
  };
}

/** Parse stored JSON into canonical key-value pillar maps. */
export function parseToCanonicalState(parsed) {
  if (!parsed || typeof parsed !== "object" || typeof parsed.title !== "string") {
    return null;
  }
  if (!isPillarLevelsMap(parsed.pillarLevels)) {
    return null;
  }

  return {
    // Cap the name so typed, imported, and legacy profiles all stay within the limit.
    title: parsed.title.slice(0, MAX_PROFILE_NAME_LENGTH),
    pillarLevels: fillPillarLevels(parsed.pillarLevels),
    attachedBadge: normalizeAttachedBadge(parsed.attachedBadge),
  };
}

export function normalizeSavedState(parsed) {
  const canonical = parseToCanonicalState(parsed);
  if (!canonical) {
    return null;
  }
  const view = syncLevelsArrayFromMap(canonical);
  return {
    title: canonical.title,
    pillarLevels: canonical.pillarLevels,
    levels: view.levels,
    attachedBadge: canonical.attachedBadge,
  };
}

export function newSavedProfileId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `p-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function normalizeStoredProfile(p) {
  if (!p || typeof p !== "object" || typeof p.id !== "string" || !p.id) {
    return null;
  }
  const canonical = parseToCanonicalState(p);
  if (!canonical) {
    return null;
  }
  return {
    id: p.id,
    title: canonical.title,
    pillarLevels: canonical.pillarLevels,
    attachedBadge: canonical.attachedBadge,
    savedAt: Number.isFinite(p.savedAt) ? p.savedAt : 0,
  };
}

export function getDefaultChartState() {
  const pillarLevels = createDefaultPillarLevels();
  const attachedBadge = "none";
  const view = syncLevelsArrayFromMap({ pillarLevels });
  return {
    title: "",
    pillarLevels,
    levels: view.levels,
    attachedBadge,
  };
}

export function mergeViewIntoCanonical({ levels, pillarLevels }) {
  const order = getPillarOrder();
  const nextLevels = { ...pillarLevels };

  for (let i = 0; i < order.length; i++) {
    const id = order[i];
    if (levels[i] !== undefined) {
      nextLevels[id] = clampLevel(levels[i]);
    }
  }

  return { pillarLevels: fillPillarLevels(nextLevels) };
}
