import { FE_UI } from "@/constants";

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

export function getChartTitleSizePx(chartWidthPx) {
  const labelPx = getChartPointLabelSizePx(chartWidthPx);
  const { labelMultiplier, minPx, maxPx } = FE_UI.chart.title;
  return Math.min(maxPx, Math.max(minPx, Math.round(labelPx * labelMultiplier)));
}

/** Score card typography — label/sub track secondary labels; value tracks chart title. */
export function getScoreCardFontSizesPx(chartWidthPx) {
  const secondaryPx = getChartSecondaryLabelSizePx(chartWidthPx);
  const u = getChartWidthUnit(chartWidthPx);
  const labelScale = 1 - u * (1 - FE_UI.chart.scoreCardLabelMultiplier);
  const labelPx = Math.min(FE_UI.chart.scoreCardLabelMaxPx, Math.max(1, Math.round(secondaryPx * labelScale)));
  return {
    labelPx,
    valuePx: getChartTitleSizePx(chartWidthPx),
    subPx: secondaryPx,
  };
}

/** Initial frame height before label bounds are measured from the live chart. */
export function getChartFrameEstimatedHeightPx(chartWidthPx) {
  const u = getChartWidthUnit(chartWidthPx);
  const { minRatio, maxRatio } = FE_UI.chartFrame.heightWidthRatio;
  const ratio = minRatio + u * (maxRatio - minRatio);
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
