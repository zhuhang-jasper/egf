import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { ChevronDown, Trash2 } from "lucide-react";

import { BadgePicker } from "@/components/BadgePicker";
import { TrackBadge } from "@/components/TrackBadge";
import { Input } from "@/components/ui/input";
import { Tooltip } from "@/components/ui/Tooltip";

import { useAppStore } from "@/store/useAppStore";

import { MAX_PROFILE_NAME_LENGTH, normalizeAttachedBadge, TRACK_BADGE_OPTIONS, TRACK_BADGE_UI } from "@/constants";
import { cn } from "@/utils";
import { track } from "@/utils/analytics";

// Badge group order: the real badges (fe, be) in badge-dropdown order first, then "no badge" last.
const BADGE_SORT_ORDER = TRACK_BADGE_OPTIONS.filter((b) => b !== "none").concat("none");

// Rank a profile's badge for grouping — lower sorts first; "none" always ranks last.
function badgeRank(badge) {
  const i = BADGE_SORT_ORDER.indexOf(normalizeAttachedBadge(badge));
  return i === -1 ? BADGE_SORT_ORDER.length : i;
}

// Rows shown before the list scrolls; the trailing ".5" leaves the next row half-visible so users
// can tell there's more below (the standard "peek" scroll affordance). Ported from ProfilePicker.
const VISIBLE_ROWS = 6.5;

// Marquee scroll speed (px/sec) for names too long to fit — lower is slower/calmer.
const MARQUEE_SPEED_PX_PER_SEC = 45;
// Gap between the two looping copies of a scrolling name, so it doesn't read as one run-on word.
const MARQUEE_GAP_PX = 40;

/**
 * A profile name that fits normally, but scrolls like an LED sign when it's wider than the space
 * available (once the dropdown has grown to its page-width cap). Measures on mount/resize/label
 * change; only overflowing labels animate, and the speed is proportional to length so long names
 * don't whip past. When it fits, it renders as a plain (non-truncated) span.
 *
 * `deps` lets the caller force a re-measure when layout that affects width changes (e.g. the list
 * opening, or the row count changing the scrollbar).
 */
