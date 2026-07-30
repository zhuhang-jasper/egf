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
     * Axis-label size ramp for the small career-track radars — the same fractional interpolation the
     * tool chart and hero use (see FE_UI.chart.pointLabelPxRange), just over this preset's much
     * narrower size band.
     *
     * REPLACES A STEPPED SCALE. These charts used to size labels as
     * `clamp(round(9 × width / 220), 8, 10)`, which only ever produced 8, 9 or 10 — so dragging a
     * desktop window popped every career radar's labels a whole pixel at two thresholds, and the
     * measured label span (hence the frame fit) jumped with them.
     *
     * The width bounds are the band these charts actually occupy in the COLUMNED view, which is
     * where the pop was visible — the 3-up career cards run 176px (at the `sm` breakpoint) to 263px
     * (at the 900px panel cap), and the foundational phase's 3-up cells run 171px to 257px inside
     * their extra `px-2`. Below/above that the ramp clamps, which is what keeps the full-width
     * mobile charts (~300–590px) at the flat 10px they already rendered at.
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
 * Emoji-only spokes (icons, no text) vs. full text labels.
 *
 * A plain flag the caller owns. It used to have a width-responsive mode as well — `emojiMaxWidthPx`,
 * compared against the chart's own canvas width — which the career-track radars used, but charts that
 * belong to one layout are not all the same width, so they crossed the threshold at different
 * viewports. That decision is now made once from a media query (see CareerTracks), which also keeps
 * the label set independent of `chart.width` and therefore stable across the frame-fit's resize passes.
 */
export function isEmojiMode(chart) {
  return Boolean(chart?.options?.plugins?.competencyChart?.emojiOnlyLabels);
}

export function getChartLayoutLabelsForChart(chart) {
  const cc = chart?.options?.plugins?.competencyChart;
  if (isEmojiMode(chart)) {
    return getEmojiChartLabels();
  }
  return cc?.plainLabels ? getPlainChartLayoutLabels() : getChartLayoutLabels();
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
