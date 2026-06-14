import { FE_UI, getChartLayoutLabels, getPlainChartLayoutLabels } from "@/lib/constants";

/** Compact radar preset for /about static charts — smaller labels, tighter padding, no L ticks. */
export const ABOUT_CHART_UI = {
  ...FE_UI,
  chart: {
    ...FE_UI.chart,
    pointLabelPx: 9,
    pointLabelPadding: 2,
    pointLabelPaddingRange: { minPx: 2, maxPx: 4 },
    radarLabelReserved: { minPx: 6, maxPx: 12 },
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
  return chart?.options?.plugins?.competencyChart?.purpose === "about" ? ABOUT_CHART_UI : FE_UI;
}

export function isAboutChart(chart) {
  return chart?.options?.plugins?.competencyChart?.purpose === "about";
}

export function getChartLayoutLabelsForChart(chart, trackVariant) {
  const plain = chart?.options?.plugins?.competencyChart?.plainLabels;
  return plain ? getPlainChartLayoutLabels(trackVariant) : getChartLayoutLabels(trackVariant);
}
