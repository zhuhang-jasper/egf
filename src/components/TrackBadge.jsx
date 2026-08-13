import { getChartSecondaryLabelSizePx } from "@/chart/fonts";
import { FE_UI, normalizeAttachedBadge, TRACK_BADGE_UI } from "@/constants";
import { cn } from "@/utils";

/**
 * BOTH SIZES DERIVE THEIR HEIGHT FROM `em` PADDING. md differs from sm only in font size — everything else is
 * one ratio set expressed once, so the two cannot drift and neither needs a height handed to it.
 *
 * md USED TO TAKE A `matchHeightPx` PROP, a px height computed as `round(titleSize * 0.86)` so the pill tracked
 * the chart title's cap height rather than defining the row. IT JITTERED. `getChartTitleSizePx` is deliberately
 * unrounded (see fonts.js) so the type scales smoothly, so rounding a ratio of it flipped the pill's height
 * between two integers as the window resized, and the label re-centred in the new box each time. No ratio fixes
 * that: rounding a continuous number is discontinuous whatever the multiplier. `em` padding has no such step,
 * which is why it is now the only mechanism.
 *
 * Its other purpose is covered without it: the row's floor is `max(1.25em, ...)` against the title's own font
 * size, and `0.86em` is always under `1.25em`, so the badge term never won the `max()` and the pill could not
 * have set the row height anyway.
 *
 * Shared ratios, all against font size:
 *
 *   pad-y   2px    paired with the ink span's leading — see the coupling note below
 *   pad-x   0.85em in `em` so it scales with each size's font rather than being pre-multiplied
 *   min-w   2.75em `trackBadgeMdMinWidthEm`, so "FE" and "BE" are one width at both sizes
 *   radius  0.42em stated once, in `em`, for both sizes
 *
 * The label is a nested span carrying `data-badge-ink`, which carries the leading that centres the glyphs. It
 * has to be a child rather than sitting on the pill, which is the flex container. See
 * docs/DECISIONS.md#badge-ink-centring — including why this is `line-height` and not the more correct
 * `text-box: trim-both cap alphabetic` that was here before it.
 *
 * `py` IS COUPLED TO THAT LEADING, and the two must be changed together. `2px` against the ink span's 1.4 line
 * box, whose half-leading does most of the work of the pill's height. It was briefly `0.45em`, which was correct
 * only while the line box was trimmed to cap height and had no half-leading left to contribute; keeping that
 * ratio once the leading came back would double-count it and the pill would grow.
 *
 * IT IS PX, NOT `em`, AND THAT IS WHY THE PILL NO LONGER JITTERS. An `em` pad-y against a fractional font size
 * lands on a fraction of a device pixel, which is what made the form badges' labels jump while resizing. A whole
 * px does not. pad-x stays `em` because horizontal rounding is invisible here — `min-w` fixes the pill's width.
 */
export function TrackBadge({ variant, className, size = "sm", hidden = false, chartWidth = 0 }) {
  const badge = normalizeAttachedBadge(variant);
  // `none` = no attached badge; render nothing so untracked charts/profiles show no pill.
  if (badge === "none") {
    return null;
  }
  const ui = TRACK_BADGE_UI[badge];
  const isLarge = size === "md";

  // `minWidth` is INLINE, not a `min-w-[...]` class: the value comes from a JS constant, and Tailwind generates
  // arbitrary-value utilities by scanning source text, so an interpolated class name produces no rule at all.
  //
  // `fontSize` IS THE ONLY DIFFERENCE BETWEEN THE SIZES. md scales with the chart so the pill stays in proportion
  // to the title beside it; sm is pinned at the 10px its class sets, since its callers (profile list, badge
  // picker) sit in fixed-size chrome with no chart to track. Every other dimension is an `em` ratio in the class
  // list, so both sizes get the same shape and nothing else needs a branch.
  const scaledBadgeStyle = {
    minWidth: `${FE_UI.chart.trackBadgeMdMinWidthEm}em`,
    ...(isLarge ? { fontSize: getChartSecondaryLabelSizePx(chartWidth || FE_UI.page.minWidthPx) } : null),
  };

  return (
    <span
      data-chart-export="track-badge"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-[0.42em] px-[0.85em] py-[2px]",
        // md carries the heavier weight to hold up beside the title; sm reads as chrome in a list.
        isLarge ? "font-bold" : "text-[10px] font-semibold",
        ui.pillClass,
        hidden && "invisible pointer-events-none",
        className,
      )}
      style={scaledBadgeStyle}
      aria-hidden={hidden || undefined}
    >
      <span data-badge-ink>{ui.shortLabel}</span>
    </span>
  );
}
