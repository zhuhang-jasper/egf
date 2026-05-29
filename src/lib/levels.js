import {
  AI_PILLAR_CHART_INDEX,
  BASE_PILLAR_COUNT,
  CANONICAL_AI_AUGMENT_INDICES,
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
  return [
    clampLevel(aiLevels[0]),
    clampLevel(aiLevels[1]),
    0,
    clampLevel(aiLevels[2]),
    clampLevel(aiLevels[3]),
    clampLevel(aiLevels[4]),
    clampLevel(aiLevels[5]),
    clampLevel(aiLevels[6]),
  ];
}

function removeAiPillarFromAiLevels(aiLevels) {
  if (aiLevels.length !== FULL_PILLAR_COUNT) {
    return null;
  }
  return [
    clampLevel(aiLevels[0]),
    clampLevel(aiLevels[1]),
    clampLevel(aiLevels[3]),
    clampLevel(aiLevels[4]),
    clampLevel(aiLevels[5]),
    clampLevel(aiLevels[6]),
    clampLevel(aiLevels[7]),
  ];
}

/** Map a view pillar index to the canonical 8-pillar storage index. */
export function viewIndexToCanonicalIndex(viewIndex) {
  if (PILLAR_COUNT === FULL_PILLAR_COUNT) {
    return viewIndex;
  }
  return viewIndex < AI_PILLAR_CHART_INDEX ? viewIndex : viewIndex + 1;
}

function resizeLevelsToCanonical(levels, schema = 0) {
  if (!Array.isArray(levels)) {
    return null;
  }

  let mapped = levels.map((v) => clampLevel(v));

  if (mapped.length === FULL_PILLAR_COUNT && schema === 1) {
    mapped = migrateAiBeforeProcessLevels(mapped);
  }

  if (mapped.length === FULL_PILLAR_COUNT) {
    return mapped;
  }

  if (mapped.length === BASE_PILLAR_COUNT) {
    return insertAiPillarIntoLevels(mapped);
  }

  return null;
}

function resizeAiLevelsToCanonical(aiLevels, schema = 0) {
  if (!Array.isArray(aiLevels)) {
    return null;
  }

  let mapped = aiLevels.map((v) => clampLevel(v));

  if (mapped.length === FULL_PILLAR_COUNT && schema === 1) {
    mapped = migrateAiBeforeProcessAiLevels(mapped);
  }

  if (mapped.length === FULL_PILLAR_COUNT) {
    return normalizeCanonicalAiLevels(mapped);
  }

  if (mapped.length === BASE_PILLAR_COUNT) {
    const inserted = insertAiPillarIntoAiLevels(mapped);
    return inserted ? normalizeCanonicalAiLevels(inserted) : null;
  }

  return null;
}

function resizeLevelsToTarget(levels, schema = 0) {
  const canonical = resizeLevelsToCanonical(levels, schema);
  if (!canonical) {
    return null;
  }
  if (PILLAR_COUNT === FULL_PILLAR_COUNT) {
    return canonical;
  }
  return removeAiPillarFromLevels(canonical);
}

function resizeAiLevelsToTarget(aiLevels, schema = 0) {
  const canonical = resizeAiLevelsToCanonical(aiLevels, schema);
  if (!canonical) {
    return null;
  }
  if (PILLAR_COUNT === FULL_PILLAR_COUNT) {
    return normalizeAiLevels(canonical);
  }
  return normalizeAiLevels(removeAiPillarFromAiLevels(canonical));
}

