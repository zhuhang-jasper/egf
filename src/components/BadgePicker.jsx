import { useEffect, useRef, useState } from "react";

import { ChevronDown } from "lucide-react";

import { useAppStore } from "@/store/useAppStore";

import { normalizeAttachedBadge, TRACK_BADGE_OPTIONS, TRACK_BADGE_UI } from "@/constants";
import { cn } from "@/utils";
import { track } from "@/utils/analytics";

/**
 * The colored pill for a badge id — the same rounded FE/BE chip shown on the chart, in miniature.
 * `none` renders its em-dash as muted plain text (no pill) so "no badge" reads as an absence.
 */
function BadgePill({ id }) {
  const ui = TRACK_BADGE_UI[id];
  if (id === "none") {
    return <span className="inline-flex min-w-[1.5em] justify-center text-muted-foreground">{ui.shortLabel}</span>;
  }
  return (
    <span className={cn("inline-flex items-center justify-center rounded px-1.5 py-0.5 text-[10px] font-semibold leading-none tracking-wide", ui.pillClass)}>
      {ui.shortLabel}
    </span>
  );
}

/**
 * Compact badge selector rendered as a start adornment inside the profile-name input.
 * Picks the cosmetic FE/BE/— badge attached to the current profile. Changing it marks the draft
 * "modified"; the user must Save to persist the badge into the saved profile.
 */
export function BadgePicker() {
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
        title="Attached badge"
        onClick={() => setOpen((v) => !v)}
        className="my-1.5 flex h-[calc(100%-0.75rem)] items-center gap-1 border-r border-border pl-2.5 pr-1.5 text-muted-foreground hover:text-foreground"
      >
        <BadgePill id={attachedBadge} />
        <ChevronDown className="h-3 w-3 opacity-60" />
      </button>
      {open ? (
        <div
          role="menu"
          aria-label="Attached badge"
          className="absolute left-0 top-[calc(100%+4px)] z-50 flex min-w-[9rem] flex-col overflow-hidden rounded-lg border border-border bg-card py-1 shadow-md"
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
                  "flex cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-muted/60",
                  attachedBadge === id && "font-semibold",
                )}
              >
                <span className="inline-flex min-w-[1.75em] justify-center">
                  <BadgePill id={id} />
                </span>
                <span className="text-muted-foreground">{ui.label}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
