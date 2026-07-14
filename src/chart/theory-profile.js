import { FE_UI, getChartLayoutLabels, getPlainChartLayoutLabels } from "@/constants";

/** Compact radar preset for theory tab static charts — smaller labels, tighter padding, no L ticks. */
export const THEORY_CHART_UI = {
  ...FE_UI,
  chart: {
    ...FE_UI.chart,
    pointLabelPx: 9,
    pointLabelPaddingRange: { minPx: 4, maxPx: 8 },
    radarLabelReserved: { minPx: 10, maxPx: 18 },
    layoutPaddingHorizontal: { minPx: 2, maxPx: 5 },
  },
  chartFonts: {
    ...FE_UI.chartFonts,
    pointLabelMinPx: 8,
    pointLabelMaxPx: 10,
    pointLabelRefWidthPx: 220,
  },
  chartFrame: {
    ...FE_UI.chartFrame,
    contentPadPx: 4,
    minChartHeightPx: 80,
  },
};

export function resolveChartUi(chart) {
  return chart?.options?.plugins?.competencyChart?.purpose === "theory" ? THEORY_CHART_UI : FE_UI;
}

export function isTheoryChart(chart) {
  return chart?.options?.plugins?.competencyChart?.purpose === "theory";
}

export function getChartLayoutLabelsForChart(chart) {
  const plain = chart?.options?.plugins?.competencyChart?.plainLabels;
  return plain ? getPlainChartLayoutLabels() : getChartLayoutLabels();
}