function normalizeCanonicalAiLevels(arr) {
  return Array.from({ length: FULL_PILLAR_COUNT }, (_, i) => clampLevel(arr[i] ?? 0));
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

function fallbackCanonicalAiLevels(levelsCanonical) {
  const base = new Array(FULL_PILLAR_COUNT).fill(0);
  for (const i of CANONICAL_AI_AUGMENT_INDICES) {
    base[i] = clampLevel(levelsCanonical[i] ?? 2);
  }
  return base;
}

/** Parse stored JSON into canonical 8-pillar arrays (mode-independent). */
export function parseToCanonicalState(parsed) {
  if (!parsed || typeof parsed !== "object") {
    return null;
  }
  if (typeof parsed.title !== "string") {
    return null;
  }
  const schema = Number.isFinite(parsed.pillarSchema) ? parsed.pillarSchema : PILLAR_SCHEMA;
  const levels = resizeLevelsToCanonical(parsed.levels, schema);
  if (!levels) {
    return null;
  }
  const aiLevels = resizeAiLevelsToCanonical(parsed.aiLevels, schema) ?? fallbackCanonicalAiLevels(levels);
  return {
    title: parsed.title,
    levels,
    aiLevels,
    pillarSchema: PILLAR_SCHEMA,
    trackVariant: normalizeTrackVariant(parsed.trackVariant),
  };
}

/** Project canonical storage into arrays sized for the current URL mode. */
export function toViewState(canonical) {
  const levels =
    PILLAR_COUNT === FULL_PILLAR_COUNT ? canonical.levels.map(clampLevel) : removeAiPillarFromLevels(canonical.levels);
  if (!levels) {
    return null;
  }
  const aiSource =
    PILLAR_COUNT === FULL_PILLAR_COUNT ? canonical.aiLevels : removeAiPillarFromAiLevels(canonical.aiLevels);
  const aiLevels = normalizeAiLevels(aiSource ?? []);
  return { levels, aiLevels };
}

function isCanonicalAiAugmentIndex(index) {
  return CANONICAL_AI_AUGMENT_INDICES.includes(index);
}

/** Merge live view edits into canonical storage without dropping hidden pillar or augmentation slots. */
export function mergeViewIntoCanonical({ levels, aiLevels, canonicalLevels, canonicalAiLevels }) {
  const nextLevels = [...(canonicalLevels ?? new Array(FULL_PILLAR_COUNT).fill(0))];
  const nextAi = [...(canonicalAiLevels ?? new Array(FULL_PILLAR_COUNT).fill(0))];

  if (PILLAR_COUNT === FULL_PILLAR_COUNT) {
    for (let i = 0; i < FULL_PILLAR_COUNT; i++) {
      nextLevels[i] = clampLevel(levels[i]);
    }
    for (let i = 0; i < FULL_PILLAR_COUNT; i++) {
      if (isCanonicalAiAugmentIndex(i)) {
        continue;
      }
      nextAi[i] = clampLevel(aiLevels[i]);
    }
    return { levels: nextLevels, aiLevels: nextAi };
  }

  nextLevels[0] = clampLevel(levels[0]);
  nextLevels[1] = clampLevel(levels[1]);
  nextLevels[3] = clampLevel(levels[2]);
  nextLevels[4] = clampLevel(levels[3]);
  nextLevels[5] = clampLevel(levels[4]);
  nextLevels[6] = clampLevel(levels[5]);
  nextLevels[7] = clampLevel(levels[6]);

  nextAi[0] = clampLevel(aiLevels[0]);
  nextAi[1] = clampLevel(aiLevels[1]);
  nextAi[3] = clampLevel(aiLevels[2]);
  for (let i = 0; i < FULL_PILLAR_COUNT; i++) {
    if (i === AI_PILLAR_CHART_INDEX || isCanonicalAiAugmentIndex(i)) {
      continue;
    }
    nextAi[i] = 0;
  }

  return { levels: nextLevels, aiLevels: nextAi };
}

export function normalizeSavedState(parsed) {
  const canonical = parseToCanonicalState(parsed);
  if (!canonical) {
    return null;
  }
  const view = toViewState(canonical);
  if (!view) {
    return null;
  }
  return {
    title: canonical.title,
    levels: view.levels,
    aiLevels: view.aiLevels,
    canonicalLevels: canonical.levels,
    canonicalAiLevels: canonical.aiLevels,
    pillarSchema: canonical.pillarSchema,
    trackVariant: canonical.trackVariant,
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
    levels: canonical.levels,
    aiLevels: canonical.aiLevels,
    pillarSchema: canonical.pillarSchema,
    trackVariant: canonical.trackVariant,
    savedAt: Number.isFinite(p.savedAt) ? p.savedAt : 0,
  };
}

export function getDefaultChartState() {
  const levels = new Array(FULL_PILLAR_COUNT).fill(3);
  const aiLevels = new Array(FULL_PILLAR_COUNT).fill(0);
  for (const i of CANONICAL_AI_AUGMENT_INDICES) {
    aiLevels[i] = 2;
  }
  const canonical = {
    title: DEFAULT_STATE.title,
    levels,
    aiLevels,
    pillarSchema: PILLAR_SCHEMA,
    trackVariant: "fe",
  };
  const view = toViewState(canonical);
  return {
    title: canonical.title,
    levels: view?.levels ?? [...DEFAULT_STATE.levels],
    aiLevels: view?.aiLevels ?? [...DEFAULT_STATE.aiLevels],
    canonicalLevels: canonical.levels,
    canonicalAiLevels: canonical.aiLevels,
    pillarSchema: PILLAR_SCHEMA,
    trackVariant: "fe",
  };
}
