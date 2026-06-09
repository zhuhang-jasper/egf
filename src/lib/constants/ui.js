export const FE_UI = {
  page: { maxWidthPx: 650, minWidthPx: 350 },
  chartFrame: {
    /** Fallback frame height before Chart.js label bounds are measured (radar fits a wide rect, not a square). */
    heightWidthRatio: { minRatio: 0.76, maxRatio: 0.84 },
    /** Responsive trim applied below the chart frame — collapses leftover canvas slack. */
    marginBottomTrim: { minPx: -14, maxPx: -36 },
    /** Padding around measured axis-label span when fitting frame height to content. */
    contentPadPx: 6,
    minChartHeightPx: 120,
  },
  chart: {
    title: { labelMultiplier: 1.4, minPx: 14, maxPx: 22 },
    layoutPadding: { top: 0, right: 30, bottom: 0, left: 30 },
    layoutPaddingHorizontal: { minPx: 14, maxPx: 30 },
    radarCenterFix: true,
    radarLabelReservedPx: 62,
    radarLabelReserved: { minPx: 38, maxPx: 54 },
    legendMarginTop: { minPx: 14, maxPx: 36 },
    /** Track badge + cluster legend — slightly below axis pillar labels, same width scaling. */
    secondaryLabelMultiplier: 0.9,
    /** md badge min width (em) — sized for "Frontend" so title does not shift on track toggle. */
    trackBadgeMdMinWidthEm: 6.75,
    /** Swatch edge length vs legend label font size — just taller than text cap height. */
    legendSwatchLabelMultiplier: 1.2,
    pointLabelPadding: 5,
    pointLabelPx: 11,
    pointLabelScaleWithChart: true,
    pointLabelWeight: "bold",
    pointLabelColor: "#333",
    gridColor: "rgba(0, 0, 0, 0.15)",
    tickLabelColor: "rgba(0, 0, 0, 0.3)",
    centerPointLabels: false,
    tickInitialPx: 12,
    tickBackdropPad: { top: 2, bottom: 2, left: 3, right: 3 },
    tickBackdropColor: "rgba(255, 255, 255, 0.5)",
    exportImageCssScale: 8,
    exportImageCssScaleMax: 12,
    clusterBorderColor: "rgba(0, 0, 0, 0.22)",
    clusterBorderWidth: 1,
  },
  chartFonts: {
    tickMinPx: 8,
    tickWidthDivisor: 48,
    pointLabelMinPx: 9,
    pointLabelMaxPx: 18,
    pointLabelRefWidthPx: 380,
  },
  dataset: {
    fill: "rgba(56, 56, 56, 0.58)",
    stroke: "#3a3a3a",
    lineWidth: 2,
    pointRadius: 2,
    pointHoverRadius: 4,
    pointStyle: "circle",
    pointFill: "#404040",
    pointStroke: "#404040",
    pointBorderWidth: 0,
    pointHoverFill: "rgba(64, 64, 64, 0.95)",
    pointHoverStroke: "#404040",
    pointHoverBorderWidth: 0,
  },
};
