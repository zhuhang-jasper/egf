import { getChartSecondaryLabelSizePx } from "@/chart/fonts";
import { FE_UI, normalizeAttachedBadge, TRACK_BADGE_UI } from "@/constants";
import { cn } from "@/utils";

/**
 * md and sm differ only in font size; every other dimension is an `em` ratio, so neither needs a height.
 *
 * Vertical terms must stay whole pixels or the label jitters on resize — see
 * docs/DECISIONS.md#badge-ink-centring. That covers `py-[2px]`, its coupling to the ink span's leading, and why
 * the pill takes no explicit height.
 */
export function TrackBadge({ variant, className, size = "sm", hidden = false, chartWidth = 0 }) {
  const badge = normalizeAttachedBadge(variant);
  // `none` = no attached badge; render nothing so untracked charts/profiles show no pill.
  if (badge === "none") {
    return null;
  }
  const ui = TRACK_BADGE_UI[badge];
  const isLarge = size === "md";

  // `minWidth` inline, not `min-w-[...]`: Tailwind scans source text, so an interpolated class name emits no rule.
  // md's font scales with the chart to stay in proportion to the title; sm keeps the 10px its class sets.
  const scaledBadgeStyle = {
    minWidth: `${FE_UI.chart.trackBadgeMdMinWidthEm}em`,
    ...(isLarge ? { fontSize: getChartSecondaryLabelSizePx(chartWidth || FE_UI.page.chartMinWidthPx) } : null),
  };

  return (
    <span
      data-chart-export="track-badge"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-[0.42em] px-[0.85em] py-[2px]",
        // md carries the heavier weight to hold up beside the title; sm reads as chrome in a list.
        // sm scales on the same ramp as BadgePill's trigger (same chip, same size) and as the dropdown
        // row it sits in. md is driven by `chartWidth` instead — breakpoints there would reach the export.
        isLarge ? "font-bold" : "text-[10px] sm:text-[11px] md:text-[12px] font-semibold",
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
