import { normalizeTrackVariant, TRACK_VARIANT_UI } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function TrackBadge({ variant, className, size = "sm" }) {
  const track = normalizeTrackVariant(variant);
  const ui = TRACK_VARIANT_UI[track];
  const isLarge = size === "md";

  return (
    <span
      data-chart-export="track-badge"
      className={cn(
        "inline-flex shrink-0 items-center font-medium leading-none",
        isLarge ? "rounded-md px-3 py-1.5 text-sm" : "rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wide",
        ui.pillClass,
        className,
      )}
    >
      {isLarge ? ui.label : ui.shortLabel}
    </span>
  );
}
