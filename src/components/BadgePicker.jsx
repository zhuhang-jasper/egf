import { useRef, useState } from "react";

import { ChevronDown } from "lucide-react";

import { MenuPanel } from "@/components/ui/menu-panel";

import { useMenuPosition } from "@/hooks/useMenuPosition";

import { useAppStore } from "@/store/useAppStore";

import { normalizeAttachedBadge, TRACK_BADGE_OPTIONS, TRACK_BADGE_UI } from "@/constants";
import { CONTROL_TEXT } from "@/styles/control-typography";
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
        // Every dimension above is in `em`, so these sizes are the only lever — the shape scales with them.
        "inline-flex min-w-[2.75em] items-center justify-center rounded-[0.42em] px-[0.85em] py-[2px] font-semibold",
        "text-[10px] sm:text-[11px] md:text-[12px]",
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
  const menuRef = useRef(null);

  const current = TRACK_BADGE_UI[attachedBadge];
  const { openUp } = useMenuPosition({ open, onClose: () => setOpen(false), rootRef, menuRef });

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
        // WIDTH IS LOAD-BEARING: the profile-name input's `pl-*` is sized to clear this trigger, and
        // is ramped because the pill inside it scales. Change anything here and re-check that padding.
        className="my-1.5 flex h-[calc(100%-0.75rem)] cursor-pointer items-center gap-1 border-r border-border pl-2.5 pr-1.5 text-muted-foreground hover:text-foreground"
      >
        <BadgePill id={attachedBadge} />
        <ChevronDown className="h-4 w-4 opacity-60" />
      </button>
      {open ? (
        <MenuPanel ref={menuRef} openUp={openUp} padded role="menu" aria-label="Attached badge" className="min-w-[9rem]">
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
                  "flex cursor-pointer select-none items-center gap-3 px-3 py-1.5 text-left hover:bg-muted/60",
                  CONTROL_TEXT,
                  attachedBadge === id && "font-semibold",
                )}
              >
                {/* A notch smaller than the trigger's pill at every width: at the shared size the pill's
                    ~1.6em box stands taller than the row label it sits beside. */}
                <span className="inline-flex w-7 shrink-0 justify-center">
                  <BadgePill id={id} className="text-[9px] sm:text-[10px] md:text-[11px]" />
                </span>
                <span className={cn(attachedBadge === id ? "text-foreground" : "text-muted-foreground")}>{ui.label}</span>
              </button>
            );
          })}
        </MenuPanel>
      ) : null}
    </div>
  );
}
