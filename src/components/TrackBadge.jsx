import { getChartSecondaryLabelSizePx } from "@/chart/fonts";
import { FE_UI, normalizeAttachedBadge, TRACK_BADGE_UI } from "@/constants";
import { cn } from "@/utils";

/**
 * `matchHeightPx` (md only) MAKES THE PILL TAKE A HEIGHT IT IS GIVEN rather than deriving its own from its
 * font and padding. It exists for the chart title row, where the badge sits beside the chart title: the title
 * is the primary content there and should set the row's height, with the pill sizing itself to match.
 *
 * The font size is deliberately NOT part of this — it stays on the chart's secondary scale, the same one the
 * cluster legend uses, so the badge still reads as chrome belonging to the chart rather than as a second
 * title. Only the BOX follows the title; the text inside it does not grow.
 *
 * Vertical padding is dropped when this is set. Everything is `border-box`, so an explicit height already
 * wins over padding and keeping both would just be two sources for one number. `items-center` on the pill is
 * what then centres the label in whatever height it was handed.
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
    : undefined;

  return (
    <span
      data-chart-export="track-badge"
      className={cn(
        "inline-flex shrink-0 items-center leading-none",
        isLarge ? "justify-center font-bold" : "rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wide",
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
