import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { ChevronDown, Search, Trash2 } from "lucide-react";

import { BadgePicker } from "@/components/BadgePicker";
import { FrameworkVersionChip } from "@/components/FrameworkVersionChip";
import { TrackBadge } from "@/components/TrackBadge";
import { Input } from "@/components/ui/input";

import { useProfileStampState } from "@/hooks/useProfileStamp";
import { useTouchPrimary } from "@/hooks/useTouchPrimary";

import { useAppStore } from "@/store/useAppStore";

import { LAYER, MAX_PROFILE_NAME_LENGTH, normalizeAttachedBadge, TRACK_BADGE_OPTIONS, TRACK_BADGE_UI } from "@/constants";
import { CONTROL_TEXT, TOOL_TEXT } from "@/styles/control-typography";
import { cn } from "@/utils";
import { track } from "@/utils/analytics";
import { profileStampState } from "@/utils/profile-stamp-state";
import { getPopoverViewportBounds } from "@/utils/scroll";

// Badge group order: the real badges (fe, be) in badge-dropdown order first, then "no badge" last.
const BADGE_SORT_ORDER = TRACK_BADGE_OPTIONS.filter((b) => b !== "none").concat("none");

// Rank a profile's badge for grouping — lower sorts first; "none" always ranks last.
function badgeRank(badge) {
  const i = BADGE_SORT_ORDER.indexOf(normalizeAttachedBadge(badge));
  return i === -1 ? BADGE_SORT_ORDER.length : i;
}

// Three deliberately different row counts: VISIBLE_ROWS caps the list, MIN_COMFORTABLE_ROWS decides
// direction, MIN_ROWS is a hard floor the panel overlaps chrome to keep. Every ".5" is the peek affordance.
// See docs/DECISIONS.md#profile-dropdown-sizing-and-direction
const VISIBLE_ROWS = 6.5;
const MIN_COMFORTABLE_ROWS = 4.5;
const MIN_ROWS = 2.5;

// Marquee scroll speed (px/sec) for names too long to fit — lower is slower/calmer.
const MARQUEE_SPEED_PX_PER_SEC = 45;
// Gap between the two looping copies of a scrolling name, so it doesn't read as one run-on word.
const MARQUEE_GAP_PX = 40;

/** One row's version chip. Its own component because the resolver is a hook and rows are mapped. */
function ProfileVersionChip({ profile }) {
  const { state, version } = useProfileStampState(profile);
  return <FrameworkVersionChip state={state} version={version} className="ml-2" />;
}

/**
 * A profile name that scrolls like an LED sign when it is wider than the space available, and renders as a
 * plain span when it fits. Speed is proportional to length so long names don't whip past. `deps` lets the
 * caller force a re-measure when layout that affects width changes.
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
 * The profile name field plus a browse/load/delete dropdown. The name field never searches and saving lives
 * elsewhere: see docs/DECISIONS.md#profile-name-field-does-not-search
 */
