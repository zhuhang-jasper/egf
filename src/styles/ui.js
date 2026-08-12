export const FE_UI = {
  page: {
    maxWidthPx: 550,
    minWidthPx: 350,
    theoryMaxWidthPx: 900,
    /**
     * Desktop width ceiling for the radar canvas. The tool chart reaches it implicitly (550 − 2×12 of `px-3`);
     * the theory hero radar's tab is 900 wide, so it caps its wrapper here to land on the same size.
     */
    chartMaxWidthPx: 526,
    /**
     * Layout width for the off-screen foundational 3-up row, and so the width its radars fit to. Must
     * approximate the PRINTED content width: a radar's geometry is baked into the bitmap at fit time and print
     * CSS can rescale it but not re-derive it.
     *
     * A4 portrait: 794px page − 24px tab-panel `px-3` − 24px card `p-3` = 746, +16 because this grid carries
     * `-mx-2`. See docs/DECISIONS.md#print-foundation-grid-width.
     */
    printFoundationGridWidthPx: 762,
  },
  chartFrame: {
    /**
     * Height/width ratio, seeding the pre-measurement frame estimate only (getChartFrameEstimatedHeightPx).
     * Final height is the measured axis-label span, so raising this does not enlarge the chart.
     */
    heightWidthRatio: 0.55,
    /** Safety pad around the measured axis-label span; chrome spacing lives in CSS margins. */
    contentPadPx: 2,
    minChartHeightPx: 120,
  },
  chart: {
    /**
     * Chart title size, as a multiple of the radar's axis-label size (see getChartTitleSizePx). A ratio rather
     * than a px value or Tailwind step so the title, track badge and cluster legend stay in proportion at every
     * chart width; the theory tab's framework title runs off the same number.
     *
     * No `minPx`/`maxPx` on purpose: the floor comes from `chartFonts.pointLabelMinPx` and the ceiling from
     * `page.chartMaxWidthPx`, so both would be unreachable. Retune via those, not a font clamp. Leading is
     * Tailwind's `leading-tight` alone. See docs/DECISIONS.md#chart-type-scale.
     */
    title: { labelMultiplier: 1.4 },
    layoutPaddingHorizontal: { minPx: 2, maxPx: 5 },
    radarCenterFix: true,
    /**
     * Horizontal space held back from the radar radius for axis labels; applyRadarCenterFit subtracts it from
     * the half-width to cap maxR. Matched to THEORY_CHART_UI so the tool chart and theory hero radar draw the
     * same size. Binds at narrow widths (height binds at desktop), so raising it shrinks the mobile radar.
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
     * These size the DOM chrome that scales with the chart (track badge, cluster legend, title) via
     * getChartPointLabelSizePx, NOT the canvas axis labels — `pointLabelPxRange` below does those.
     */
    pointLabelPx: 11,
    pointLabelScaleWithChart: true,
    /**
     * Axis-label size ramp, linearly interpolated by getPointLabelSizePxFromRange. Shared by the tool chart and
     * the theory hero radar (which passes it explicitly to override THEORY_CHART_UI's smaller ramp) so the two
     * cannot drift apart. The small career-track charts use the theory preset's own ramp.
     */
    pointLabelPxRange: { minPx: 12, maxPx: 15, minWidthPx: 300, maxWidthPx: 526 },
    pointLabelWeight: "bold",
    pointLabelColor: "#1e293b",
    pointLabelDimColor: "#1e293b60",
    gridColor: "rgba(0, 0, 0, 0.15)",
    tickLabelColor: "rgba(0, 0, 0, 0.3)",
    centerPointLabels: false,
    tickInitialPx: 12,
    /* Vertical padding stays tight or the pills collide at the narrowest viewport, where the gap between rings
       has shrunk with the radius. Also feeds radarTickBackdropHalf() and so the scale's reserved layout space. */
    tickBackdropPad: { top: 1.5, bottom: 1.5, left: 2, right: 2 },
    tickBackdropColor: "rgba(255, 255, 255, 0.5)",
    /* THE EXPORT IS RENDERED AT A FIXED WIDTH, not at the viewport's.
       The chart is width-adaptive — label sizes, wrapping and the radar's radius are all derived from the
       width it fitted at and then baked into the bitmap — so capturing at whatever the window happened to be
       made the same profile export at ~2800px from a phone and ~4200px from a desktop, with phone
       proportions baked into the former. Pinning the layout width is what makes an export reproducible.
       526px is `page.chartMaxWidthPx`, the width the canvas reaches on desktop, so the image carries the
       proportions a desktop user actually sees rather than a composition no one is shown. */
    exportImageLayoutWidthPx: 526,
    /* Resolution multiplier on the pinned layout above — pixel dimensions only, no effect on proportion.
       2x is the retina target: one CSS px drawn with two physical ones, so the PNG is sharp displayed at its
       natural size, and 526 + 2×8 padding lands at ~1084px, near enough 1080 to read as a Full-HD-width
       image. Was 8x, which produced 3-4k-wide files whose extra pixels only paid off under heavy zoom. */
    exportImageCssScale: 2,
    exportImageCssScaleMax: 12,
    /** UHD export multiplier, admin-gated (FEATURE_CHART_UHD_EXPORT_SETTING) — for stills that get displayed
        far larger than natural size, e.g. stretched across a slide. */
    exportImageCssScaleUhd: 4,
    /** White inset on copied image only (Tailwind p-2 = 8px). */
    exportImagePaddingPx: 8,
    /* ATTRIBUTION BAND on the copied image only — the credit strip below the chart.
       Both numbers are fractions of getChartSecondaryLabelSizePx(), the size the cluster legend renders at, so
       the credit tracks the chart's type scale instead of being a fixed px value against a scaled one.
       Below 1 because the credit names the framework in FULL, which does not fit on one line at the legend's own
       size across the pinned export width. It is a constant rather than a measured fit: the string is a constant
       too. Reword the credit long enough to overrun and this is the knob.
       No band-height constant: the strip is `exportImageAttributionGapPx + this line's height`. */
    exportImageAttributionFontRatio: 0.8,
    /* Space between the content above and the credit line. Larger than exportImagePaddingPx because the content
       ends flush at the cluster legend's drawn border, so this gap starts at a hard edge rather than at type.
       The white BELOW the credit is exportImagePaddingPx itself, keeping all four edges of the export on one
       number. See getAttributionBandPx. */
    exportImageAttributionGapPx: 16,
    exportImageAttributionColor: "#94a3b8",
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
