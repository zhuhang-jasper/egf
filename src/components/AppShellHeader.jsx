import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { ChevronUp, FileText, Radar } from "lucide-react";

import { Tooltip } from "@/components/ui/Tooltip";
import { UnseenDot } from "@/components/UnseenDot";

import { FRAMEWORK_VERSION, SITE_COPY } from "@/constants";
import { cn } from "@/utils";
import { clearStickyScrollOffset, getTabBarPinnedScrollY, getWindowScrollY, scrollWindowTo, setStickyScrollOffset } from "@/utils/scroll";

const TABS = [
  { id: "tool", label: "Tool", icon: Radar },
  // `version` derives from the single FRAMEWORK_VERSION source so the label and the "unseen" dot
  // (see useTheoryUpdates) always agree — bumping that one constant updates both.
  { id: "theory", label: "Theory", icon: FileText, version: `v${FRAMEWORK_VERSION}` },
];

// Slack when deciding the bar has reached its pinned position. A smooth scroll lands ON the anchor
// rather than past it, so an exact test would keep the collapse caret visible after its own click.
const PIN_EPSILON_PX = 2;

function AppShellIntro() {
  return (
    <header id="app-shell-intro" className="space-y-2 pt-0 text-center sm:pt-2">
      <h1 className="text-balance text-xl sm:text-2xl font-bold leading-tight tracking-tight text-slate-900 mb-1">{SITE_COPY.title}</h1>
      <p className="text-pretty text-xs sm:text-sm leading-tight text-slate-700 sm:mb-1">
        {SITE_COPY.tagline} {SITE_COPY.detail} <span className="whitespace-nowrap text-slate-500">{SITE_COPY.byline}</span>
      </p>
    </header>
  );
}

