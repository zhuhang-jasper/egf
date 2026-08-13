import { FE_UI, getChartLabels, getChartLayoutLabels, getEmojiChartLabels, getPlainChartLabels, getPlainChartLayoutLabels } from "@/constants";

/** Compact radar preset for theory tab static charts — smaller labels, tighter padding, no L ticks. */
export const THEORY_CHART_UI = {
  ...FE_UI,
  chart: {
    ...FE_UI.chart,
    /** Seeds the scale before the first syncFontsForChart pass; the ramp below is what actually holds. */
    pointLabelPx: 9,
    pointLabelPaddingRange: { minPx: 4, maxPx: 8 },
    radarLabelReserved: { minPx: 10, maxPx: 18 },
    layoutPaddingHorizontal: { minPx: 2, maxPx: 5 },
    /**
     * Axis-label ramp for the small career-track radars: the same fractional interpolation the tool chart
     * uses, over this preset's narrower band. It replaces a stepped scale that only produced 8, 9 or 10, so
     * dragging a desktop window popped every radar's labels a whole pixel at two thresholds and the measured
     * label span jumped with them.
     *
     * The width bounds are the band these charts occupy in the COLUMNED view, where the pop was visible.
     * Outside it the ramp clamps, keeping the full-width mobile charts at the flat 10px they already had.
     */
    pointLabelPxRange: { minPx: 8, maxPx: 10, minWidthPx: 172, maxWidthPx: 264 },
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
 * Emoji-only spokes vs. full text labels. A plain flag the caller owns, decided once from a media query (see
 * CareerTracks): a per-chart width threshold made charts in one layout cross at different viewports, and it
 * also kept the label set dependent on `chart.width` across the frame-fit's resize passes.
 */
export function isEmojiMode(chart) {
  return Boolean(chart?.options?.plugins?.competencyChart?.emojiOnlyLabels);
}

/**
 * `plainLabels` means two unrelated things, and only one of them may affect measurement:
 *
 * - On the TOOL chart it is the user's hide-emoji toggle. The emoji layout is that chart's baseline, so
 *   the frame stays fit to the labels WITH emoji and hiding them paints shorter text into the height
 *   already reserved. Measuring the plain set re-converged to a smaller span, which GREW the radar — a
 *   display toggle moving the layout, which every other toggle in that panel avoids.
 * - On THEORY charts it is a permanent preset (`plainLabels: isTheory`): those charts are text-only by
 *   design and never paint emoji, so they must keep measuring the plain labels. Reserving emoji width
 *   there would pad every spoke for glyphs that never render and shrink the hero radar out of sync with
 *   the tool chart.
 *
 * `emojiOnlyLabels` is a third axis (icon-only spokes on the small career-track charts) and wins over both.
 */
export function getChartLayoutLabelsForChart(chart) {
  const cc = chart?.options?.plugins?.competencyChart;
  if (isEmojiMode(chart)) {
    return getEmojiChartLabels();
  }
  if (cc?.plainLabels && isTheoryChart(chart)) {
    return getPlainChartLayoutLabels();
  }
  return getChartLayoutLabels();
}

/**
 * The labels actually painted on the spokes — the real pillar names, with no layout substitution.
 * Counterpart to getChartLayoutLabelsForChart: use that one to measure, this one to display.
 */
export function getDisplayLabelsForChart(chart) {
  const cc = chart?.options?.plugins?.competencyChart;
  if (isEmojiMode(chart)) {
    return getEmojiChartLabels();
  }
  return cc?.plainLabels ? getPlainChartLabels() : getChartLabels();
}
