import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { ChevronDown, Search, Trash2 } from "lucide-react";

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
 * The profile name field plus a browse/load/delete dropdown.
 *
 * Two intents are kept deliberately SEPARATE (an earlier "type in the field = search" combobox
 * conflated them and broke naming): the name <Input> is only for naming/creating the draft — it
 * never filters and never auto-opens anything. Browsing is a distinct surface: the caret opens a
 * dropdown that has its OWN search box at the top; searching, keyboard nav, load and delete all
 * live there. Picking a row loads it; the trailing bin deletes it with the usual Undo toast.
 *
 * Saving is NOT handled here — the status-aware Save button next to this input owns
 * Save/Rename/Update + the collision dialog.
 */
export function ProfileCombobox({ titleError = false }) {
  const title = useAppStore((s) => s.title);
  const setTitle = useAppStore((s) => s.setTitle);
  const profiles = useAppStore((s) => s.profiles);
  const loadProfile = useAppStore((s) => s.loadProfile);
  const deleteProfileWithUndo = useAppStore((s) => s.deleteProfileWithUndo);
  const activeSavedProfileId = useAppStore((s) => s.activeSavedProfileId);
  const restoreDraft = useAppStore((s) => s.restoreDraft);
  const showToast = useAppStore((s) => s.showToast);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(""); // the dropdown's own search text — independent of the name
  const [highlight, setHighlight] = useState(-1);
  const [listMaxHeight, setListMaxHeight] = useState(null);
  const [openUp, setOpenUp] = useState(false);

  const rootRef = useRef(null);
  const inputRef = useRef(null); // the name <Input>
  const searchRef = useRef(null); // the dropdown's search box
  const listRef = useRef(null);
  const menuRef = useRef(null);
  // True only for keyboard-driven highlight moves, so the scroll-into-view effect fires for arrow
  // keys but NOT for mouse hover (hovering a partially-visible row shouldn't yank the scrollbar).
  const keyboardMoveRef = useRef(false);

  // Filtered rows (by the dropdown's search box), grouped by badge (badge-dropdown order) then A–Z
  // within each group. Storage hands us profiles newest-first; we re-sort for display only.
  const q = query.trim().toLowerCase();
  const rows = useMemo(
    () =>
      profiles
        .filter((p) => q === "" || String(p.title).toLowerCase().includes(q))
        .sort((a, b) => {
          const byBadge = badgeRank(a.attachedBadge) - badgeRank(b.attachedBadge);
          if (byBadge !== 0) {
            return byBadge;
          }
          return String(a.title).localeCompare(String(b.title), undefined, { sensitivity: "base" });
        }),
    [profiles, q],
  );

  // Open the dropdown fresh (search cleared, showing all) and focus its search box.
  const openDropdown = () => {
    setQuery("");
    setHighlight(-1);
    setOpen(true);
    // Focus after the popover mounts.
    requestAnimationFrame(() => searchRef.current?.focus());
  };

  // Close + reset the search box and keyboard highlight.
  const close = () => {
    setOpen(false);
    setQuery("");
    setHighlight(-1);
  };

  const handleLoad = (pr) => {
    // The already-loaded profile isn't loadable — it's the current draft. Just close.
    if (pr.id === activeSavedProfileId) {
      close();
      return;
    }
    const result = loadProfile(pr.id);
    track("profile_loaded", { attached_badge: pr.attachedBadge });
    close();
    // If the load discarded unsaved work, warn that those changes were lost and offer an Undo that
    // restores the pre-load draft. A clean/"saved" draft or a no-op reload has nothing to recover.
    if (result?.hadUnsavedChanges) {
      // Name what was lost when it had a title, so the warning is concrete.
      const prevName = String(result.undo.title).trim();
      const message = prevName ? `Unsaved changes to “${prevName}” were discarded` : "Unsaved changes to your draft were discarded";
      showToast(message, {
        variant: "dark",
        duration: 10000,
        action: {
          label: "Undo",
          onAction: () => {
            restoreDraft(result.undo);
            track("profile_load_undone");
          },
        },
      });
    }
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

      // The search box (menu's first child) is a non-scrolling sibling above the list — reserve its
      // height so the whole popover, not just the list, fits within the available space.
      const searchBox = menu.firstElementChild;
      const searchH = searchBox ? searchBox.getBoundingClientRect().height : 0;
      const firstRow = list.firstElementChild;
      const rowH = firstRow ? firstRow.getBoundingClientRect().height : 0;
      // List box padding (py-1) + bottom border, so the peek math targets the content area.
      const listChrome = list.offsetHeight - list.clientHeight + 8;
      const peekRows = rowH > 0 ? Math.round(VISIBLE_ROWS * rowH + listChrome) : Infinity;
      const listCap = Math.min(peekRows, Math.max(0, available - searchH));
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

  // Keyboard nav for the dropdown's search box: arrows move the highlight, Enter loads it, Escape
  // closes. (The name <Input> has none of this — it's a plain text field.)
  const handleSearchKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      keyboardMoveRef.current = true;
      setHighlight((h) => (rows.length === 0 ? -1 : Math.min(h + 1, rows.length - 1)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      keyboardMoveRef.current = true;
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      if (highlight >= 0 && rows[highlight]) {
        e.preventDefault();
        handleLoad(rows[highlight]);
      }
    } else if (e.key === "Escape") {
      e.stopPropagation();
      close();
      inputRef.current?.focus();
    }
  };

  const activeRowId = `profile-option-${highlight}`;

  return (
    <div ref={rootRef} className="relative min-w-0 flex-1">
      <BadgePicker />
      {/* The name field — naming/creating only. It never filters and never opens the dropdown, so
          "Save as…"/"New profile" can focus it for typing a name without triggering a browse/load. */}
      <Input
        ref={inputRef}
        id="chart-title-input"
        value={title}
        placeholder="Enter a name"
        maxLength={MAX_PROFILE_NAME_LENGTH}
        aria-invalid={titleError}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => {
          const trimmed = title.trim();
          if (trimmed !== title) {
            setTitle(trimmed);
          }
        }}
        className={cn("pl-16 pr-9 shadow-none", titleError && "border-red-500 focus-visible:ring-red-500/40")}
      />
      {/* Right adornment: the browse caret — the only way to open the profile dropdown. */}
      <button
        type="button"
        aria-label="Browse saved profiles"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => {
          if (open) {
            close();
          } else {
            openDropdown();
          }
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
          {/* Dedicated search box — searching lives here, NOT in the name field above. Always shown
              so you can filter (or clear back to all) even from a "No matches" state. */}
          <div className="relative border-b border-border">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input
              ref={searchRef}
              type="text"
              value={query}
              placeholder="Search profiles…"
              // Native <input> with role="combobox" is the WAI-ARIA pattern; the listbox can't be a
              // native <select>, so prefer-tag-over-role doesn't apply.
              // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
              role="combobox"
              aria-expanded="true"
              aria-controls="profile-combobox-list"
              aria-autocomplete="list"
              aria-activedescendant={highlight >= 0 ? activeRowId : undefined}
              onChange={(e) => {
                setQuery(e.target.value);
                setHighlight(-1);
              }}
              onKeyDown={handleSearchKeyDown}
              className="w-full bg-transparent py-2 pl-8 pr-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none"
            />
          </div>
          {rows.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">{profiles.length === 0 ? "No saved profiles yet." : "No matches."}</p>
          ) : (
            <ul
              ref={listRef}
              // ARIA listbox: a <ul>/<li> carrying listbox/option roles, since a native
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
                      // The active profile is already loaded — its row isn't a load target (just the
                      // delete button stays live). Disabled so the click reads as "already loaded"
                      // rather than a dead click.
                      disabled={isActive}
                      className={cn(
                        "flex min-w-0 flex-1 items-center py-2 pl-0 pr-3 text-left text-sm",
                        isActive ? "cursor-default" : "cursor-pointer",
                      )}
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
