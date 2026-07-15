import { FE_UI, getChartLayoutLabels, getEmojiChartLabels, getPlainChartLayoutLabels } from "@/constants";

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
  // Thinner outline + smaller points than the tool chart: the theory radars render small (~180px),
  // where FE_UI's 2px dark stroke reads as a heavy black border joining the dots.
  dataset: {
    ...FE_UI.dataset,
    lineWidth: 1,
    pointRadius: 1.5,
  },
};

export function resolveChartUi(chart) {
  return chart?.options?.plugins?.competencyChart?.purpose === "theory" ? THEORY_CHART_UI : FE_UI;
}

export function isTheoryChart(chart) {
  return chart?.options?.plugins?.competencyChart?.purpose === "theory";
}

/** The theory tab's large empty hero radar (vs. the small per-track career-track charts). */
export function isHeroChart(chart) {
  return chart?.options?.plugins?.competencyChart?.heroLabelNudge === true;
}

/**
 * Emoji-only spokes vs. full text labels. `emojiMaxWidthPx`, when set, makes it width-responsive:
 * emoji only while the chart is at/below that width (the narrow columned view), text above it (the
 * full-width row view). Falls back to the plain `emojiOnlyLabels` boolean when no threshold is set.
 */
export function isEmojiMode(chart) {
  const cc = chart?.options?.plugins?.competencyChart;
  if (!cc) {
    return false;
  }
  if (cc.emojiMaxWidthPx != null) {
    return (chart.width || 0) <= cc.emojiMaxWidthPx;
  }
  return Boolean(cc.emojiOnlyLabels);
}

export function getChartLayoutLabelsForChart(chart) {
  const cc = chart?.options?.plugins?.competencyChart;
  if (isEmojiMode(chart)) {
    return getEmojiChartLabels();
  }
  return cc?.plainLabels ? getPlainChartLayoutLabels() : getChartLayoutLabels();
}