export function ProfileCombobox({ titleError = false }) {
  const title = useAppStore((s) => s.title);
  const setTitle = useAppStore((s) => s.setTitle);
  const profiles = useAppStore((s) => s.profiles);
  const loadProfile = useAppStore((s) => s.loadProfile);
  const deleteProfileWithUndo = useAppStore((s) => s.deleteProfileWithUndo);
  const activeSavedProfileId = useAppStore((s) => s.activeSavedProfileId);
  const showDraftDiscardedToast = useAppStore((s) => s.showDraftDiscardedToast);
  const touchPrimary = useTouchPrimary();

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

  // Storage hands us profiles newest-first; grouped by badge then A–Z for display only.
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

  // No search autofocus on touch: it would pop the on-screen keyboard on every open, intrusive when
  // browsing.
  const openDropdown = () => {
    setQuery("");
    setHighlight(-1);
    setOpen(true);
    if (!touchPrimary) {
      requestAnimationFrame(() => searchRef.current?.focus());
    }
  };

  // Close + reset the search box and keyboard highlight.
  const close = () => {
    setOpen(false);
    setQuery("");
    setHighlight(-1);
  };

  const handleLoad = (pr) => {
    // The already-loaded profile is the current draft, not a load target.
    if (pr.id === activeSavedProfileId) {
      close();
      return;
    }
    const result = loadProfile(pr.id);
    // Read from the ROW, not the draft the load produced: this is the funnel's entry step, paired with the
    // same param on `profile_saved`.
    const stamp = profileStampState(pr);
    track("profile_loaded", { attached_badge: pr.attachedBadge, profile_state: stamp.state, stamp_source: stamp.source });
    close();
    // Coalescing toast, shared with "New profile": only one shows at a time, so Undo recovers the most
    // recent discard.
    if (result?.hadUnsavedChanges) {
      showDraftDiscardedToast(result.undo, () => track("profile_load_undone"));
    }
  };

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

  // Position + size the popover on open and on resize.
  // See docs/DECISIONS.md#profile-dropdown-sizing-and-direction
  useLayoutEffect(() => {
    // No reset on close: both are read only inside the render's `open` branch, and `decide()` overwrites
    // them before the menu is shown again.
    if (!open) {
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
      // Measured live, so the header boundary tracks the intro's expand/collapse for free.
      const { top: topBoundary, bottom: bottomBoundary } = getPopoverViewportBounds();
      const spaceBelow = bottomBoundary - rootRect.bottom - gap - margin;
      const spaceAbove = rootRect.top - topBoundary - gap - margin;

      // The search box is a non-scrolling sibling above the list, so reserve its height or the popover
      // overflows even when the list fits.
      const searchBox = menu.firstElementChild;
      const searchH = searchBox ? searchBox.getBoundingClientRect().height : 0;
      const firstRow = list.firstElementChild;
      const rowH = firstRow ? firstRow.getBoundingClientRect().height : 0;
      // List box padding (py-1) + bottom border, so the peek math targets the content area.
      const listChrome = list.offsetHeight - list.clientHeight + 8;
      const peekRows = rowH > 0 ? Math.round(VISIBLE_ROWS * rowH + listChrome) : Infinity;
      const naturalListH = list.scrollHeight;

      // Direction is decided against a SUFFICIENT height, not the ideal one.
      const comfortableRows = rowH > 0 ? Math.round(MIN_COMFORTABLE_ROWS * rowH + listChrome) : Infinity;
      const neededHeight = searchH + Math.min(naturalListH, comfortableRows);
      const up = neededHeight > spaceBelow && spaceAbove > spaceBelow;
      const available = Math.floor(up ? spaceAbove : spaceBelow);
      setOpenUp(up);

      // This cap may EXCEED the band: past MIN_ROWS the panel overlaps chrome rather than collapsing.
      const minListH = rowH > 0 ? Math.round(MIN_ROWS * rowH + listChrome) : 0;
      const listCap = Math.min(peekRows, Math.max(minListH, available - searchH));
      setListMaxHeight(naturalListH <= listCap ? null : listCap);
    };
    decide();
    window.addEventListener("resize", decide);
    return () => window.removeEventListener("resize", decide);
  }, [open, rows.length]);

  // Keyed on `open` alone, not `rows`: openDropdown() resets the search first, so this fires once against
  // the full list and never re-snaps the scroll while the user is typing.
  useLayoutEffect(() => {
    if (!open) {
      return;
    }
    const activeIndex = rows.findIndex((pr) => pr.id === activeSavedProfileId);
    setHighlight(activeIndex);
    const frame = requestAnimationFrame(() => {
      const list = listRef.current;
      const row = list?.children?.[activeIndex];
      if (!list || !row || list.scrollHeight <= list.clientHeight) {
        return;
      }
      const rowTop = row.offsetTop;
      const rowBottom = rowTop + row.offsetHeight;
      if (rowTop < list.scrollTop) {
        list.scrollTop = rowTop;
      } else if (rowBottom > list.scrollTop + list.clientHeight) {
        list.scrollTop = rowBottom - list.clientHeight;
      }
    });
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Native non-passive listener because React's onWheel is passive, where preventDefault is a no-op.
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

  // Keyboard moves only: hover also sets `highlight`, and scrolling then would yank a partially-visible
  // hovered row into view.
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

  // The dropdown's search box only; the name <Input> is a plain text field.
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
      <BadgePicker onOpen={close} />
      {/* Naming and creating only. It never filters and never opens the dropdown, so
          "Save as copy"/"New profile" can focus it for typing a name without triggering a browse/load. */}
      <Input
        ref={inputRef}
        id="chart-title-input"
        value={title}
        placeholder="Enter profile name"
        maxLength={MAX_PROFILE_NAME_LENGTH}
        aria-invalid={titleError}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => {
          const trimmed = title.trim();
          if (trimmed !== title) {
            setTitle(trimmed);
          }
        }}
        // `pl-*` clears the badge picker and must step on the pill's own rungs; the weights are deliberate.
        // See docs/DECISIONS.md#profile-controls-read-at-one-rung
        className={cn(
          "pl-18 pr-9 font-semibold shadow-none placeholder:font-medium xs:pl-20",
          titleError && "border-red-500 focus-visible:ring-red-500/40",
        )}
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
        className="absolute right-0 top-0 flex h-full w-7 cursor-pointer items-center justify-center text-muted-foreground hover:text-foreground"
      >
        <ChevronDown className={cn("h-4 w-4 opacity-60 transition-transform", open && "rotate-180")} />
      </button>
      {open ? (
        // Sizes to the widest row, bounded by the input and the page width; a name past that cap scrolls
        // (see ScrollingLabel).
        <div
          ref={menuRef}
          className={cn(
            "absolute left-0 flex w-max min-w-full max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-lg border border-border bg-card shadow-md",
            LAYER.dropdown,
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
              // The WAI-ARIA combobox pattern: no tag supplies it, and the listbox below cannot be a
              // native <select>.
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
              className={cn("w-full bg-transparent py-2 pl-8 pr-3 placeholder:text-muted-foreground focus-visible:outline-none", CONTROL_TEXT)}
            />
          </div>
          {rows.length === 0 ? (
            <p className={cn("px-3 py-2 text-muted-foreground", CONTROL_TEXT)}>{profiles.length === 0 ? "No saved profiles yet." : "No matches."}</p>
          ) : (
            <ul
              ref={listRef}
              // <ul>/<li> with listbox/option roles, since a native <select> can't hold the
              // badge + name + delete-button row layout.
              // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-to-interactive-role
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
                    // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-to-interactive-role
                    role="option"
                    aria-selected={isHighlighted}
                    aria-current={isActive ? "true" : undefined}
                    // Hover, active/loaded and keyboard highlight must not conflict, so the highlight is an
                    // outline rather than a background: it layers over the active row's tint.
                    className={cn(
                      "relative flex items-stretch pr-0.5 hover:bg-muted/60",
                      isActive && "bg-muted before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-primary hover:bg-muted",
                      isHighlighted && "z-10 bg-accent ring-2 ring-inset ring-primary/40 hover:bg-accent",
                    )}
                  >
                    <button
                      type="button"
                      // Disabled so clicking the loaded profile reads as "already loaded" rather than dead.
                      // Its delete button stays live.
                      disabled={isActive}
                      className={cn(
                        // `pr-1`, not `pr-3`: the chip carries its own `ml-2`, so the trailing pad would only
                        // spend width the profile name needs.
                        "flex min-w-0 flex-1 select-none items-center py-2 pl-0 pr-2 text-left",
                        CONTROL_TEXT,
                        isActive ? "cursor-default" : "cursor-pointer",
                      )}
                      onMouseEnter={() => setHighlight(i)}
                      onClick={() => handleLoad(pr)}
                    >
                      {/* Badge slot spans from the row's left edge to where the input text starts. No-badge rows
                          show an em-dash. See docs/DECISIONS.md#profile-controls-read-at-one-rung */}
                      <span className="flex w-12 shrink-0 items-center justify-center">
                        {normalizeAttachedBadge(pr.attachedBadge) === "none" ? (
                          <span className="text-muted-foreground">{TRACK_BADGE_UI.none.shortLabel}</span>
                        ) : (
                          <TrackBadge variant={pr.attachedBadge} className={TOOL_TEXT.annotation} />
                        )}
                      </span>
                      <ScrollingLabel label={label} deps={open} className={cn(isActive && "font-semibold text-foreground")} />
                      {/* Every row, not just the loaded one: the chip answers "which of my profiles need
                          attention" before one is opened. The popover is w-max, so it widens to fit rather
                          than crushing the name, and ScrollingLabel marquees if it is squeezed anyway. */}
                      <ProfileVersionChip profile={pr} />
                    </button>
                    <button
                      type="button"
                      // `w-8` is still a 32px tap target, the accessible floor, so the rest goes to the name.
                      className="flex w-8 shrink-0 cursor-pointer items-center justify-center rounded-md pr-1 text-destructive hover:bg-destructive/10"
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
