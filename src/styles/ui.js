export const FE_UI = {
  page: {
    maxWidthPx: 550,
    minWidthPx: 350,
    theoryMaxWidthPx: 900,
    /**
     * Desktop width ceiling for the radar canvas itself. The tool chart reaches this implicitly:
     * `maxWidthPx` (550) minus the tab panel's px-3 gutters (12 each side) = 526. The theory hero
     * radar's tab is 900 wide, so it caps its own wrapper at this value to land on the same canvas
     * width and therefore the same rendered size.
     */
    chartMaxWidthPx: 526,
  },
  chartFrame: {
    /**
     * Height/width ratio (radar fits a wide rect, not a square). Seeds the PRE-measurement frame
     * estimate only (getChartFrameEstimatedHeightPx). It is no longer a post-convergence floor:
     * final height is the measured axis-label span, matching the theory hero radar so both charts
     * render the same size radar. Raising this no longer enlarges the chart.
     */
    heightWidthRatio: 0.55,
    /** Safety pad around measured axis-label span — just enough to keep labels off the canvas edge; chrome spacing lives in CSS margins. */
    contentPadPx: 2,
    minChartHeightPx: 120,
  },
  chart: {
    title: { labelMultiplier: 1.4, minPx: 14, maxPx: 22 },
    layoutPaddingHorizontal: { minPx: 2, maxPx: 5 },
    radarCenterFix: true,
    /**
     * Horizontal space held back from the radar radius for the axis labels — applyRadarCenterFit
     * subtracts it from the half-width to get a maxR cap.
     *
     * Matched to THEORY_CHART_UI (with layoutPaddingHorizontal above) so the tool chart and the
     * theory hero radar compute the same maxR and therefore draw the same size radar.
     *
     * This DOES bind at narrow widths. Since the frame height is fit to the measured label span
     * (~330px at a 375px viewport, so half ≈ 165), the old 38→54px reserve capped maxR at ~129
     * while the hero's 10→18px gave ~163 — a visibly smaller radar on mobile even though both
     * charts were otherwise identical. At desktop, height is the binding constraint instead.
     */
    radarLabelReserved: { minPx: 10, maxPx: 18 },
    /** Track badge + cluster legend — slightly below axis pillar labels, same width scaling. */
    secondaryLabelMultiplier: 0.9,
    /** Floor for track + cluster legend labels (mobile). */
    secondaryLabelMinPx: 10,
    /** md badge min width (em) — sized for the short "FE"/"BE" label. */
    trackBadgeMdMinWidthEm: 2.75,
    /** Swatch edge length vs legend label font size — just taller than text cap height. */
    legendSwatchLabelMultiplier: 1.2,
    pointLabelPaddingRange: { minPx: 4, maxPx: 8 },
    /**
     * These two no longer size the radar's own axis labels — `pointLabelPxRange` below does, for
     * every chart. They survive as the basis of the DOM chrome that scales WITH the chart: the track
     * badge, cluster legend and chart title, via getChartPointLabelSizePx in chart/fonts.js. Tuning
     * them moves that chrome, not the labels on the canvas.
     */
    pointLabelPx: 11,
    pointLabelScaleWithChart: true,
    /**
     * Axis-label size ramp, shared by the tool chart and the theory hero radar so the two render at
     * identical label sizes for a given chart width. Linearly interpolated (unrounded) by
     * getPointLabelSizePxFromRange: minPx at/below minWidthPx, maxPx at/above maxWidthPx.
     *
     * Kept here rather than at the call sites so the two charts can't drift apart — the hero is a
     * theory-preset chart and passes this range explicitly to override THEORY_CHART_UI's own
     * (smaller) ramp. Every radar sizes its labels this way now; the small career-track charts have
     * their own ramp on the theory preset.
     */
    pointLabelPxRange: { minPx: 12, maxPx: 15, minWidthPx: 300, maxWidthPx: 526 },
    pointLabelWeight: "bold",
    pointLabelColor: "#1e293b",
    pointLabelDimColor: "#1e293b60",
    gridColor: "rgba(0, 0, 0, 0.15)",
    tickLabelColor: "rgba(0, 0, 0, 0.3)",
    centerPointLabels: false,
    tickInitialPx: 12,
    /* Vertical padding stays tight: the backdrop is (tick font size + top/bottom) tall while the gap
       between rings shrinks with the radius, so at the narrowest viewport a taller pill collides with
       the one above. Also feeds radarTickBackdropHalf() → the scale's reserved layout space. */
    tickBackdropPad: { top: 1.5, bottom: 1.5, left: 2, right: 2 },
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
    pointLabelMinPx: 12,
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
