import { getChartSecondaryLabelSizePx } from "@/chart/fonts";
import { FE_UI, normalizeAttachedBadge, TRACK_BADGE_UI } from "@/constants";
import { cn } from "@/utils";

/**
 * `matchHeightPx` (md only) makes the pill take a height it is GIVEN rather than deriving one, for the chart
 * title row where the title is the primary content and should set the row height. Only the box follows the
 * title: the font stays on the chart's secondary scale so the badge reads as chrome, not a second title.
 * Vertical padding is dropped when it is set, since `border-box` already lets the height win.
 *
 * sm is md at a smaller font, so the toolbar pill reads as the chart pill shrunk rather than a second design.
 * md is the reference because its size is pinned to the chart. Shared ratios, all against font size:
 *
 *   height  ~1.6x  md is `matchHeightPx` (the title's em box); sm is a trimmed cap box + 2 * 0.45em
 *   pad-x   0.85em in `em` so it scales with sm's font rather than being pre-multiplied
 *   min-w   2.75em `trackBadgeMdMinWidthEm`, so "FE" and "BE" are one width at both sizes
 *   radius  0.42em md computes it in px off its own font; sm states the same ratio in `em`
 *
 * The label is a nested span carrying `data-badge-ink`, which trims its line box to the cap/baseline edges so
 * what the pill centres is the GLYPHS. Both sizes share it, and neither sets leading on the pill: the trim
 * makes the line box the ink's own height, so half-leading has nothing left to bias. See
 * docs/DECISIONS.md#badge-ink-centring. It has to be a child — `text-box-trim` applies to the block holding
 * the text, and the pill is the flex container.
 *
 * sm's `py` IS COUPLED TO THAT TRIM. It was `2px` against a 1.4 line box, whose half-leading was doing most of
 * the work; trimming to cap height took that away and the pill went cramped. `0.45em` puts the height back and
 * scales with the font, as pad-x does. Removing the trim means restoring the leading AND re-deriving this.
 *
 * The radius ratio matches md's but NOT its clamp: md is capped at 4-6px because its font grows with the chart,
 * while sm's font is pinned at 10px, where `0.42em` is 4.2px and inside that range anyway. Unpinning sm's font
 * size is what would make the missing clamp visible.
 */
export function TrackBadge({ variant, className, size = "sm", hidden = false, chartWidth = 0, matchHeightPx = 0 }) {
  const badge = normalizeAttachedBadge(variant);
  // `none` = no attached badge; render nothing so untracked charts/profiles show no pill.
  if (badge === "none") {
    return null;
  }
  const ui = TRACK_BADGE_UI[badge];
  const isLarge = size === "md";
  const scaledLabelPx = getChartSecondaryLabelSizePx(chartWidth || FE_UI.page.minWidthPx);
  const scaledBadgeStyle = isLarge
    ? {
        fontSize: scaledLabelPx,
        minWidth: `${FE_UI.chart.trackBadgeMdMinWidthEm}em`,
        paddingLeft: Math.round(scaledLabelPx * 0.85),
        paddingRight: Math.round(scaledLabelPx * 0.85),
        ...(matchHeightPx
          ? { height: matchHeightPx }
          : {
              paddingTop: Math.round(scaledLabelPx * 0.4),
              paddingBottom: Math.round(scaledLabelPx * 0.4),
            }),
        borderRadius: Math.min(6, Math.max(4, Math.round(scaledLabelPx * 0.42))),
      }
    : // sm takes the SAME min-width as md, in `em` so it resolves against sm's own smaller font. This is
      // what stops "FE" and "BE" rendering at two different widths, and it is the last of md's proportions
      // that sm did not already share.
      { minWidth: `${FE_UI.chart.trackBadgeMdMinWidthEm}em` };

  return (
    <span
      data-chart-export="track-badge"
      className={cn(
        "inline-flex shrink-0 items-center",
        isLarge ? "justify-center font-bold" : "justify-center rounded-[0.42em] px-[0.85em] py-[0.45em] text-[10px] font-semibold",
        !isLarge && "font-medium",
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
