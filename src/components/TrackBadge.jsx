import { getChartPointLabelSizePx } from "@/lib/chart/fonts";
import { FE_UI, normalizeTrackVariant, TRACK_VARIANT_UI } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function TrackBadge({ variant, className, size = "sm", hidden = false, chartWidth = 0 }) {
  const track = normalizeTrackVariant(variant);
  const ui = TRACK_VARIANT_UI[track];
  const isLarge = size === "md";
  const scaledLabelPx = getChartPointLabelSizePx(chartWidth || FE_UI.page.minWidthPx);
  const scaledBadgeStyle = isLarge
    ? {
        fontSize: scaledLabelPx,
        paddingLeft: Math.round(scaledLabelPx * 0.85),
        paddingRight: Math.round(scaledLabelPx * 0.85),
        paddingTop: Math.round(scaledLabelPx * 0.4),
        paddingBottom: Math.round(scaledLabelPx * 0.4),
      }
    : undefined;

  return (
    <span
      data-chart-export="track-badge"
      className={cn(
        "inline-flex shrink-0 items-center leading-none",
        isLarge ? "rounded-md font-bold" : "rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wide",
        !isLarge && "font-medium",
        ui.pillClass,
        hidden && "invisible pointer-events-none",
        className,
      )}
      style={scaledBadgeStyle}
      aria-hidden={hidden || undefined}
    >
      {isLarge ? ui.label : ui.shortLabel}
    </span>
  );
}
