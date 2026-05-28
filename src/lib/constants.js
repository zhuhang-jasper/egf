import { AI_AUGMENTATION_ENABLED, AI_PILLAR_ENABLED, SHOW_FOOTER_AVERAGES } from "@/lib/flags";

export const STORAGE_KEY = "fe-growth-framework:v1";
export const PROFILES_STORAGE_KEY = "fe-growth-framework:profiles:v1";
export const LEVEL_STEP = 0.5;
export const HUMAN_STRENGTH_TOP_K = 3;

/** Official site title, intro copy, and meta strings (HTML, PWA, app header). */
export const SITE_COPY = {
  title: "The 8-Pillar Engineer Growth Framework",
  tagline: "A spider chart to measure software engineering mastery.",
  detail: "Supported by a 40-point competency matrix across 5 seniority levels.",
  byline: "— Jasper Loo Zhu Hang",
};

/** Chart order when the dedicated AI pillar is included (`?ai=2`). */
export const PILLAR_ORDER_WITH_AI = ["coding", "architecture", "ai", "process", "ownership", "communication", "productSense", "uiUx"];

/** Default 7-pillar order (no dedicated AI pillar; used for default and `?ai=1`). */
export const PILLAR_ORDER_BASE = ["coding", "architecture", "process", "ownership", "communication", "productSense", "uiUx"];

export const FULL_PILLAR_COUNT = PILLAR_ORDER_WITH_AI.length;
export const BASE_PILLAR_COUNT = PILLAR_ORDER_BASE.length;

/** Index of the 🤖 AI pillar when {@link PILLAR_ORDER_WITH_AI} is active. */
export const AI_PILLAR_CHART_INDEX = PILLAR_ORDER_WITH_AI.indexOf("ai");

/** Canonical pillar definitions (names and metadata). Chart order is {@link PILLAR_ORDER}. */
export const PILLARS = {
  coding: { label: "🤲 Coding", hasAi: true },
  architecture: { label: "🧠 Architecture", hasAi: true },
  ai: { label: "🤖 AI" },
  process: { label: "🦴 Process", hasAi: true },
  ownership: { label: "✨ Ownership" },
  communication: { label: "🗣️ Communication" },
  productSense: { label: "💡 Product Sense" },
  uiUx: { label: "👀 UI/UX" },
};

export const PILLAR_ORDER = AI_PILLAR_ENABLED ? PILLAR_ORDER_WITH_AI : PILLAR_ORDER_BASE;

export const CHART_LABELS = PILLAR_ORDER.map((id) => PILLARS[id].label);

export const PILLAR_COUNT = PILLAR_ORDER.length;

function buildDefaultState() {
  const levels = new Array(PILLAR_COUNT).fill(3);
  const aiLevels = new Array(PILLAR_COUNT).fill(0);
  if (AI_AUGMENTATION_ENABLED) {
    PILLAR_ORDER.forEach((id, index) => {
      if (PILLARS[id].hasAi) {
        aiLevels[index] = 2;
      }
    });
  }
  return {
    title: "Engineer Growth Framework",
    levels,
    aiLevels,
  };
}

export const DEFAULT_STATE = buildDefaultState();

/** Bumped when pillar order changes; used to migrate saved profiles. */
export const PILLAR_SCHEMA = 2;

export const CLUSTERS = {
  technical: { label: "Technical", color: "#cdbdd8" },
  product: { label: "Product", color: "#f5b39d" },
  behavioural: { label: "Behavioural", color: "#bddbb5" },
};

const PILLAR_GROUP_ORDER = [
  {
    id: "technical",
    pillars: AI_PILLAR_ENABLED ? ["coding", "architecture", "ai", "process"] : ["coding", "architecture", "process"],
  },
  { id: "product", pillars: ["uiUx", "productSense"] },
  { id: "behavioural", pillars: ["communication", "ownership"] },
];

function buildPillarRef(pillarId) {
  const meta = PILLARS[pillarId];
  return {
    id: pillarId,
    index: PILLAR_ORDER.indexOf(pillarId),
    label: meta.label,
    ...(meta.hasAi && AI_AUGMENTATION_ENABLED ? { hasAi: true } : {}),
  };
}

