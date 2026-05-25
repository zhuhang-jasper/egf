import { SHOW_FOOTER_AVERAGES } from "@/lib/flags";

export const STORAGE_KEY = "fe-growth-framework:v1";
export const PROFILES_STORAGE_KEY = "fe-growth-framework:profiles:v1";
export const LEVEL_STEP = 0.5;
export const HUMAN_STRENGTH_TOP_K = 3;

export const DEFAULT_STATE = {
  title: "Engineer Growth Framework",
  levels: [3, 3, 3, 3, 3, 3, 3],
  aiLevels: [2, 2, 2, 0, 0, 0, 0],
};

export const CHART_LABELS = ["🤲 Coding", "🧠 Architecture", "🦴 Process", "✨ Ownership", "🗣️ Communication", "💡 Product Sense", "👀 UI/UX"];

export const CLUSTERS = {
  technical: { label: "Technical", color: "#cdbdd8" },
  product: { label: "Product", color: "#f5b39d" },
  behavioural: { label: "Behavioural", color: "#bddbb5" },
};

/** Form pillar definitions (index matches chart label order). */
export const PILLAR_GROUPS = [
  {
    id: "technical",
    title: "Technical",
    pillars: [
      { index: 0, label: "🤲 Coding", hasAi: true },
      { index: 1, label: "🧠 Architecture", hasAi: true },
      { index: 2, label: "🦴 Process", hasAi: true },
    ],
  },
  {
    id: "product",
    title: "Product",
    pillars: [
      { index: 6, label: "👀 UI/UX" },
      { index: 5, label: "💡 Product Sense" },
    ],
  },
  {
    id: "behavioural",
    title: "Behavioural",
    pillars: [
      { index: 4, label: "🗣️ Communication" },
      { index: 3, label: "✨ Ownership" },
    ],
  },
];

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
    pointLabelPx: 12,
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
