import { FE_UI } from "@/lib/constants";

/** 0 at {@link FE_UI.page.minWidthPx}, 1 at maxWidthPx. */
export function getChartWidthUnit(chartWidthPx) {
  const { minWidthPx, maxWidthPx } = FE_UI.page;
  if (maxWidthPx <= minWidthPx) {
    return 1;
  }
  return Math.max(0, Math.min(1, (chartWidthPx - minWidthPx) / (maxWidthPx - minWidthPx)));
}

export function getChartPointLabelSizePx(chartWidthPx) {
  const cf = FE_UI.chartFonts;
  const ch = FE_UI.chart;
  let labelSize = ch.pointLabelPx;
  if (ch.pointLabelScaleWithChart) {
    const ref = cf.pointLabelRefWidthPx || 380;
    labelSize = Math.round((ch.pointLabelPx * chartWidthPx) / ref);
    labelSize = Math.max(cf.pointLabelMinPx, labelSize);
    if (cf.pointLabelMaxPx != null) {
      labelSize = Math.min(cf.pointLabelMaxPx, labelSize);
    }
  }
  return labelSize;
}

/** Track badge + cluster legend — scales with chart width, slightly below axis labels. */
export function getChartSecondaryLabelSizePx(chartWidthPx) {
  return Math.max(1, Math.round(getChartPointLabelSizePx(chartWidthPx) * FE_UI.chart.secondaryLabelMultiplier));
}

export function getChartLayoutPadding(chartWidthPx) {
  const u = getChartWidthUnit(chartWidthPx);
  const base = FE_UI.chart.layoutPadding;
  const { minPx, maxPx } = FE_UI.chart.layoutPaddingHorizontal;
  const horizontal = Math.round(minPx + u * (maxPx - minPx));
  return { top: base.top, right: horizontal, bottom: base.bottom, left: horizontal };
}

export function getRadarLabelReservedPx(chartWidthPx) {
  const u = getChartWidthUnit(chartWidthPx);
  const { minPx, maxPx } = FE_UI.chart.radarLabelReserved;
  return Math.round(minPx + u * (maxPx - minPx));
}

export function getClusterLegendSwatchPx(chartWidthPx) {
  return Math.round(getChartSecondaryLabelSizePx(chartWidthPx) * FE_UI.chart.legendSwatchLabelMultiplier);
}

export function getClusterLegendMarginTopPx(chartWidthPx) {
  const u = getChartWidthUnit(chartWidthPx);
  const { minPx, maxPx } = FE_UI.chart.legendMarginTop;
  return Math.round(minPx + u * (maxPx - minPx));
}

export function getChartTitleSizePx(chartWidthPx) {
  const labelPx = getChartPointLabelSizePx(chartWidthPx);
  const { labelMultiplier, minPx, maxPx } = FE_UI.chart.title;
  return Math.min(maxPx, Math.max(minPx, Math.round(labelPx * labelMultiplier)));
}

export function getTrackBadgeMarginBottomPx(chartWidthPx) {
  const u = getChartWidthUnit(chartWidthPx);
  const { minPx, maxPx } = FE_UI.chart.trackBadgeMarginBottom;
  return Math.round(minPx + u * (maxPx - minPx));
}

function getChartFrameBadgeToChartGapPx(chartWidthPx) {
  const u = getChartWidthUnit(chartWidthPx);
  const { minPx, maxPx } = FE_UI.chartFrame.badgeToChartGap;
  return Math.round(minPx + u * (maxPx - minPx));
}

/** Pull the chart frame up so top axis labels sit just below the track badge. */
export function getChartFrameMarginTopPx(chartWidthPx) {
  const u = getChartWidthUnit(chartWidthPx);
  const reserve = getRadarLabelReservedPx(chartWidthPx);
  const badgeGap = getTrackBadgeMarginBottomPx(chartWidthPx);
  const visibleGap = getChartFrameBadgeToChartGapPx(chartWidthPx);
  const { minPx, maxPx } = FE_UI.chartFrame.marginTopExtraPull;
  const extraPull = Math.round(minPx + u * (maxPx - minPx));
  return -(reserve + badgeGap - visibleGap + extraPull);
}

export function getChartFrameMarginBottomPx(chartWidthPx) {
  const u = getChartWidthUnit(chartWidthPx);
  const cf = FE_UI.chartFrame;
  return Math.round(cf.marginBottomMinPx + u * (cf.marginBottomMaxPx - cf.marginBottomMinPx));
}