/** Form pillar definitions (index matches chart label order). */
export const PILLAR_GROUPS = PILLAR_GROUP_ORDER.map(({ id, pillars }) => ({
  id,
  title: CLUSTERS[id].label,
  pillars: pillars.map(buildPillarRef),
}));

export function getPillarIdByIndex(index) {
  return PILLAR_ORDER[index] ?? null;
}

export function getPillarLabelByIndex(index) {
  const id = getPillarIdByIndex(index);
  return id ? PILLARS[id].label : "";
}

export function getAiPillarIndices() {
  if (!AI_AUGMENTATION_ENABLED) {
    return [];
  }
  return PILLAR_ORDER.reduce((indices, id, index) => {
    if (PILLARS[id].hasAi) {
      indices.push(index);
    }
    return indices;
  }, []);
}

export function isAiPillarIndex(index) {
  return AI_AUGMENTATION_ENABLED && getAiPillarIndices().includes(index);
}

export const FE_UI = {
  page: { maxWidthPx: 650, minWidthPx: 350 },
  chartFrame: {
    marginTopMinPx: -30,
    marginTopMaxPx: -60,
    marginBottomMinPx: -40,
    marginBottomMaxPx: -80,
    minChartHeightPx: 120,
  },
  chart: {
    layoutPadding: { top: 0, right: 30, bottom: 0, left: 30 },
    radarCenterFix: true,
    radarLabelReservedPx: 62,
    pointLabelPadding: 5,
    pointLabelPx: 11,
    pointLabelScaleWithChart: true,
    pointLabelWeight: "bold",
    pointLabelColor: "#333",
    gridColor: "rgba(0, 0, 0, 0.15)",
    tickLabelColor: "rgba(0, 0, 0, 0.3)",
    centerPointLabels: false,
    tickInitialPx: 12,
    tickBackdropPad: { top: 2, bottom: 2, left: 3, right: 3 },
    tickBackdropColor: "rgba(255, 255, 255, 0.5)",
    exportImageCssScale: 8,
    exportImageCssScaleMax: 12,
    showFooterAverages: SHOW_FOOTER_AVERAGES,
    clusterBorderColor: "rgba(0, 0, 0, 0.22)",
    clusterBorderWidth: 1,
  },
  chartFonts: {
    tickMinPx: 8,
    tickWidthDivisor: 48,
    pointLabelMinPx: 9,
    pointLabelMaxPx: 18,
    pointLabelRefWidthPx: 380,
  },
  dataset: {
    fill: "rgba(56, 56, 56, 0.58)",
    stroke: "#3a3a3a",
    lineWidth: 2,
    pointRadius: 2,
    pointHoverRadius: 4,
    pointStyle: "circle",
    pointFill: "#404040",
    pointStroke: "#404040",
    pointBorderWidth: 0,
    pointHoverFill: "rgba(64, 64, 64, 0.95)",
    pointHoverStroke: "#404040",
    pointHoverBorderWidth: 0,
  },
  datasetAi: {
    label: "AI",
    fill: "rgba(99, 102, 241, 0.42)",
    stroke: "#4f46e5",
    lineWidth: 2,
    pointRadius: 2,
    pointHoverRadius: 4,
    pointStyle: "circle",
    pointFill: "#6366f1",
    pointStroke: "#4f46e5",
    pointBorderWidth: 0,
    pointHoverBackgroundColor: "rgba(99, 102, 241, 0.95)",
    pointHoverBorderColor: "#4338ca",
    pointHoverBorderWidth: 0,
  },
};

export const CAREER_LEVEL_BY_AVG_BAND = [
  { code: "L1", phase: "Adherence / Learning", role: "Junior (Early)" },
  { code: "L2", phase: "Practitioner / Autonomy", role: "Junior (Late)" },
  { code: "L3", phase: "Proficient / Complexity", role: "Mid-Level" },
  { code: "L4", phase: "Influential", role: "Senior" },
  { code: "L5", phase: "Impact / Strategic", role: "Lead" },
];
