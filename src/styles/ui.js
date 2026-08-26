export const FE_UI = {
  page: {
    // These five are one arithmetic chain, not independent numbers: 50px of chrome separates a page measure
    // from the radar frame inside it, and `maxWidthPx` alone subtracts the desktop scrollbar.
    // See docs/DECISIONS.md#chart-width-arithmetic and docs/DECISIONS.md#page-min-width-vs-chart-min-width
    maxWidthPx: 455,
    minWidthPx: 350,
    chartMinWidthPx: 300,
    theoryMaxWidthPx: 900,
    chartMaxWidthPx: 405,
    /**
     * Layout width for the off-screen foundational 3-up row, and so the width its radars fit to. Must
     * approximate the PRINTED content width: a radar's geometry is baked into the bitmap at fit time and print
     * CSS can rescale it but not re-derive it. A4 portrait: 794px page − 48px of card/panel padding = 746, +16
     * because this grid carries `-mx-2`. See docs/DECISIONS.md#print-foundation-grid-width
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
    // `maxPx` IS the export's title size, so keep `opsz` in index.css equal to it.
    // See docs/DECISIONS.md#chart-type-scale
    titleRange: { minPx: 14, maxPx: 18, minWidthPx: 300, maxWidthPx: 405 },
    layoutPaddingHorizontal: { minPx: 2, maxPx: 5 },
    radarCenterFix: true,
    /**
     * Horizontal space held back from the radar radius for axis labels; applyRadarCenterFit subtracts it from
     * the half-width to cap maxR. Matched to THEORY_CHART_UI so the tool chart and theory hero radar draw the
     * same size. Binds at narrow widths (height binds at desktop), so raising it shrinks the mobile radar.
     */
    radarLabelReserved: { minPx: 10, maxPx: 18 },
    /**
     * Read top-down by getChartSecondaryLabelSizePx; `fromChartWidthPx` is the frame width a rung starts at, and
     * the last entry omits it and is the floor. Integer sizes and hand-placed boundaries are both load-bearing
     * (docs/DECISIONS.md#badge-ink-centring). 405 is `page.chartMaxWidthPx`; 355 is taste; 10 is the app's
     * common smallest rung.
     */
    secondaryLabelRungs: [{ fromChartWidthPx: 405, px: 12 }, { fromChartWidthPx: 355, px: 11 }, { px: 10 }],
    /** Floor for the rung table above — also the value a malformed table falls back to. */
    secondaryLabelMinPx: 10,
    /** md badge min width (em) — sized for the short "FE"/"BE" label. */
    trackBadgeMdMinWidthEm: 2.75,
    /** Swatch edge length vs legend label font size — just taller than text cap height. */
    legendSwatchLabelMultiplier: 1.2,
    pointLabelPaddingRange: { minPx: 4, maxPx: 8 },
    pointLabelScaleWithChart: true,
    /**
     * Shared by the tool chart and the theory hero radar, which passes it explicitly to override
     * THEORY_CHART_UI's smaller ramp, so the two cannot drift apart. The low end is 11 rather than 12 because
     * these are BOLD canvas labels and 12 crowds a phone-width radar, but not 10, which reads thin under `bold`
     * without the DOM's font smoothing. If the labels need more room the knob is `radarLabelReserved`, which
     * holds space rather than shrinking them. See docs/DECISIONS.md#chart-type-scale
     */
    pointLabelPxRange: { minPx: 11, maxPx: 14, minWidthPx: 300, maxWidthPx: 405 },
    pointLabelWeight: "bold",
    pointLabelColor: "#1e293b",
    pointLabelDimColor: "#1e293b60",
    gridColor: "rgba(0, 0, 0, 0.15)",
    tickLabelColor: "rgba(0, 0, 0, 0.35)",
    centerPointLabels: false,
    tickInitialPx: 12,
    /* 500, not Chart.js's default 400: the L1-L5 digits are small and low-contrast. Any value other than
       400/700 must also be preloaded for "Inter Tabular" in export-image's FONT_SPECS, since an unloaded weight
       drops the whole family to system-ui rather than merely rendering thin. */
    tickWeight: 500,
    /* Vertical padding stays tight or the pills collide at the narrowest viewport, where the gap between rings
       has shrunk with the radius. Also feeds radarTickBackdropHalf() and so the scale's reserved layout space. */
    tickBackdropPad: { top: 1.5, bottom: 1.5, left: 2, right: 2 },
    tickBackdropColor: "rgba(255, 255, 255, 0.55)",
    /* THE EXPORT IS RENDERED AT A FIXED WIDTH, not the viewport's, or the same profile exports at different
       proportions from a phone and a desktop. MUST EQUAL `page.chartMaxWidthPx`; not enforced.
       See docs/DECISIONS.md#chart-width-arithmetic */
    exportImageLayoutWidthPx: 405,
    /* Resolution multiplier on the pinned layout above: pixel dimensions only, no effect on proportion.
       KEEP THESE INTEGERS. See docs/DECISIONS.md#export-scale-targets-the-feed */
    exportImageCssScale: 3,
    exportImageCssScaleMax: 12,
    /** Admin-gated high-res multiplier (FEATURE_CHART_UHD_EXPORT_SETTING). Keep the ChartToolbar toggle's label
        in step with this number. See docs/DECISIONS.md#export-scale-targets-the-feed */
    exportImageCssScaleUhd: 5,
    /* White margin on the copied image only. All four edges take this one number but measure it from different
       things, deliberately, and there is no per-side variant: a side reading tight is a fault in the block that
       does not reach the box. See docs/DECISIONS.md#export-margins-crop-the-rows-not-the-columns */
    exportImagePaddingPx: 12,
    /* Credit line size on the copied image, in CSS px at `exportImageLayoutWidthPx`. Authored, not derived: the
       export renders at one pinned width, so there is no scale to track. No band-height constant, the strip
       being `exportImageAttributionGapPx + this line's measured ink`. */
    exportImageAttributionFontPx: 9,
    /* Space between the content's lowest ink and the credit line's highest, whatever that content is.
       NOT COMPARABLE TO THE `mt-*` ABOVE IT, which is the trap: the legend and scores blocks space themselves
       BOX to BOX (`mt-4` = 16px) while this is INK to INK, and the credit's glyphs start ~2-3px inside their own
       line box, so matching `mt-4` optically means ~18-19 here rather than 16. If the credit regroups with the
       legend go UP, not down, and use this knob rather than the credit's colour or weight, which are shared with
       every other footer in the app. See docs/DECISIONS.md#export-margins-crop-the-rows-not-the-columns */
    exportImageAttributionGapPx: 20,
    /* slate-500, THE ONE CREDIT GREY, at ~4.8:1 on white. These lines carry the CC BY-NC attribution on
       artifacts that get printed and projected, so WCAG AA binds here.
       See docs/DECISIONS.md#one-credit-grey-one-credit-weight */
    exportImageAttributionColor: "#64748b",
    /* An OFFSET from whatever the <h2> computes (`font-extrabold` = 800, so -100 draws at 700), so restyling the
       heading carries through; 0 disables the correction. Inter is variable across 100–900, so dial 750 or 780
       rather than treating the 100s as steps.
       See docs/DECISIONS.md#export-title-weight-is-corrected-for-font-smoothing */
    exportImageTitleWeightDelta: -50,
    /* Same correction for the TRACK BADGE's label, its own number because the two are different type at
       different sizes. Deliberately NOT extended to the cluster legend or the score cards, which are the same
       size and drawn by the same code.
       See docs/DECISIONS.md#export-title-weight-is-corrected-for-font-smoothing */
    exportImageBadgeWeightDelta: -150,
    clusterBorderColor: "rgba(0, 0, 0, 0.22)",
    clusterBorderWidth: 1,
  },
  chartFonts: {
    tickMinPx: 8,
    tickWidthDivisor: 48,
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