function ScrollingLabel({ label, className, deps }) {
  const boxRef = useRef(null);
  const textRef = useRef(null);
  const [overflow, setOverflow] = useState(0); // scrollWidth − clientWidth, in px (0 = fits)

  useLayoutEffect(() => {
    const measure = () => {
      const box = boxRef.current;
      const text = textRef.current;
      if (!box || !text) {
        return;
      }
      // Measure the single (un-duplicated) text width against the box's inner width.
      setOverflow(Math.max(0, Math.ceil(text.scrollWidth - box.clientWidth)));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [label, deps]);

  const scrolling = overflow > 0;

  if (!scrolling) {
    return (
      <span ref={boxRef} className={cn("block min-w-0 flex-1 overflow-hidden whitespace-nowrap", className)}>
        <span ref={textRef} className="inline-block">
          {label}
        </span>
      </span>
    );
  }

  // Each copy carries the gap as trailing padding, so one "unit" = textWidth + gap. Two units make
  // the track; translateX(-50%) then lands the second unit exactly where the first started → seamless.
  const textWidth = textRef.current?.scrollWidth ?? 0;
  const durationSec = Math.max(4, (textWidth + MARQUEE_GAP_PX) / MARQUEE_SPEED_PX_PER_SEC);
  const copyStyle = { paddingRight: `${MARQUEE_GAP_PX}px` };

  return (
    <span ref={boxRef} className={cn("block min-w-0 flex-1 overflow-hidden whitespace-nowrap", className)}>
      <span className="marquee-track" style={{ animationDuration: `${durationSec}s` }}>
        {/* First copy is the one we measure; the duplicate makes the loop seamless. */}
        <span ref={textRef} className="inline-block" style={copyStyle}>
          {label}
        </span>
        <span aria-hidden className="inline-block" style={copyStyle}>
          {label}
        </span>
      </span>
    </span>
  );
}

/**
 * The profile name field, doubling as a searchable load/browse/delete combobox.
 *
 * The input is bound to the store's `title` — the same value serves as the draft name to save AND
 * the search query, which is the whole point of the merge. Typing filters the saved-profile list
 * (case-insensitive substring, sorted A–Z); an empty query lists everything so it still works as a
 * browse-all picker. Clicking (or ↓/↑+Enter on) a row loads that profile; the trailing bin deletes
 * it with the usual Undo toast.
 *
 * Saving is deliberately NOT handled here — the status-aware Save button next to this input owns
 * Save/Rename/Update + the collision dialog, so this popover is a pure load/browse/delete surface.
 */
export function ProfileCombobox({ titleError = false }) {
  const title = useAppStore((s) => s.title);
  const setTitle = useAppStore((s) => s.setTitle);
  const profiles = useAppStore((s) => s.profiles);
  const loadProfile = useAppStore((s) => s.loadProfile);
  const deleteProfileWithUndo = useAppStore((s) => s.deleteProfileWithUndo);
  const activeSavedProfileId = useAppStore((s) => s.activeSavedProfileId);

  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const [listMaxHeight, setListMaxHeight] = useState(null);
  const [openUp, setOpenUp] = useState(false);

  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const menuRef = useRef(null);
  // True only for keyboard-driven highlight moves, so the scroll-into-view effect fires for arrow
  // keys but NOT for mouse hover (hovering a partially-visible row shouldn't yank the scrollbar).
  const keyboardMoveRef = useRef(false);

  // The name of the currently-loaded profile, if any. When the input still holds exactly that name
  // the user isn't searching — they just have a profile loaded — so we browse the full list rather
  // than filter down to the single self-match (which reads as a broken one-item dropdown).
  const activeTitle = profiles.find((p) => p.id === activeSavedProfileId)?.title;
  const q = title.trim().toLowerCase();
  const browsingAll = q === "" || (activeTitle != null && q === String(activeTitle).trim().toLowerCase());

  // Filtered rows, grouped by badge (badge-dropdown order) then A–Z within each group. Storage
  // hands us profiles newest-first; we re-sort for display only.
  const rows = useMemo(
    () =>
      profiles
        .filter((p) => browsingAll || String(p.title).toLowerCase().includes(q))
        .sort((a, b) => {
          const byBadge = badgeRank(a.attachedBadge) - badgeRank(b.attachedBadge);
          if (byBadge !== 0) {
            return byBadge;
          }
          return String(a.title).localeCompare(String(b.title), undefined, { sensitivity: "base" });
        }),
    [profiles, q, browsingAll],
  );

  // Close + reset the keyboard highlight.
  const close = () => {
    setOpen(false);
    setHighlight(-1);
  };

  const handleLoad = (pr) => {
    loadProfile(pr.id);
    track("profile_loaded", { attached_badge: pr.attachedBadge });
    close();
  };

  // Outside-click + Escape close (ported from ProfilePicker).
  useEffect(() => {
    if (!open) {
      return undefined;
    }
    const onKey = (e) => {
      if (e.key === "Escape") {
        close();
        inputRef.current?.focus();
      }
    };
    const onMouse = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        close();
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onMouse);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onMouse);
    };
  }, [open]);

  // Position + size the popover on open (and on resize). Prefer opening downward, but flip up when
  // there isn't room below and there's more above (e.g. the input scrolled near the page bottom).
  // Then cap the scrollable list to ~6.5 rows or the space on the chosen side, so a row peeks and
  // the menu never spills off-screen. Mirrors ProfilePicker's old logic.
  useLayoutEffect(() => {
    if (!open) {
      setOpenUp(false);
      setListMaxHeight(null);
      return;
    }
    const decide = () => {
      const list = listRef.current;
      const root = rootRef.current;
      const menu = menuRef.current;
      if (!list || !root || !menu) {
        return;
      }
      const gap = 4;
      const margin = 8; // keep the menu clear of the viewport edge
      const rootRect = root.getBoundingClientRect();
      // Natural (uncapped) menu height, so the flip decision isn't skewed by a prior cap.
      const naturalHeight = menu.scrollHeight;
      // When opening upward the menu must not rise above the sticky tab bar (it renders below the
      // header in stacking order, so overflow past it just gets covered).
      const tabBar = document.getElementById("app-shell-tab-bar");
      const topBoundary = tabBar ? Math.max(0, tabBar.getBoundingClientRect().bottom) : 0;
      const spaceBelow = window.innerHeight - rootRect.bottom - gap - margin;
      const spaceAbove = rootRect.top - topBoundary - gap - margin;
      // Prefer down; flip up only when it won't fit below but there's more room above.
      const up = naturalHeight > spaceBelow && spaceAbove > spaceBelow;
      const available = Math.floor(up ? spaceAbove : spaceBelow);
      setOpenUp(up);

      const firstRow = list.firstElementChild;
      const rowH = firstRow ? firstRow.getBoundingClientRect().height : 0;
      // List box padding (py-1) + bottom border, so the peek math targets the content area.
      const listChrome = list.offsetHeight - list.clientHeight + 8;
      const peekRows = rowH > 0 ? Math.round(VISIBLE_ROWS * rowH + listChrome) : Infinity;
      const listCap = Math.min(peekRows, available);
      const naturalListH = list.scrollHeight;
      setListMaxHeight(naturalListH <= listCap ? null : Math.max(0, listCap));
    };
    decide();
    window.addEventListener("resize", decide);
    return () => window.removeEventListener("resize", decide);
  }, [open, rows.length]);

  // Redirect wheel events over the popover to the inner list and swallow them so the page behind
  // never scrolls. Native non-passive listener because React's onWheel is passive (preventDefault
  // is a no-op there). Ported from ProfilePicker.
  useEffect(() => {
    const root = rootRef.current;
    if (!open || !root) {
      return undefined;
    }
    const onWheel = (e) => {
      const list = listRef.current;
      if (list) {
        list.scrollTop += e.deltaY;
      }
      e.preventDefault();
    };
    root.addEventListener("wheel", onWheel, { passive: false });
    return () => root.removeEventListener("wheel", onWheel);
  }, [open]);

  // Keep the highlighted row scrolled into view as the user arrows through the list — but only for
  // keyboard moves. Mouse hover also sets `highlight`, and scrolling then would auto-yank a
  // partially-visible hovered row into full view, which is jarring.
  useEffect(() => {
    if (!open || highlight < 0 || !keyboardMoveRef.current) {
      keyboardMoveRef.current = false;
      return;
    }
    keyboardMoveRef.current = false;
    const list = listRef.current;
    const row = list?.children?.[highlight];
    row?.scrollIntoView({ block: "nearest" });
  }, [highlight, open]);

  const handleKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      keyboardMoveRef.current = true;
      if (!open) {
        setOpen(true);
        setHighlight(rows.length > 0 ? 0 : -1);
        return;
      }
      setHighlight((h) => (rows.length === 0 ? -1 : Math.min(h + 1, rows.length - 1)));
    } else if (e.key === "ArrowUp") {
      if (!open) {
        return;
      }
      e.preventDefault();
      keyboardMoveRef.current = true;
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      // Enter loads the highlighted row only. Saving stays the Save button's job, so a plain Enter
      // with nothing highlighted is left alone (no accidental save).
      if (open && highlight >= 0 && rows[highlight]) {
        e.preventDefault();
        handleLoad(rows[highlight]);
      }
    } else if (e.key === "Escape") {
      // Handled by the document listener too, but stop it bubbling to any parent handlers.
      if (open) {
        e.stopPropagation();
      }
    }
  };

  const activeRowId = `profile-option-${highlight}`;

  return (
    <div ref={rootRef} className="relative min-w-0 flex-1">
      <BadgePicker />
      <Input
        ref={inputRef}
        id="chart-title-input"
        value={title}
        placeholder="Enter a name"
        maxLength={MAX_PROFILE_NAME_LENGTH}
        // Native <input> with role="combobox" is the WAI-ARIA combobox pattern; a native
        // <input>/<select> tag can't hold this custom listbox, so prefer-tag-over-role doesn't apply.
        // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
        role="combobox"
        tabIndex={0}
        aria-invalid={titleError}
        aria-expanded={open}
        aria-controls="profile-combobox-list"
        aria-autocomplete="list"
        aria-activedescendant={open && highlight >= 0 ? activeRowId : undefined}
        onChange={(e) => {
          setTitle(e.target.value);
          setOpen(true);
          setHighlight(-1);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          const trimmed = title.trim();
          if (trimmed !== title) {
            setTitle(trimmed);
          }
        }}
        className={cn("pl-16 pr-9 shadow-none", titleError && "border-red-500 focus-visible:ring-red-500/40")}
      />
      {/* Right adornment: a single browse caret that toggles the list (rotates when open). The
          combobox is the picker now, so there's no separate clear-X — the caret is always shown. */}
      <button
        type="button"
        aria-label="Browse saved profiles"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => {
          setOpen((v) => !v);
          inputRef.current?.focus();
        }}
        className="group absolute right-0 top-0 flex h-full w-7 items-center justify-center text-muted-foreground hover:text-foreground"
      >
        <ChevronDown className={cn("h-4 w-4 opacity-60 transition-transform", open && "rotate-180")} />
        {open ? null : <Tooltip text="Browse profiles" />}
      </button>
      {open ? (
        // Sizes to the widest row (w-max), never narrower than the input (min-w-full) nor wider than
        // the page (max-w-[calc(100vw-2rem)]); a name past that cap scrolls (see ScrollingLabel).
        // Flips above the input when there's no room below (see the positioning effect).
        <div
          ref={menuRef}
          className={cn(
            "absolute left-0 z-50 flex w-max min-w-full max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-lg border border-border bg-card shadow-md",
            openUp ? "bottom-[calc(100%+4px)]" : "top-[calc(100%+4px)]",
          )}
        >
          {rows.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">{browsingAll ? "No saved profiles yet." : "No matches."}</p>
          ) : (
            <ul
              ref={listRef}
              // ARIA combobox listbox: a <ul>/<li> carrying listbox/option roles, since a native
              // <select>/<option> can't hold the badge + name + delete-button row layout.
              // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role, jsx-a11y/no-noninteractive-element-to-interactive-role
              role="listbox"
              id="profile-combobox-list"
              aria-label="Saved profiles"
              className="m-0 min-h-0 flex-1 list-none overflow-auto p-0 py-1"
              style={{ maxHeight: listMaxHeight != null ? `${listMaxHeight}px` : undefined }}
            >
              {rows.map((pr, i) => {
                const label = String(pr.title).trim() || "(Untitled)";
                const isActive = pr.id === activeSavedProfileId;
                const isHighlighted = i === highlight;
                return (
                  <li
                    key={pr.id}
                    id={`profile-option-${i}`}
                    // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role, jsx-a11y/no-noninteractive-element-to-interactive-role
                    role="option"
                    aria-selected={isHighlighted}
                    aria-current={isActive ? "true" : undefined}
                    // Three distinct, non-conflicting states:
                    //  - hover: a soft transient tint.
                    //  - active/loaded: solid tint + left accent bar + bold label ("now playing").
                    //  - keyboard highlight: an inset primary ring + firmer tint. The ring is an
                    //    outline (not a background), so it layers cleanly on top of the active row
                    //    rather than competing with its tint.
                    className={cn(
                      "relative flex items-stretch pr-2 hover:bg-muted/60",
                      isActive && "bg-muted before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-primary hover:bg-muted",
                      isHighlighted && "z-10 bg-accent ring-2 ring-inset ring-primary/40 hover:bg-accent",
                    )}
                  >
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 cursor-pointer items-center py-2 pl-0 pr-3 text-left text-sm"
                      onMouseEnter={() => setHighlight(i)}
                      onClick={() => handleLoad(pr)}
                    >
                      {/* Badge slot spans from the row's left edge to where the input text starts
                          (pl-16 = 4rem), with the badge/dash centered in it — so it visually sits
                          under the input's badge adornment. No-badge rows show an em-dash. */}
                      <span className="flex w-16 shrink-0 items-center justify-center">
                        {normalizeAttachedBadge(pr.attachedBadge) === "none" ? (
                          <span className="text-muted-foreground">{TRACK_BADGE_UI.none.shortLabel}</span>
                        ) : (
                          <TrackBadge variant={pr.attachedBadge} />
                        )}
                      </span>
                      <ScrollingLabel label={label} deps={open} className={cn(isActive && "font-semibold text-foreground")} />
                    </button>
                    <button
                      type="button"
                      className="flex w-9 shrink-0 cursor-pointer items-center justify-center rounded-md text-destructive hover:bg-destructive/10"
                      aria-label={`Remove profile ${label}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteProfileWithUndo(pr.id);
                        track("profile_deleted", { attached_badge: pr.attachedBadge });
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
