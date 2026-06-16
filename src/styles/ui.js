export const FE_UI = {
  page: { maxWidthPx: 640, minWidthPx: 350, theoryMaxWidthPx: 796 },
  chartFrame: {
    /** Height/width ratio (radar fits a wide rect, not a square). Serves as both the pre-measurement estimate seed and the post-convergence floor — measured content converges below this, so the floor sets the final height. */
    heightWidthRatio: 0.55,
    /** Safety pad around measured axis-label span — just enough to keep labels off the canvas edge; chrome spacing lives in CSS margins. */
    contentPadPx: 2,
    minChartHeightPx: 120,
  },
  chart: {
    title: { labelMultiplier: 1.4, minPx: 14, maxPx: 22 },
    layoutPaddingHorizontal: { minPx: 8, maxPx: 16 },
    radarCenterFix: true,
    radarLabelReserved: { minPx: 38, maxPx: 54 },
    /** Track badge + cluster legend — slightly below axis pillar labels, same width scaling. */
    secondaryLabelMultiplier: 0.9,
    /** Floor for track + cluster legend labels (mobile). */
    secondaryLabelMinPx: 10,
    /** md badge min width (em) — sized for "Frontend" so title does not shift on track toggle. */
    trackBadgeMdMinWidthEm: 6.75,
    /** Swatch edge length vs legend label font size — just taller than text cap height. */
    legendSwatchLabelMultiplier: 1.2,
    pointLabelPaddingRange: { minPx: 4, maxPx: 8 },
    pointLabelPx: 11,
    pointLabelScaleWithChart: true,
    pointLabelWeight: "bold",
    pointLabelColor: "#1e293b",
    pointLabelDimColor: "#1e293b60",
    gridColor: "rgba(0, 0, 0, 0.15)",
    tickLabelColor: "rgba(0, 0, 0, 0.3)",
    centerPointLabels: false,
    tickInitialPx: 12,
    tickBackdropPad: { top: 2, bottom: 2, left: 3, right: 3 },
    tickBackdropColor: "rgba(255, 255, 255, 0.5)",
    exportImageCssScale: 8,
    exportImageCssScaleMax: 12,
    /** White inset on copied image only (Tailwind p-2 = 8px). */
    exportImagePaddingPx: 8,
    clusterBorderColor: "rgba(0, 0, 0, 0.22)",
    clusterBorderWidth: 1,
  },
  chartFonts: {
    tickMinPx: 8,
    tickWidthDivisor: 48,
    pointLabelMinPx: 11,
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
