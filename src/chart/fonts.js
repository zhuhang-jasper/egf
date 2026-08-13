import { FE_UI } from "@/constants";

/** 0 at {@link FE_UI.page.minWidthPx}, 1 at maxWidthPx. */
export function getChartWidthUnit(chartWidthPx) {
  const { minWidthPx, maxWidthPx } = FE_UI.page;
  if (maxWidthPx <= minWidthPx) {
    return 1;
  }
  return Math.max(0, Math.min(1, (chartWidthPx - minWidthPx) / (maxWidthPx - minWidthPx)));
}

/**
 * The chrome label size BEFORE rounding: the continuous curve getChartPointLabelSizePx samples.
 *
 * Split out because the consumers want different things from one ramp. The badge and legend want whole
 * pixels, being small text where a fractional size is just a blurrier glyph; the title wants the curve, so it
 * scales smoothly rather than stepping as the rounded label ticks over. The clamps stay here so both forms
 * share one floor and ceiling.
 */
export function getChartPointLabelSizeExactPx(chartWidthPx) {
  const cf = FE_UI.chartFonts;
  const ch = FE_UI.chart;
  if (!ch.pointLabelScaleWithChart) {
    return ch.pointLabelPx;
  }
  const ref = cf.pointLabelRefWidthPx || 380;
  let labelSize = Math.max(cf.pointLabelMinPx, (ch.pointLabelPx * chartWidthPx) / ref);
  if (cf.pointLabelMaxPx != null) {
    labelSize = Math.min(cf.pointLabelMaxPx, labelSize);
  }
  return labelSize;
}

export function getChartPointLabelSizePx(chartWidthPx) {
  return Math.round(getChartPointLabelSizeExactPx(chartWidthPx));
}

/** Track badge + cluster legend — scales with chart width, slightly below axis labels. */
export function getChartSecondaryLabelSizePx(chartWidthPx) {
  const min = FE_UI.chart.secondaryLabelMinPx ?? 1;
  return Math.max(min, Math.round(getChartPointLabelSizePx(chartWidthPx) * FE_UI.chart.secondaryLabelMultiplier));
}

/* NO BADGE-HEIGHT HELPER LIVES HERE ANY MORE, and adding one back is a step backwards.
   There were two — `getTrackBadgeMdHeightPx` (label + 2 * 0.4 pad) and `getTrackBadgeTitleRowHeightPx`
   (`round(getChartTitleSizePx * 0.86)`). Both computed a px height for the md pill, which the component then took
   as `matchHeightPx` and the export clone wrote as an inline style.
   THE ROUNDING IS WHY THEY ARE GONE. getChartTitleSizePx below is deliberately fractional so the type scales
   smoothly, so rounding any ratio of it steps between two integers as the chart resizes — the pill's height
   flipped back and forth and its label re-centred each time, visible as jitter while dragging the window. No
   multiplier avoids that; rounding a continuous value is discontinuous by nature.
   The pill now derives its height from `em` padding like every other badge, so the number is not needed by the
   component, by the title row's `min-height` (plain `1.25em`, which the badge term never beat anyway), or by the
   export clone (setting the font rescales the `em` ratios). See components/TrackBadge.jsx. */

export function getPointLabelPaddingPx(chartWidthPx) {
  const u = getChartWidthUnit(chartWidthPx);
  const { minPx, maxPx } = FE_UI.chart.pointLabelPaddingRange ?? { minPx: 5, maxPx: 12 };
  return Math.round(minPx + u * (maxPx - minPx));
}

export function getChartLayoutPadding(chartWidthPx) {
  const u = getChartWidthUnit(chartWidthPx);
  const { minPx, maxPx } = FE_UI.chart.layoutPaddingHorizontal;
  const horizontal = Math.round(minPx + u * (maxPx - minPx));
  return { top: 0, right: horizontal, bottom: 0, left: horizontal };
}

export function getRadarLabelReservedPx(chartWidthPx) {
  const u = getChartWidthUnit(chartWidthPx);
  const { minPx, maxPx } = FE_UI.chart.radarLabelReserved;
  return Math.round(minPx + u * (maxPx - minPx));
}

export function getClusterLegendSwatchPx(chartWidthPx) {
  return Math.round(getChartSecondaryLabelSizePx(chartWidthPx) * FE_UI.chart.legendSwatchLabelMultiplier);
}

/**
 * NOT ROUNDED, deliberately: this returns a fractional px size that both the tool's chart title and the
 * theory tab's framework title set straight onto `font-size`.
 *
 * It reads the EXACT label curve rather than the rounded label the badge and legend take. Going through the
 * rounded one made the title a step function of a step function, snapping by a full multiplier while the
 * chart beside it resized smoothly.
 */
export function getChartTitleSizePx(chartWidthPx) {
  // No clamps of its own, and none would do anything: both bounds are inherited from the label clamp and the
  // canvas cap. See docs/DECISIONS.md#chart-type-scale.
  const { labelMultiplier } = FE_UI.chart.title;
  return getChartPointLabelSizeExactPx(chartWidthPx) * labelMultiplier;
}

/** Initial frame height before label bounds are measured from the live chart. */
export function getChartFrameEstimatedHeightPx(chartWidthPx) {
  const ratio = FE_UI.chartFrame.heightWidthRatio;
  const minH = FE_UI.chartFrame.minChartHeightPx ?? 120;
  return Math.round(Math.max(minH, chartWidthPx * ratio));
}

export function applyChartFrameLayout(frameEl, chartWidthPx, contentHeightPx = null) {
  const minH = FE_UI.chartFrame.minChartHeightPx ?? 120;
  const innerH = Math.round(Math.max(minH, contentHeightPx ?? getChartFrameEstimatedHeightPx(chartWidthPx)));

  frameEl.style.margin = "0 auto";
  frameEl.style.aspectRatio = "unset";
  frameEl.style.height = `${innerH}px`;
}
