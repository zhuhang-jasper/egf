import { TRACK_VARIANT_UI, TRACK_VARIANTS } from "@/lib/constants";
import { cn } from "@/lib/utils";

import { useAppStore } from "@/store/useAppStore";

export function TrackToggle() {
  const trackVariant = useAppStore((s) => s.trackVariant);
  const setTrackVariant = useAppStore((s) => s.setTrackVariant);
  const isBe = trackVariant === "be";

  return (
    <fieldset className="m-0 inline-flex shrink-0 border-0 p-0">
      <legend className="sr-only">Product pillar track: front-end or back-end</legend>
      <div className="relative inline-flex h-8 w-max rounded-full border border-border bg-muted/70 p-0.5">
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute top-0.5 bottom-0.5 w-[calc(50%-0.25rem)] rounded-full transition-[left,background-color] duration-200 ease-out",
            isBe ? "left-[calc(50%+0.0625rem)]" : "left-0.5",
            TRACK_VARIANT_UI[trackVariant].toggleActiveClass,
          )}
        />
        {TRACK_VARIANTS.map((id) => (
          <button
            key={id}
            type="button"
            className={cn(
              "relative z-10 flex-1 basis-0 cursor-pointer rounded-full px-2.5 text-xs font-medium whitespace-nowrap transition-colors",
              trackVariant === id ? "text-white" : "text-muted-foreground hover:text-foreground/80",
            )}
            aria-pressed={trackVariant === id}
            onClick={() => setTrackVariant(id)}
          >
            {TRACK_VARIANT_UI[id].label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