function AppShellTabBar({ activeTab, onTabChange, theoryHasUnseenUpdates = false }) {
  const barRef = useRef(null);
  // Whether scrolling up is possible — i.e. we're scrolled past the point where the bar pins.
  // Gates the active tab's "click to scroll to top" tooltip so it only shows when it'd do something.
  const [canScrollUp, setCanScrollUp] = useState(false);
  // Whether the bar has reached its pinned position — hides the collapse caret, whose action is then
  // already satisfied. Separate from `canScrollUp` because the two need different thresholds (below).
  const [isPinned, setIsPinned] = useState(false);
  const selectedIndex = Math.max(
    0,
    TABS.findIndex((tab) => tab.id === activeTab),
  );

  useLayoutEffect(() => {
    const bar = barRef.current;
    if (!bar) {
      return undefined;
    }

    const syncStickyOffset = () => {
      setStickyScrollOffset(bar.getBoundingClientRect().height);
    };

    syncStickyOffset();
    const observer = new ResizeObserver(syncStickyOffset);
    observer.observe(bar);

    return () => {
      observer.disconnect();
      clearStickyScrollOffset();
    };
  }, []);

  // Track whether we're scrolled past the pin point. Drives two opposite affordances: the active tab's
  // "scroll to top" tooltip (only useful when there IS room to scroll up), and the collapse caret
  // below (only offered when there isn't — i.e. the intro is still fully shown).
  //
  // The caret uses a >= test with a small tolerance rather than the tooltip's strict >. Clicking the
  // caret scrolls to exactly `pinnedY`, where `scrollY > pinnedY` is false — so a strict test would
  // leave the caret on screen after its own click, waiting on smooth-scroll rounding to flip it. The
  // tolerance also absorbs sub-pixel landings and elastic overscroll settling back to the anchor.
  useEffect(() => {
    const sync = () => {
      const pinnedY = getTabBarPinnedScrollY();
      const y = getWindowScrollY();
      setCanScrollUp(y > pinnedY);
      setIsPinned(y >= pinnedY - PIN_EPSILON_PX);
    };
    sync();
    window.addEventListener("scroll", sync, { passive: true });
    window.addEventListener("resize", sync);
    return () => {
      window.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
    };
  }, [activeTab]);

  return (
    <div ref={barRef} id="app-shell-tab-bar" className="sticky top-0 z-40 -mx-3 mt-0 bg-white px-3 py-2 shadow-sm print:static print:shadow-none">
      {/* The tablist is centered at every width for every user. The admin Poster/Social shortcuts used
          to float at the right edge here, which forced an admin-only `justify-between` on mobile; they
          now live in the Theory tab's toolbar instead, so this row is identical for admin and non-admin
          and the collapse caret can own the left edge unconditionally. */}
      <div className="relative flex items-center justify-center">
        <div
          className="relative grid w-62 max-w-full grid-cols-2 rounded-lg border border-slate-200 bg-slate-100/80 p-0.5"
          role="tablist"
          aria-label="App sections"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute top-0.5 bottom-0.5 left-0.5 rounded-md bg-slate-900 shadow-sm transition-transform duration-150 ease-out"
            style={{
              width: "calc(50% - 0.125rem)",
              transform: `translateX(calc(${selectedIndex} * 100%))`,
            }}
          />
          {TABS.map(({ id, label, icon: Icon, version }) => {
            const selected = activeTab === id;
            // Shown on the Theory tab whether or not it's active: opening the tab doesn't clear this
            // dot. It's the aggregate of the per-section dots and stays lit until every changed
            // section has actually been scrolled to (see useTheoryUpdates).
            const showUnseenDot = id === "theory" && theoryHasUnseenUpdates;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => onTabChange(id)}
                className={cn(
                  "group relative z-10 flex cursor-pointer items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold",
                  selected ? "text-white" : "text-slate-600 hover:text-slate-800",
                )}
              >
                <Icon className="size-3.5 shrink-0" aria-hidden />
                {label}
                {version ? (
                  // Version tag sits inline (baseline) with "Theory"; only the unseen-updates dot
                  // floats up as a superscript badge on the version text.
                  <span
                    className={cn("inline-flex items-start text-[11px] font-semibold leading-none", selected ? "text-white/70" : "text-slate-400")}
                  >
                    {version}
                    {/* Unseen-updates dot: at least one changed Theory section hasn't been read yet.
                        `-translate-y` lifts it to superscript height. */}
                    {showUnseenDot ? <UnseenDot label="New framework updates" className="ml-0.5 size-1.5 -translate-y-0.5" /> : null}
                  </span>
                ) : null}
                {selected && canScrollUp ? <Tooltip text="Click to scroll to top" placement="bottom" /> : null}
              </button>
            );
          })}
        </div>

        {/* Collapse caret: scrolls down to exactly the point where this bar pins, so the intro header
            slides away and the bar goes sticky — the same end state as scrolling there by hand, minus
            the scrolling. It is NOT a toggle: there is no collapsed state to store, since scroll
            position already is the state (and scrolling back up restores the intro).

            Shown only while the bar has NOT reached its pinned position, which is precisely when the
            action would do something — clicking it scrolls to that position, so it removes itself. Once
            pinned, the active tab's "click to scroll to top" tooltip takes over as the way back.

            Absolutely positioned at every width. Being out of flow is what keeps it from decentering
            the tablist — the row is `justify-center`, so an in-flow caret would shove the tabs right by
            its own width. Nothing else occupies this row now that the admin links moved to the Theory
            toolbar, so the left edge is free at every width for every user. */}
        {!isPinned ? (
          <button
            type="button"
            onClick={() => scrollWindowTo(getTabBarPinnedScrollY(), { behavior: "smooth" })}
            title="Collapse header"
            aria-label="Collapse header"
            className="absolute left-0 top-1/2 inline-flex size-8 shrink-0 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-slate-100/80 text-slate-500 transition-colors hover:bg-slate-200/80 hover:text-slate-900"
          >
            <ChevronUp className="size-4" aria-hidden />
          </button>
        ) : null}
      </div>
    </div>
  );
}

export { AppShellIntro, AppShellTabBar };
