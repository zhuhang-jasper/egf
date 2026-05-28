import {
  AI_PILLAR_CHART_INDEX,
  BASE_PILLAR_COUNT,
  DEFAULT_STATE,
  FULL_PILLAR_COUNT,
  isAiPillarIndex,
  LEVEL_STEP,
  normalizeTrackVariant,
  PILLAR_COUNT,
  PILLAR_SCHEMA,
} from "@/lib/constants";

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

/** Schema 1 had Process at 2 and AI at 3; current schema swaps them. */
function migrateAiBeforeProcessLevels(levels) {
  const next = levels.map((v) => clampLevel(v));
  [next[2], next[3]] = [next[3], next[2]];
  return next;
}

function migrateAiBeforeProcessAiLevels(aiLevels) {
  const next = aiLevels.map((v) => clampLevel(v));
  next[3] = next[2];
  next[AI_PILLAR_CHART_INDEX] = 0;
  return next;
}

function insertAiPillarIntoLevels(levels) {
  if (levels.length !== BASE_PILLAR_COUNT) {
    return null;
  }
  return [
    clampLevel(levels[0]),
    clampLevel(levels[1]),
    0,
    clampLevel(levels[2]),
    clampLevel(levels[3]),
    clampLevel(levels[4]),
    clampLevel(levels[5]),
    clampLevel(levels[6]),
  ];
}

function removeAiPillarFromLevels(levels) {
  if (levels.length !== FULL_PILLAR_COUNT) {
    return null;
  }
  return [
    clampLevel(levels[0]),
    clampLevel(levels[1]),
    clampLevel(levels[3]),
    clampLevel(levels[4]),
    clampLevel(levels[5]),
    clampLevel(levels[6]),
    clampLevel(levels[7]),
  ];
}

function insertAiPillarIntoAiLevels(aiLevels) {
  if (aiLevels.length !== BASE_PILLAR_COUNT) {
    return null;
  }
  return normalizeAiLevels([aiLevels[0], aiLevels[1], 0, aiLevels[2], aiLevels[3], aiLevels[4], aiLevels[5], aiLevels[6]]);
}

function removeAiPillarFromAiLevels(aiLevels) {
  if (aiLevels.length !== FULL_PILLAR_COUNT) {
    return null;
  }
  return normalizeAiLevels([aiLevels[0], aiLevels[1], aiLevels[3], aiLevels[4], aiLevels[5], aiLevels[6], aiLevels[7]]);
}

function resizeLevelsToTarget(levels, schema = 0) {
  if (!Array.isArray(levels)) {
    return null;
  }

  let mapped = levels.map((v) => clampLevel(v));

  if (mapped.length === FULL_PILLAR_COUNT && schema === 1) {
    mapped = migrateAiBeforeProcessLevels(mapped);
  }

  if (mapped.length === PILLAR_COUNT) {
    return mapped;
  }

  if (mapped.length === FULL_PILLAR_COUNT && PILLAR_COUNT === BASE_PILLAR_COUNT) {
    return removeAiPillarFromLevels(mapped);
  }

  if (mapped.length === BASE_PILLAR_COUNT && PILLAR_COUNT === FULL_PILLAR_COUNT) {
    return insertAiPillarIntoLevels(mapped);
  }

  return null;
}

function resizeAiLevelsToTarget(aiLevels, schema = 0) {
  if (!Array.isArray(aiLevels)) {
    return null;
  }

  let mapped = aiLevels.map((v) => clampLevel(v));

  if (mapped.length === FULL_PILLAR_COUNT && schema === 1) {
    mapped = migrateAiBeforeProcessAiLevels(mapped);
  }

  if (mapped.length === PILLAR_COUNT) {
    return normalizeAiLevels(mapped);
  }

  if (mapped.length === FULL_PILLAR_COUNT && PILLAR_COUNT === BASE_PILLAR_COUNT) {
    return removeAiPillarFromAiLevels(mapped);
  }

  if (mapped.length === BASE_PILLAR_COUNT && PILLAR_COUNT === FULL_PILLAR_COUNT) {
    return insertAiPillarIntoAiLevels(mapped);
  }

  return null;
}

/** @deprecated Use {@link resizeLevelsToTarget}. */
export const migrateLevelsToCurrent = resizeLevelsToTarget;

/** @deprecated Use {@link resizeAiLevelsToTarget}. */
export const migrateAiLevelsToCurrent = resizeAiLevelsToTarget;

export function normalizeAiLevels(arr) {
  const base = new Array(PILLAR_COUNT).fill(0);
  if (!Array.isArray(arr)) {
    return base;
  }
  for (let i = 0; i < PILLAR_COUNT; i++) {
    base[i] = isAiPillarIndex(i) ? clampLevel(arr[i] ?? 0) : 0;
  }
  return base;
}

function fallbackAiLevels(levelsMapped) {
  const base = new Array(PILLAR_COUNT).fill(0);
  for (let i = 0; i < PILLAR_COUNT; i++) {
    if (isAiPillarIndex(i)) {
      base[i] = clampLevel(levelsMapped[i] ?? 2);
    }
  }
  return base;
}

export function normalizeSavedState(parsed) {
  if (!parsed || typeof parsed !== "object") {
    return null;
  }
  if (typeof parsed.title !== "string") {
    return null;
  }
  const schema = Number.isFinite(parsed.pillarSchema) ? parsed.pillarSchema : PILLAR_SCHEMA;
  const levelsMapped = resizeLevelsToTarget(parsed.levels, schema);
  if (!levelsMapped) {
    return null;
  }
  const aiLevels = resizeAiLevelsToTarget(parsed.aiLevels, schema) ?? fallbackAiLevels(levelsMapped);
  return {
    title: parsed.title,
    levels: levelsMapped,
    aiLevels,
    pillarSchema: PILLAR_SCHEMA,
    trackVariant: normalizeTrackVariant(parsed.trackVariant),
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
  const inner = normalizeSavedState(p);
  if (!inner) {
    return null;
  }
  return {
    id: p.id,
    title: inner.title,
    levels: inner.levels,
    aiLevels: inner.aiLevels,
    pillarSchema: inner.pillarSchema,
    trackVariant: inner.trackVariant,
    savedAt: Number.isFinite(p.savedAt) ? p.savedAt : 0,
  };
}

export function getDefaultChartState() {
  return {
    title: DEFAULT_STATE.title,
    levels: [...DEFAULT_STATE.levels],
    aiLevels: [...DEFAULT_STATE.aiLevels],
    pillarSchema: PILLAR_SCHEMA,
    trackVariant: "fe",
  };
}
