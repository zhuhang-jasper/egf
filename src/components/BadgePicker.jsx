import { useEffect, useRef, useState } from "react";

import { ChevronDown } from "lucide-react";

import { useAppStore } from "@/store/useAppStore";

import { LAYER, normalizeAttachedBadge, TRACK_BADGE_OPTIONS, TRACK_BADGE_UI } from "@/constants";
import { cn } from "@/utils";
import { track } from "@/utils/analytics";

/**
 * The colored pill for a badge id — the same rounded FE/BE chip shown on the chart, in miniature.
 * `none` renders its em-dash as muted plain text (no pill) so "no badge" reads as an absence.
 *
 * Keep the box in step with {@link TrackBadge}'s sm size — these two render the same chip in
 * different places and drift between them reads as a bug.
 */
function BadgePill({ id, className }) {
  const ui = TRACK_BADGE_UI[id];
  if (id === "none") {
    return <span className="inline-flex min-w-[1.5em] justify-center text-muted-foreground">{ui.shortLabel}</span>;
  }
  return (
    <span
      className={cn(
        "inline-flex min-w-[2.75em] items-center justify-center rounded-[0.42em] px-[0.85em] py-[2px] text-[10px] font-semibold",
        ui.pillClass,
        className,
      )}
    >
      <span data-badge-ink>{ui.shortLabel}</span>
    </span>
  );
}

/**
 * Compact badge selector rendered as a start adornment inside the profile-name input.
 * Picks the cosmetic FE/BE/— badge attached to the current profile. Changing it marks the draft
 * "modified"; the user must Save to persist the badge into the saved profile.
 *
 * `onOpen` fires just before this menu opens. The picker renders INSIDE the profile combobox's
 * outside-click root, so that menu can't close itself when the badge trigger is clicked — its
 * handler sees an inside click. The combobox passes its own close here so only one of the two
 * dropdowns is ever open; without it they stack and the badge menu paints behind the profile list.
 */
export function BadgePicker({ onOpen }) {
  const attachedBadge = useAppStore((s) => normalizeAttachedBadge(s.attachedBadge));
  const setAttachedBadge = useAppStore((s) => s.setAttachedBadge);
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  const current = TRACK_BADGE_UI[attachedBadge];

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    const onKey = (e) => {
      if (e.key === "Escape") {
        setOpen(false);
      }
    };
    const onMouse = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onMouse);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onMouse);
    };
  }, [open]);

  const select = (next) => {
    setOpen(false);
    if (next !== attachedBadge) {
      track("track_switched", { attached_badge: next });
    }
    setAttachedBadge(next);
  };

  return (
    <div ref={rootRef} className="absolute left-0 top-0 flex h-full items-center">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Attached badge: ${current.label}`}
        onClick={() => {
          if (!open) {
            onOpen?.();
          }
          setOpen((v) => !v);
        }}
        className="my-1.5 flex h-[calc(100%-0.75rem)] cursor-pointer items-center gap-1 border-r border-border pl-2.5 pr-1.5 text-muted-foreground hover:text-foreground"
      >
        <BadgePill id={attachedBadge} />
        <ChevronDown className="h-4 w-4 opacity-60" />
      </button>
      {open ? (
        <div
          role="menu"
          aria-label="Attached badge"
          className={cn("absolute left-0 top-[calc(100%+4px)] flex min-w-[9rem] flex-col overflow-hidden rounded-lg border border-border bg-card py-1 shadow-md", LAYER.dropdown)}
        >
          {TRACK_BADGE_OPTIONS.map((id) => {
            const ui = TRACK_BADGE_UI[id];
            return (
              <button
                key={id}
                type="button"
                role="menuitemradio"
                aria-checked={attachedBadge === id}
                onClick={() => select(id)}
                className={cn(
                  "flex cursor-pointer select-none items-center gap-3 px-3 py-1.5 text-left text-xs hover:bg-muted/60",
                  attachedBadge === id && "font-semibold",
                )}
              >
                {/* A notch smaller than the trigger's pill: the row's label is `text-xs`, and at the shared
                    10px the pill's ~1.6em box stands taller than the 12px text it sits beside. Every dimension
                    is in `em`, so the font size is the only lever needed — the shape scales with it. */}
                <span className="inline-flex w-7 shrink-0 justify-center">
                  <BadgePill id={id} className="text-[9px]" />
                </span>
                <span className={cn(attachedBadge === id ? "text-foreground" : "text-muted-foreground")}>{ui.label}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
