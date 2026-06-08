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

/**
 * Fixed chart frame margins — independent of legend visibility.
 * Top gap comes from the title row; frame height is fitted to label bounds.
 * Bottom trim collapses slack; legend spacing is on the legend card.
 */
export function getChartFrameMarginTopPx() {
  return 0;
}

export function getChartFrameMarginBottomPx(chartWidthPx, { minimalChrome = false } = {}) {
  if (minimalChrome) {
    return 0;
  }
  const u = getChartWidthUnit(chartWidthPx);
  const { minPx, maxPx } = FE_UI.chartFrame.marginBottomTrim;
  return Math.round(minPx + u * (maxPx - minPx));
}

export function isChartMinimalChrome({ chartLegendHidden, chartTitleHidden, title }) {
  const showVisibleTitle = !chartTitleHidden && String(title).trim().length > 0;
  return !showVisibleTitle && chartLegendHidden;
}

/** Initial frame height before label bounds are measured from the live chart. */
export function getChartFrameEstimatedHeightPx(chartWidthPx) {
  const u = getChartWidthUnit(chartWidthPx);
  const { minRatio, maxRatio } = FE_UI.chartFrame.heightWidthRatio;
  const ratio = minRatio + u * (maxRatio - minRatio);
  const minH = FE_UI.chartFrame.minChartHeightPx ?? 120;
  return Math.round(Math.max(minH, chartWidthPx * ratio));
}

export function applyChartFrameLayout(frameEl, chartWidthPx, contentHeightPx = null, { minimalChrome = false } = {}) {
  const marginTop = getChartFrameMarginTopPx();
  const marginBottom = getChartFrameMarginBottomPx(chartWidthPx, { minimalChrome });
  const minH = FE_UI.chartFrame.minChartHeightPx ?? 120;
  const innerH = Math.round(Math.max(minH, contentHeightPx ?? getChartFrameEstimatedHeightPx(chartWidthPx)));

  frameEl.style.margin = `${marginTop}px auto ${marginBottom}px`;
  frameEl.style.aspectRatio = "unset";
  frameEl.style.height = `${innerH}px`;
}
