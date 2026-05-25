import { DEFAULT_STATE, LEVEL_STEP } from "@/lib/constants";

export function clampLevel(v) {
  const step = LEVEL_STEP;
  const inv = 1 / step;
  let n;
  if (typeof v === "number" && Number.isFinite(v)) {
    n = v;
  } else {
    let raw = String(v).trim().replace(",", ".");
    if (raw === "" || raw === "-") {return 0;}
    if (/^\.(?=\d)/.test(raw)) {raw = `0${raw}`;}
    n = parseFloat(raw);
  }
  if (!Number.isFinite(n)) {return 0;}
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

export function normalizeAiLevels(arr) {
  const base = [0, 0, 0, 0, 0, 0, 0];
  if (!Array.isArray(arr)) {return base;}
  for (let i = 0; i < 7; i++) {base[i] = clampLevel(arr[i] ?? 0);}
  for (let j = 3; j < 7; j++) {base[j] = 0;}
  return base;
}

export function normalizeSavedState(parsed) {
  if (!parsed || typeof parsed !== "object") {return null;}
  if (typeof parsed.title !== "string") {return null;}
  const {levels} = parsed;
  if (!Array.isArray(levels) || levels.length !== 7) {return null;}
  const levelsMapped = levels.map((v) => clampLevel(v));
  let aiLevels;
  if (Array.isArray(parsed.aiLevels) && parsed.aiLevels.length === 7) {
    aiLevels = normalizeAiLevels(parsed.aiLevels);
  } else {
    aiLevels = normalizeAiLevels([levelsMapped[0], levelsMapped[1], levelsMapped[2], 0, 0, 0, 0]);
  }
  return { title: parsed.title, levels: levelsMapped, aiLevels };
}

export function newSavedProfileId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `p-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function normalizeStoredProfile(p) {
  if (!p || typeof p !== "object" || typeof p.id !== "string" || !p.id) {return null;}
  const inner = normalizeSavedState(p);
  if (!inner) {return null;}
  return {
    id: p.id,
    title: inner.title,
    levels: inner.levels,
    aiLevels: inner.aiLevels,
    savedAt: Number.isFinite(p.savedAt) ? p.savedAt : 0,
  };
}

export function getDefaultChartState() {
  return {
    title: DEFAULT_STATE.title,
    levels: [...DEFAULT_STATE.levels],
    aiLevels: [...DEFAULT_STATE.aiLevels],
  };
}
