const urlParams = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");

/** `?score=1` — show Scores in chart settings (checked by default) and footer averages. */
export const SCORES_VISIBLE_FROM_URL = urlParams.get("score") === "1";

export const STORAGE_KEY = "fe-growth-framework:v1";
export const PROFILES_STORAGE_KEY = "fe-growth-framework:profiles:v1";
export const LEVEL_STEP = 0.5;
export const HUMAN_STRENGTH_TOP_K = 3;
export const DEFAULT_PILLAR_LEVEL = 3;

/** Master pillar catalog (id → label). Add/remove pillars here; wire into tracks below. */
export const PILLARS = {
  coding: { label: "🤲 Coding (Hands)" },
  domainLogic: { label: "👃 Domain Logic (Nose)" },
  architecture: { label: "🧠 Architecture (Brain)" },
  ai: { label: "🤖 AI Proficiency (Machine)" },
  uiUx: { label: "👀 UI/UX (Eyes)" },
  productSense: { label: "💡 Product Sense (Gut)" },
  process: { label: "🦴 Process (Spine)" },
  communication: { label: "🗣️ Communication (Voice)" },
  ownership: { label: "✨ Ownership (Soul)" },
};

export const TRACK_VARIANTS = ["fe", "be"];

export const TRACK_VARIANT_UI = {
  fe: {
    shortLabel: "FE",
    label: "Frontend",
    pillClass: "bg-track-fe text-track-fe-foreground",
    toggleActiveClass: "bg-track-fe",
  },
  be: {
    shortLabel: "BE",
    label: "Backend",
    pillClass: "bg-track-be text-track-be-foreground",
    toggleActiveClass: "bg-track-be",
  },
};

/**
 * Per-track chart order and form clusters (ids reference {@link PILLARS}).
 * To drop a pillar from a track: remove its id from `pillarOrder` and cluster lists.
 */
export const TRACKS = {
  fe: {
    pillarOrder: ["coding", "architecture", "ai", "process", "ownership", "communication", "productSense", "uiUx", "domainLogic"],
    pillarGroups: [
      { id: "technical", pillars: ["coding", "domainLogic", "architecture", "ai"] },
      { id: "product", pillars: ["uiUx", "productSense"] },
      { id: "operational", pillars: ["process", "communication", "ownership"] },
    ],
  },
  be: {
    pillarOrder: ["coding", "architecture", "ai", "process", "ownership", "communication", "productSense", "domainLogic"],
    pillarGroups: [
      { id: "technical", pillars: ["coding", "domainLogic", "architecture", "ai"] },
      { id: "product", pillars: ["productSense"] },
      { id: "operational", pillars: ["process", "communication", "ownership"] },
    ],
  },
};

/** Pillar ids persisted in profiles (union of all track orders; missing keys default on load). */
export const CANONICAL_PILLAR_IDS = [...new Set(TRACK_VARIANTS.flatMap((track) => TRACKS[track].pillarOrder))];

/** Profiles/drafts without `trackVariant` are treated as front-end (FE). */
export function normalizeTrackVariant(value) {
  return value === "be" ? "be" : "fe";
}

export function getTrackConfig(trackVariant = "fe") {
  return TRACKS[normalizeTrackVariant(trackVariant)];
}

export function getPillarOrder(trackVariant = "fe") {
  return getTrackConfig(trackVariant).pillarOrder;
}

/** Default-track chart order — used where track is not yet available. */
export const PILLAR_ORDER = getPillarOrder("fe");

export const PILLAR_COUNT = PILLAR_ORDER.length;

export function getPillarGroupOrder(trackVariant = "fe") {
  return getTrackConfig(trackVariant).pillarGroups;
}

export function getPillarLabel(pillarId) {
  return PILLARS[pillarId]?.label ?? "";
}

/** Chart axis labels omit the organ name in parentheses (e.g. "🤲 Coding" not "🤲 Coding (Hands)"). */
function getChartPillarLabel(pillarId) {
  return getPillarLabel(pillarId).replace(/\s*\([^)]*\)\s*$/, "");
}

export function getChartLabels(trackVariant = "fe") {
  return getPillarOrder(trackVariant).map((id) => getChartPillarLabel(id));
}

/** Longest label on the active track — reserved on the last axis so radar padding stays stable. */
function getChartLayoutReservedLabel(trackVariant = "fe") {
  return getPillarOrder(trackVariant).reduce((longest, id) => {
    const label = getChartPillarLabel(id);
    return label.length > longest.length ? label : longest;
  }, "");
}

export function getChartLayoutLabels(trackVariant = "fe") {
  const order = getPillarOrder(trackVariant);
  const reserved = getChartLayoutReservedLabel(trackVariant);
  const lastId = order.at(-1);
  return order.map((id) => (id === lastId ? reserved : getChartPillarLabel(id)));
}

export const SENIORITY_LEVEL_COUNT = 5;

export function getSiteCopy(trackVariant = "fe") {
  const pillarCount = getPillarOrder(trackVariant).length;
  const pointCount = pillarCount * SENIORITY_LEVEL_COUNT;
  const tagline = "A spider chart to measure software engineering mastery, identify core interests, and guide career paths.";
  const detail = `Supported by a ${pointCount}-point competency matrix across ${SENIORITY_LEVEL_COUNT} seniority levels.`;
  const byline = "— Jasper Loo Zhu Hang";
  return {
    title: `The ${pillarCount}-Pillar Engineer Growth Framework`,
    tagline,
    detail,
    byline,
    shortName: `${pillarCount}-Pillar Growth`,
    metaDescription: `${tagline} ${detail} Jasper Loo Zhu Hang.`,
  };
}

export const CLUSTERS = {
  technical: { label: "Technical", color: "#cdbdd8" },
  product: { label: "Product", color: "#f5b39d" },
  operational: { label: "Operational", color: "#bddbb5" },
};

function buildPillarRef(pillarId, trackVariant) {
  const order = getPillarOrder(trackVariant);
  return {
    id: pillarId,
    index: order.indexOf(pillarId),
    label: getPillarLabel(pillarId),
  };
}

export function getPillarGroups(trackVariant = "fe") {
  const track = normalizeTrackVariant(trackVariant);
  return getPillarGroupOrder(track).map(({ id, pillars }) => ({
    id,
    title: CLUSTERS[id].label,
    pillars: pillars.map((pillarId) => buildPillarRef(pillarId, track)),
  }));
}

export function getPillarIdByIndex(index, trackVariant = "fe") {
  return getPillarOrder(trackVariant)[index] ?? null;
}

export const FE_UI = {
  page: { maxWidthPx: 650, minWidthPx: 350 },
  chartFrame: {
    marginTopMinPx: -60,
    marginTopMaxPx: -90,
    marginBottomMinPx: -60,
    marginBottomMaxPx: -90,
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
};

export const CAREER_LEVEL_BY_AVG_BAND = [
  { code: "L1", phase: "Adherence / Learning", role: "Junior (Early)" },
  { code: "L2", phase: "Practitioner / Autonomy", role: "Junior (Late)" },
  { code: "L3", phase: "Proficient / Complexity", role: "Mid-Level" },
  { code: "L4", phase: "Influential", role: "Senior" },
  { code: "L5", phase: "Impact / Strategic", role: "Lead" },
];
