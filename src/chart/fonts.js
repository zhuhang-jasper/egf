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
 * The chrome label size BEFORE rounding — the continuous curve that getChartPointLabelSizePx samples.
 *
 * Split out because the two consumers want different things from the same ramp. The track badge and cluster
 * legend want whole pixels: they are small text where a fractional size is a blurrier glyph for no gain. The
 * chart title wants the curve itself, so it can scale smoothly with the chart instead of stepping 1.4px at a
 * time as the rounded label ticks over — at title sizes the sub-pixel value is what keeps it in proportion at
 * every width rather than only at the four widths the rounding lands on.
 *
 * The clamps stay here rather than at the call sites, so both forms share the same floor and ceiling and the
 * mobile plateau (the `pointLabelMinPx` floor) is identical for everything that reads this.
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

/** md track badge outer height — matches {@link TrackBadge} size="md" padding + leading-none text. */
export function getTrackBadgeMdHeightPx(chartWidthPx) {
  const labelPx = getChartSecondaryLabelSizePx(chartWidthPx);
  const padY = Math.round(labelPx * 0.4);
  return labelPx + padY * 2;
}

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
 * NOT ROUNDED, deliberately — this returns a fractional px size and both the tool's chart title and the
 * theory tab's framework title set it straight onto `font-size`.
 *
 * It reads the EXACT label curve rather than the rounded label the badge and legend use. Going through the
 * rounded one made the title a step function of a step function: it held one size across a whole band of
 * widths and then jumped by a full `labelMultiplier` px when the label ticked over, which is visible as the
 * title snapping while the chart beside it resizes smoothly. Browsers lay out fractional font sizes fine and
 * the glyphs are hinted to the device pixel grid, so the only thing rounding bought here was that jump.
 */
export function getChartTitleSizePx(chartWidthPx) {
  // NO CLAMPS OF ITS OWN, and none can do anything — the bounds it would need are all inherited:
  //
  //   floor    `chartFonts.pointLabelMinPx` (12) clamps the label, so the title floors at 12 × 1.4 = 16.8.
  //   ceiling  `page.chartMaxWidthPx` (526) caps the CANVAS, so the label tops out at 15.23 and the title at
  //            ~21.3. The label's own `pointLabelMaxPx` (18) would allow 25.2, but no chart ever gets wide
  //            enough to reach it.
  //
  // This carried a `minPx: 14` and a `maxPx: 22`. Both were dead, and in the same way: each sat on the far
  // side of a bound that applies first, so no input could reach either. `maxPx` in particular looked live —
  // it is BELOW the label-clamp ceiling of 25.2 — but it sits ABOVE the 21.3 the canvas cap allows, which is
  // the only ceiling that ever runs. Setting it to 30 changed nothing at any width, which is the test.
  //
  // The size ceiling here is therefore the canvas width, not a font clamp. To change it, move
  // `page.chartMaxWidthPx` or `labelMultiplier` — adding a clamp back will not do it.
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
