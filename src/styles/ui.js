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
    /**
     * Chart title size, as a multiple of the radar's axis-label size (see getChartTitleSizePx). Expressed
     * that way ON PURPOSE: the title sits directly above the canvas and beside the track badge, both of which
     * scale with chart width, so a fixed px size or a Tailwind `text-*` step would drift out of proportion at
     * every width but the one it was picked at.
     *
     * THE THEORY TAB'S FRAMEWORK TITLE RUNS OFF THIS SAME NUMBER (see TheoryContent), so the two are equal at
     * every width by construction rather than by agreement. Theory used to carry its own Tailwind `text-*`
     * ladder instead; that was dropped because the tool's breakpoints are not Tailwind's — the tool panel caps
     * at 550, so the chart reaches full size around a 550px viewport while `sm:` does not fire until 640,
     * which stepped the title for a reason unrelated to the chart it sits above.
     *
     * THE SIZE IS FRACTIONAL — getChartTitleSizePx does not round, and reads the exact label curve rather
     * than the rounded label the badge and legend take (see chart/fonts.js). So this multiplier scales a
     * continuous ramp, and the title tracks the chart at every width instead of holding a size across a band
     * and then snapping when the rounded label ticks over.
     *
     * The floor is still a genuine plateau, but it comes from the LABEL's own `pointLabelMinPx` clamp rather
     * than from rounding: below ~415px of chart width the label is pinned at 12, so the title is flat at
     * `12 × 1.4 = 16.8` across every phone width. Above that it rises continuously to `15.23 × 1.4 ≈ 21.3` at
     * the 526px chart.
     *
     * THERE IS NO `minPx`, ON PURPOSE. The floor is structural: the label is already clamped to
     * `chartFonts.pointLabelMinPx` (12) before the multiplier, so the title cannot go below `12 × 1.4 = 16.8`.
     * An explicit `minPx: 14` used to sit here and was dead — under the product, so nothing could ever reach
     * it. Retune the floor via the multiplier (or that label clamp), not by reintroducing a second one.
     *
     * SHARING getChartPointLabelSizePx IS THE POINT, not an implementation detail. The track badge and the
     * cluster legend take their size from the same call at `× 0.9` (see getChartSecondaryLabelSizePx), so the
     * title, the badge and the legend are three fixed ratios of one number and cannot drift apart as the chart
     * resizes. Anything that wants to move with the chart belongs on this function, not on a private ramp.
     *
     * THERE IS NO `maxPx` EITHER, AND ADDING ONE BACK WOULD DO NOTHING. It carried `maxPx: 22`, which was
     * kept for a while on the argument that it guarded the size shared with the theory framework title. That
     * argument was wrong: `page.chartMaxWidthPx` holds the canvas at 526, so the title tops out at ~21.3 and
     * ANY ceiling above that is unreachable. Raising it to 30 produced identical output at every width.
     *
     * THE REAL CEILING IS THE CANVAS WIDTH. Both titles are a fixed multiple of a label that is a fixed
     * multiple of the chart, and the chart stops growing at 526 — so that is what bounds the type. To change
     * the largest the titles get, move `page.chartMaxWidthPx` or `labelMultiplier`. A font clamp cannot.
     *
     * LEADING IS NOT CONFIGURED HERE AT ALL — both titles take Tailwind's `leading-tight` and nothing in JS
     * knows or needs to know what that resolves to. There was a `lineHeightMultiplier: 1.25` here mirroring
     * the class so the title ROW could reserve the right height; it is gone, because a ratio duplicated in
     * two languages is a ratio that eventually disagrees. The row now floors itself at `1.25em` against its
     * own font size (see `titleRowMinHeight` in ChartSection), which is the same computation the class does,
     * done once, by the browser.
     *
     * That `em` floor is also what holds the row's height when the TITLE IS HIDDEN and only the track badge
     * is left: the font size sits on the ROW, not on the <h2>, so it is present whether or not the heading
     * renders. The row is the same height in all four show/hide combinations.
     *
     * THE ROW IS SIZED BY THE TITLE AND THE BADGE FOLLOWS IT (see TrackBadge's `matchHeightPx`). The
     * dependency used to run the other way — the row took the badge's intrinsic height and the title's
     * `lineHeight` was pinned to it — which was backwards: the title is the row's primary content and the
     * badge is chrome, and it meant a wrapped title (the name is `flex-1` and has no truncation) took its
     * leading from a pill's padding, which at narrow widths came out as exactly `leading-none`.
     *
     * WRAPPING IS RARE BUT NOT IMPOSSIBLE. MAX_PROFILE_NAME_LENGTH is set to 28 precisely so an ordinary name
     * stays on one line at the app's 350px floor — but that is a character budget, and capitals are far wider
     * than lowercase, so an all-caps name at the limit can still take two lines. This leading has to be a real
     * typographic value for those, not a pill's height.
     */
    title: { labelMultiplier: 1.4 },
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
