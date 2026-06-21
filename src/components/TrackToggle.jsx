import { ArrowLeftRight } from "lucide-react";

import { useAppStore } from "@/store/useAppStore";

import { TRACK_VARIANT_UI, TRACK_VARIANTS } from "@/constants";
import { cn } from "@/utils";

export function TrackToggle() {
  const trackVariant = useAppStore((s) => s.trackVariant);
  const setTrackVariant = useAppStore((s) => s.setTrackVariant);
  const isBe = trackVariant === "be";

  return (
    <fieldset className="m-0 inline-flex shrink-0 border-0 p-0">
      <legend className="sr-only">Product pillar track: front-end or back-end</legend>
      <div className="relative inline-flex h-8 w-45 rounded-md border border-border bg-muted-foreground/20 p-0.5">
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute top-0.5 bottom-0.5 w-[calc(50%-0.25rem)] rounded-[5px] transition-[left,background-color] duration-200 ease-out",
            isBe ? "left-[calc(50%+0.0625rem)]" : "left-0.5",
            TRACK_VARIANT_UI[trackVariant].toggleActiveClass,
          )}
        />
        <button
          type="button"
          aria-label={`Switch to ${TRACK_VARIANT_UI[isBe ? "fe" : "be"].label}`}
          onClick={() => setTrackVariant(isBe ? "fe" : "be")}
          className="group absolute left-1/2 top-1/2 z-20 flex size-7 -translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center"
        >
          <span className="flex size-4 items-center justify-center rounded-full border border-border bg-muted text-muted-foreground transition-colors group-hover:bg-background group-hover:text-foreground">
            <ArrowLeftRight className="size-2.5" />
          </span>
        </button>
        {TRACK_VARIANTS.map((id) => (
          <button
            key={id}
            type="button"
            className={cn(
              "relative z-10 flex-1 basis-0 cursor-pointer rounded-[5px] px-2.5 text-xs whitespace-nowrap transition-colors",
              trackVariant === id ? "font-semibold text-foreground" : "font-medium text-muted-foreground hover:text-foreground/80",
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
