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
 *   height  1.8x   md is `labelPx + 2 * round(labelPx * 0.4)`; sm is a 1.4 line box + 2px
 *   pad-x   0.85em in `em` so it scales with sm's font rather than being pre-multiplied
 *   min-w   2.75em `trackBadgeMdMinWidthEm`, so "FE" and "BE" are one width at both sizes
 *
 * sm sets `leading-[1.4]` because centring the LINE BOX is not centring the INK: at `line-height: 1` there is
 * no half-leading, so all-caps descender-free labels sit high, worse on mobile where `system-ui` resolves to
 * different metrics. md keeps `leading-none` deliberately, since a taller line box would fight the height it
 * is handed. Changing the leading means re-deriving the padding, as the two hold the height ratio together.
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
        isLarge ? "justify-center font-bold leading-none" : "justify-center rounded px-[0.85em] py-[2px] text-[10px] font-semibold leading-[1.4]",
        !isLarge && "font-medium",
        ui.pillClass,
        hidden && "invisible pointer-events-none",
        className,
      )}
      style={scaledBadgeStyle}
      aria-hidden={hidden || undefined}
    >
      {ui.shortLabel}
    </span>
  );
}
