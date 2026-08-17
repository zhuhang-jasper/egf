export const FE_UI = {
  page: {
    /**
     * The tool tab's measure. INCLUDES THE CHART CARD'S PADDING: widened by 24 (2×12) when the chart moved
     * inside a card, so it is sized backwards from the radar width rather than chosen. See `chartMaxWidthPx`
     * for the subtraction and ChartSection's card for the `p-3` that must stay flat.
     */
    maxWidthPx: 574,
    /**
     * LAYOUT FLOOR ONLY — the narrowest the page (and the bottom nav, which must match or the two desync
     * below it) will render. Deliberately NOT widened by the chart card's padding the way `maxWidthPx` was:
     * the card redistributes space inside the page, it does not make the page need more. Raising this to 374
     * only moved the horizontal-scroll threshold to ~389 and cost 360px phones a scrollbar for nothing.
     *
     * The chart's own narrow end is `chartMinWidthPx`, which is what the label-size ramp reads. These two
     * were one number until the card made them differ; keep them apart.
     */
    minWidthPx: 350,
    /**
     * The radar frame's width when the page is at `minWidthPx`: 350 − 2×12 (tab panel `px-3`) − 2×12 (chart
     * card `p-3`) = 302. The low end of the axis-label size ramp (see chart/fonts.js and radar-center.js),
     * mirroring `chartMaxWidthPx` at the other end.
     */
    chartMinWidthPx: 302,
    theoryMaxWidthPx: 900,
    /**
     * Desktop width ceiling for the radar canvas. The tool chart reaches it implicitly:
     * 574 − 2×12 (tab panel `px-3`) − 2×12 (chart card `p-3`) = 526. The theory hero radar's tab is 900 wide,
     * so it caps its wrapper here to land on the same size — which is the reason this number must not drift:
     * it is what keeps the two tabs' radars identical. The min end works out the same way (374 → 326).
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
       proportions a desktop user actually sees rather than a composition no one is shown.

       THAT LAST CLAUSE IS A STANDING INVARIANT, NOT A ONE-OFF OBSERVATION, and it is not enforced by anything:
       this is a separate constant that merely happens to equal `chartMaxWidthPx`, so the two can drift apart
       silently — no error, just an image composed at a width nobody is shown. It must keep agreeing with BOTH
         - the tool tab's desktop frame: `page.maxWidthPx` − 2×12 (tab panel `px-3`) − 2×12 (chart card `p-3`)
         - the theory hero radar, which caps its wrapper at `chartMaxWidthPx` directly
       Change the card's padding, the tab panel's padding, or `maxWidthPx`, and re-derive this. The export
       itself is insulated (the clone is `exportRef`, which sits INSIDE the card, so no padding reaches it) —
       what breaks is only the reason 526 is the right number. */
    exportImageLayoutWidthPx: 526,
    /* Resolution multiplier on the pinned layout above — pixel dimensions only, no effect on proportion.
       2x is the retina target: one CSS px drawn with two physical ones, so the PNG is sharp displayed at its
       natural size, and the ink-cropped 526px layout lands near 1030px wide — close enough to 1080 to read as a
       Full-HD-width image. Not exactly 2×(526 + padding): the output is cropped to painted pixels, so the width
       is the ink's plus the margins (see getInkBounds), which moves a little with the track's axis labels.
       Was 8x, which produced 3-4k-wide files whose extra pixels only paid off under heavy zoom. */
    exportImageCssScale: 2,
    exportImageCssScaleMax: 12,
    /** UHD export multiplier, admin-gated (FEATURE_CHART_UHD_EXPORT_SETTING) — for stills that get displayed
        far larger than natural size, e.g. stretched across a slide. */
    exportImageCssScaleUhd: 4,
    /* White margin on the copied image only — all four edges take this one number, but they measure it from
       different things, and that is on purpose.
       TOP AND BOTTOM are measured to the nearest PAINTED PIXEL: the only thing between the ink and the layout box
       on that axis is leading, so trimming it is safe (see getInkRowBounds in utils/copy-chart-image.js).
       LEFT AND RIGHT are measured to the LAYOUT BOX, i.e. the pinned exportImageLayoutWidthPx. The box is the
       frame the blocks align to, so trimming the sides to ink would let a display toggle or a short profile name
       redefine the image's width. The right edge therefore reads looser than the left, since the title row sits
       flush at the box's left while the radar's axis labels stop short of its right.
       There is deliberately no per-side variant of this number: a side reading tight is a fault in the block that
       does not reach the box, not something to offset here. */
    exportImagePaddingPx: 12,
    /* ATTRIBUTION BAND on the copied image only — the credit strip below the chart.
       Both numbers are fractions of getChartSecondaryLabelSizePx(), the size the cluster legend renders at, so
       the credit tracks the chart's type scale instead of being a fixed px value against a scaled one.
       Below 1 because the credit names the framework in FULL, which does not fit on one line at the legend's own
       size across the pinned export width. It is a constant rather than a measured fit: the string is a constant
       too. Reword the credit long enough to overrun and this is the knob.
       No band-height constant: the strip is `exportImageAttributionGapPx + this line's measured ink`. */
    exportImageAttributionFontRatio: 0.8,
    /* Space between the content's lowest ink and the credit line's highest — whatever that content is, so the
       gap holds whether the block ends at the cluster legend's border, at a score card, or at a bare axis label
       when both are switched off.
       ORDER MATTERS AND IS SEQUENTIAL: content, this gap, the credit line, and only THEN the uniform
       exportImagePaddingPx around all four sides of that whole block. The white below the credit is therefore
       the margin, not this number. See measureAttribution in utils/copy-chart-image.js.
       Larger than exportImagePaddingPx, and a SEPARATE knob rather than a duplicate of it: this one separates two
       pieces of content, that one is the image's edge. Retune either without touching the other.
       WHY IT IS THIS WIDE: at 18 the credit sat close enough under the cluster legend to read as a second legend
       row rather than the image's footer — it is only 0.8x the legend's size (the ratio above), so proximity was
       doing more grouping than the type scale could undo. This is the knob for that, not the credit's colour or
       weight, which are shared with every other footer in the app and stay put. */
    exportImageAttributionGapPx: 26,
    /* slate-500, THE ONE CREDIT GREY, shared with the app footer (screen and print, pages/HomePage.jsx) and the
       poster's footer. Every credit line in the app reads at this weight, so it is a single decision rather than
       a per-surface taste call.
       Was slate-400, which looked right beside a small chart but sat at ~2.8:1 on white — under WCAG AA, and
       these lines carry the CC BY-NC attribution on artifacts that get printed and projected. slate-500 is
       ~4.8:1 and still clearly secondary to the slate-600/700 content around it. */
    exportImageAttributionColor: "#64748b",
    /* Weight the copied image's TITLE is drawn at, as an OFFSET from whatever the <h2> itself computes
       (`font-extrabold` = 800, so -100 draws it at 700). A delta rather than an absolute so restyling the
       heading carries through instead of being silently overridden here. 0 disables the correction.
       WHY IT EXISTS: <body> carries Tailwind's `antialiased`, i.e. `-webkit-font-smoothing: antialiased`, which on
       macOS visibly THINS DOM text. Canvas 2D does not honour it and there is no canvas equivalent to switch on,
       so the identical 800 rasterizes heavier in the export than on screen.
       WHY IT IS A FUDGE AND ACCEPTED AS ONE: unlike the export's geometry, this compensates for a rendering
       difference with no API behind it, so there is nothing to measure and match. It is also platform-dependent —
       `-webkit-font-smoothing` is a no-op on Windows and Linux, where the two already agreed, so the export runs
       slightly light there. Judged worth it because an export is made and reviewed on the same machine.
       Inter is variable across 100–900, so any value in range is a real instance: dial 750 or 780 rather than
       treating the 100s as steps. See docs/DECISIONS.md#export-title-weight-is-corrected-for-font-smoothing. */
    exportImageTitleWeightDelta: -50,
    /* Same correction, same reasoning, for the TRACK BADGE's label — its own number because the two are different
       type at different sizes, and grayscale smoothing does not thin them by the same visible amount. The badge's
       label is ~12px where the title's is ~21px, and small text is where the smoothing difference is least
       visible, so expect this to want a SMALLER magnitude than the title's, not the same one.
       Deliberately NOT extended to the cluster legend or the score cards, which are the same size and drawn by the
       same code: nobody has reported those reading heavy, and a knob per canvas string is how this stops being a
       correction and becomes a second styling system. Add one if and when a specific one looks wrong. */
    exportImageBadgeWeightDelta: -150,
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
