export const FE_UI = {
  page: {
    /**
     * Tool tab measure — 455 = 470 (`xs`) − 15 (desktop scrollbar). The chart frame lands 50px inside it:
     * 455 − 24 (tab panel `px-3`) − 24 (card `p-3`) − 2 (card BORDER, 1px each side) = chartMaxWidthPx.
     *
     * THE BORDER IS THE EASY ONE TO MISS. `CARD_PLAIN` carries `border border-slate-200` and everything is
     * `box-sizing: border-box`, so it takes 2px out of the frame's width. Leaving it out of the sum put
     * `chartMaxWidthPx` 2px above what the frame ever measures, which the title exposed: it interpolates to
     * `titleRange.maxPx` AT the cap, so a cap the chart cannot reach meant the title stalled at 17.92 instead
     * of the authored 18.
     *
     * TARGETS THE `xs` BREAKPOINT ON DESKTOP, VIA THE SCROLLBAR. The cap is `max-width: min(455px, 100%)` on the
     * panel, and `100%` resolves against the CONTENT box, which a visible desktop scrollbar has already taken
     * ~15px out of while the viewport keeps counting it. Subtracting the bar here is what lands the column's
     * growth exactly at viewport 470 — the same width `xs:` fires at, so the chart's cap and the type rungs
     * beside it happen at one moment rather than 15px apart.
     *
     * DELIBERATELY IGNORES MOBILE, where there is no persistent bar: the column there stops growing at viewport
     * 455 and leaves the last 15px unused. The rendered chart is the SAME 405px either way, so only the width at
     * which growth stops differs, never the composition. Accepted so one number serves both.
     *
     * The bar is ~15px on macOS and 17 on Windows, so Windows caps ~2px late. Tuned for the former.
     *
     * `minWidthPx` gets NO such subtraction; see the note there for why that is consistent rather than an
     * oversight (each end is compensated for the platform that actually reaches it).
     */
    maxWidthPx: 455,
    /**
     * Layout floor only (page + bottom nav must match). See docs/DECISIONS.md#page-min-width-vs-chart-min-width.
     *
     * NO SCROLLBAR SUBTRACTION HERE, unlike `maxWidthPx` — and the two are not inconsistent. Both constants are
     * content-box widths, and content box = viewport − scrollbar, but they solve that for different unknowns:
     * `maxWidthPx` targets a chosen VIEWPORT (`xs`) so the bar comes off it, while this is a floor whose viewport
     * is merely an outcome. A 350px layout is only ever reached on a phone, where the bar is an overlay and takes
     * no width, so content box == viewport and the floor binds at 350 as written. Below it the page h-scrolls
     * rather than shrinking further.
     *
     * (On a desktop window narrowed to 350 the floor binds at viewport 365, since the bar is 15px there. Nothing
     * targets that number; it falls out.)
     */
    minWidthPx: 350,
    /** Radar frame width at minWidthPx: 350 − 24 (tab panel `px-3`) − 24 (card `p-3`) − 2 (card border) = 300.
        Low end of the label-size ramps and of `getChartWidthUnit`. Same 50px of chrome as `maxWidthPx` — see
        the border note there; this read 302 for a while because the border was left out of the sum. */
    chartMinWidthPx: 300,
    theoryMaxWidthPx: 900,
    /** Radar cap on both tabs — the theory hero caps its wrapper here too, so the two radars stay identical.
        MEASURED, not assumed: `maxWidthPx` − 50 of chrome (see above). Verify with
        `document.querySelector('[data-chart-frame]').getBoundingClientRect().width` after changing either. */
    chartMaxWidthPx: 405,
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
     * CHART TITLE SIZE — two authored endpoints in px, interpolated across chart width by getChartTitleSizePx.
     * `minPx` at `page.chartMinWidthPx` (300), `maxPx` at `page.chartMaxWidthPx` (405).
     *
     * AUTHORED, NOT A RATIO. This was `{ labelMultiplier: 1.4 }` against a shared `chartFonts.chromeRange`
     * reference size, on the reasoning that one number kept the title, badge and legend in proportion by
     * construction. That reasoning is gone: the badge and legend need INTEGER sizes and now carry their own
     * `secondaryLabelRungs`, so the reference had exactly one consumer left — this multiplication — and a
     * reference size that nothing else references is just indirection. It also made the title unsettable: 18px
     * needed `maxPx: 12.857`, since 18/1.4 is not a round number.
     *
     * FRACTIONAL ON PURPOSE, unlike the badge. The title is large enough that a fractional size is invisible,
     * and nothing measures or clips its box, so it can scale smoothly instead of stepping. The badge cannot —
     * see `secondaryLabelRungs` for why its glyphs creep at fractional sizes.
     *
     * `maxPx` IS THE EXPORT'S TITLE SIZE, since `exportImageLayoutWidthPx` equals `page.chartMaxWidthPx`. Keep
     * `opsz` in index.css equal to it (now simply `round(maxPx)` — no multiplication to reproduce).
     *
     * The theory tab's framework title runs off the same function, so the two are equal by construction.
     * Leading is Tailwind's `leading-tight` alone. See docs/DECISIONS.md#chart-type-scale.
     */
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
     * TRACK BADGE + CLUSTER LEGEND SIZE — an authored rung table, read top-down by getChartSecondaryLabelSizePx.
     * `fromChartWidthPx` is the frame width the rung starts at; the last entry omits it and is the floor.
     *
     * INTEGERS, AND BOUNDARIES SOMEONE CHOSE. Both properties are load-bearing and were arrived at the hard way:
     *
     * - Integer, because the badge's glyphs creep at a fractional size. `line-height: round(1.4em, 1px)` keeps
     *   the pill's line box whole, so the PILL holds still, but `align-items: center` splits the leftover
     *   half-leading — which drifts continuously when the font size does (2.319 → 2.113 across chart 355-371).
     *   See docs/DECISIONS.md#badge-ink-centring: "the pill held perfectly still and only the glyphs moved".
     * - Authored, because `Math.round` on a continuous ramp places the boundaries itself, wherever the value
     *   crosses `.5`. On the previous 10→13 curve that was chart 361 and 400 — 59px then 39px apart, uneven and
     *   picked by nobody. That unevenness is what the ramp rewrite was supposed to fix and only reduced.
     *
     * WHY 405 FOR THE TOP RUNG: it is `page.chartMaxWidthPx`, the width the chart reaches at the `xs` breakpoint
     * (viewport 470). In chart-width terms that looks like a one-pixel band; in VIEWPORT terms it is 470 upward,
     * i.e. the whole desktop range, because the chart is pinned at its cap there. Tying it to `xs` is what makes
     * the badge's last step land at the same moment as every `xs:` type rung elsewhere in the app.
     *
     * 355 for the 10→11 step sits mid-band (viewport 420) and is pure taste — move it freely.
     *
     * 10 is the app's common smallest rung — TrackBadge sm, the score cards' labels, the pillar cluster labels and
     * the bottom nav all sit there at base — so the chart's key reads level with the chrome around it rather than
     * a size the rest of the UI never uses. Two things sit a rung BELOW at 9, both for reasons of their own: the
     * score cards' sub-label (an annotation on the value above it, not a label in its own right) and BadgePicker's
     * pill (an `em` box that stands taller than the text beside it, so it needs the smaller font to fit the row).
     */
    secondaryLabelRungs: [
      { fromChartWidthPx: 405, px: 12 },
      { fromChartWidthPx: 355, px: 11 },
      { px: 10 },
    ],
    /** Floor for the rung table above — also the value a malformed table falls back to. */
    secondaryLabelMinPx: 10,
    /** md badge min width (em) — sized for the short "FE"/"BE" label. */
    trackBadgeMdMinWidthEm: 2.75,
    /** Swatch edge length vs legend label font size — just taller than text cap height. */
    legendSwatchLabelMultiplier: 1.2,
    pointLabelPaddingRange: { minPx: 4, maxPx: 8 },
    pointLabelScaleWithChart: true,
    /**
     * Axis-label size ramp, linearly interpolated by getPointLabelSizePxFromRange. Shared by the tool chart and
     * the theory hero radar (which passes it explicitly to override THEORY_CHART_UI's smaller ramp) so the two
     * cannot drift apart. The small career-track charts use the theory preset's own ramp.
     *
     * The low end is 11 rather than 12: these are BOLD labels ringing the radar, and at phone width 12 crowded
     * the canvas — tried again after the width cap moved, and it still does. It stops a rung above the DOM
     * chrome's 10px floor because 10 read thin under `bold` on the canvas, which does not get the DOM's font
     * smoothing. If the labels need more room, the knob is `radarLabelReserved`, which holds space for them
     * rather than shrinking them.
     *
     * `maxWidthPx` tracks `page.chartMaxWidthPx`, so the labels reach `maxPx` exactly at the cap. `maxPx` came
     * down from 15 with that cap: the same type now rings a 405px radar rather than a 526px one, so it reads
     * larger against the circle than the number suggests.
     */
    pointLabelPxRange: { minPx: 11, maxPx: 14, minWidthPx: 300, maxWidthPx: 405 },
    pointLabelWeight: "bold",
    pointLabelColor: "#1e293b",
    pointLabelDimColor: "#1e293b60",
    gridColor: "rgba(0, 0, 0, 0.15)",
    tickLabelColor: "rgba(0, 0, 0, 0.35)",
    centerPointLabels: false,
    tickInitialPx: 12,
    /* 500, not Chart.js's default 400: the L1-L5 digits are small and low-contrast, and the extra weight is
       what keeps them legible against the grid. Any value other than 400/700 must also be preloaded for
       "Inter Tabular" in export-image's FONT_SPECS — canvas synthesises bold but not the interpolated weights,
       and an unloaded weight drops the whole family to system-ui rather than merely rendering thin. */
    tickWeight: 500,
    /* Vertical padding stays tight or the pills collide at the narrowest viewport, where the gap between rings
       has shrunk with the radius. Also feeds radarTickBackdropHalf() and so the scale's reserved layout space. */
    tickBackdropPad: { top: 1.5, bottom: 1.5, left: 2, right: 2 },
    tickBackdropColor: "rgba(255, 255, 255, 0.55)",
    /* THE EXPORT IS RENDERED AT A FIXED WIDTH, not at the viewport's.
       The chart is width-adaptive — label sizes, wrapping and the radar's radius are all derived from the
       width it fitted at and then baked into the bitmap — so capturing at whatever the window happened to be
       made the same profile export at ~2800px from a phone and ~4200px from a desktop, with phone
       proportions baked into the former. Pinning the layout width is what makes an export reproducible.
       MUST EQUAL `page.chartMaxWidthPx` — the width the canvas reaches at the `xs` breakpoint — so the image
       carries the proportions a user actually sees rather than a composition no one is shown. It is also the far
       endpoint of `chart.titleRange`, which is what lets the export render the title at its authored size with no
       rescaling. Not enforced: if `chartMaxWidthPx` moves, move this with it (and `opsz` in index.css). */
    exportImageLayoutWidthPx: 405,
    /* Resolution multiplier on the pinned layout above — pixel dimensions only, no effect on proportion.
       2x is the retina target: one CSS px drawn with two physical ones, so the PNG is sharp displayed at its
       natural size.
       WIDTH IS EXACTLY `(exportImageLayoutWidthPx + exportImagePaddingPx * 2) * scale` — the columns are never
       cropped (see rasterizeChart), so at layout 405 that is 858px at 2x and 1716px at 4x (UHD). HEIGHT is not
       predictable: it is content-driven and then ink-cropped top and bottom, so do not spec one.

       KEEP THESE INTEGERS. 2.5/5 was tried when the layout width dropped to 405, to bring the output back near
       the ~1030px it used to be. It costs pixel-grid alignment — 431 × 2.5 = 1077.5, which rasterizeChart rounds
       to 1078, making the effective scale 2.5012 — and the smallest text (the credit line) is what
       shows it first. The image being physically smaller is the honest consequence of a narrower chart; scale it
       at the point of use instead.
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
    /* Credit line size on the copied image only, in CSS px at `exportImageLayoutWidthPx`. Authored, not derived:
       the export renders at one pinned width, so there is no scale to track. Free to move on taste.
       No band-height constant: the strip is `exportImageAttributionGapPx + this line's measured ink`. */
    exportImageAttributionFontPx: 9,
    /* Space between the content's lowest ink and the credit line's highest — whatever that content is, so the
       gap holds whether the block ends at the cluster legend's border, at a score card, or at a bare axis label
       when both are switched off.
       ORDER MATTERS AND IS SEQUENTIAL: content, this gap, the credit line, and only THEN the uniform
       exportImagePaddingPx around all four sides of that whole block. The white below the credit is therefore
       the margin, not this number. See measureAttribution in utils/copy-chart-image.js.
       Larger than exportImagePaddingPx, and a SEPARATE knob rather than a duplicate of it: this one separates two
       pieces of content, that one is the image's edge. Retune either without touching the other.
       NOT COMPARABLE TO THE `mt-*` ABOVE IT, and this is the trap: the legend and scores blocks space themselves
       BOX to BOX (`mt-4` = 16px), while this is INK to INK. The credit's glyphs start ~2-3px inside their own
       line box, so matching `mt-4` optically means ~18-19 here, not 16.
       WAS 26, tuned when the legend ran 14px on a 526px layout. 20 now: the legend is 12px on 405 and the gap
       above it went 12 → 16, so 26 read detached against the tighter type. 18 was tried once, long ago, and the
       credit read as a second legend row — the credit and the legend are close enough in size that proximity does
       more grouping than the type scale can undo. 20 clears that by a hair while tracking `mt-4`;
       if it regroups with the legend, go up, not down. This is the knob for it, not the credit's colour or weight,
       which are shared with every other footer in the app and stay put. */
    exportImageAttributionGapPx: 20,
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
