import { TRACK_VARIANT_UI, normalizeTrackVariant } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function TrackBadge({ variant, className }) {
  const track = normalizeTrackVariant(variant);
  const ui = TRACK_VARIANT_UI[track];

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-[10px] font-semibold leading-none tracking-wide",
        ui.pillClass,
        className,
      )}
    >
      {ui.shortLabel}
    </span>
  );
}
