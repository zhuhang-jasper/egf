import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { ChevronDown, ChevronsUp, ChevronUp, FileText, Radar } from "lucide-react";

import { Tooltip } from "@/components/ui/Tooltip";
import { UnseenDot } from "@/components/UnseenDot";

import { FRAMEWORK_VERSION, SITE_COPY } from "@/constants";
import { cn } from "@/utils";
import { clearStickyScrollOffset, getWindowScrollY, scrollWindowToTop, setStickyScrollOffset } from "@/utils/scroll";

const TABS = [
  { id: "tool", label: "Tool", icon: Radar },
  // `version` derives from the single FRAMEWORK_VERSION source so the label and the "unseen" dot
  // (see useTheoryUpdates) always agree — bumping that one constant updates both.
  { id: "theory", label: "Theory", icon: FileText, version: `v${FRAMEWORK_VERSION}` },
];

// The caret's three modes. Each does exactly ONE thing — scrolling and header state are never bundled.
//
// `jump` used to scroll to the top AND reveal, which forced the title on a user who only wanted to get back
// to the top: the very complaint this whole affordance exists to answer. Splitting them means getting the
// title from deep in the page is two clicks (top, then reveal), but the far more common "just take me up"
// is one click with no side effect. At the top, a pull reveals too, so the second click isn't the only route.
const CARET_MODES = {
  collapse: { icon: ChevronUp, label: "Hide title" },
  reveal: { icon: ChevronDown, label: "Show title" },
  backToTop: { icon: ChevronsUp, label: "Back to top" },
};


/**
 * The framework title block. Collapses to zero height rather than being scrolled away, so the document's
 * top becomes the tab bar itself — see `useHeaderCollapse` for why that matters.
 *
 * `grid-rows-[1fr]` → `grid-rows-[0fr]` is how the height collapses: a grid row can go from a content-sized
 * track to a zero track, which plain `height: auto` cannot express. Switched, not transitioned — see below.
 *
 * The inner item MUST carry `min-h-0` as well as `overflow-hidden`. A grid item's automatic minimum size is
 * its min-content height, which overrides a `0fr` track — so without it the collapsed row keeps a residual
 * band of the title's height. That residual is not just cosmetic: it stays scrollable, so `scrollY > 0` is
 * reachable while the header still looks collapsed, which puts a dead gap between "collapsed" and "at the
 * top" and breaks the pull gesture's only precondition.
 *
 * `print:grid-rows-[1fr]` forces it open on paper, where there is no scrolling and the title should always
 * appear. Kept out of the `hidden` treatment for the same reason.
 */
function AppShellIntro({ collapsed = false }) {
  return (
    <div
      id="app-shell-intro"
      aria-hidden={collapsed}
      className={cn(
        // NOT animated. `grid-template-rows` is not compositable, so transitioning it forces a full layout +
        // paint every frame — on a container wrapping the entire page, radar chart included. Because collapsing
        // is triggered BY scrolling, those ~18 layout passes land exactly while the user is scrolling, which is
        // what the stutter was. A trace confirmed no scroll writer was involved: the cost was rendering, not a
        // fight over scroll position. Snapping is also more honest here — the header is off-screen when this
        // fires, so there was never any animation to see.
        "grid print:grid-rows-[1fr]",
        collapsed ? "grid-rows-[0fr]" : "grid-rows-[1fr]",
      )}
    >
      <header className="min-h-0 overflow-hidden text-center">
        <h1 className="text-balance text-xl sm:text-2xl font-bold leading-tight tracking-tight text-slate-900 mb-1 pt-0 sm:pt-2">
          {SITE_COPY.title}
        </h1>
        <p className="text-pretty text-xs sm:text-sm leading-tight text-slate-700 pb-2 sm:pb-3">
          {SITE_COPY.tagline} {SITE_COPY.detail} <span className="whitespace-nowrap text-slate-500">{SITE_COPY.byline}</span>
        </p>
      </header>
    </div>
  );
}

function AppShellTabBar({ activeTab, onTabChange, theoryHasUnseenUpdates = false, collapsed = false, onCollapsedChange }) {
  const barRef = useRef(null);
  // Whether scrolling up is possible — i.e. we're scrolled past the point where the bar pins.
  // Gates the active tab's "click to scroll to top" tooltip so it only shows when it'd do something.
  const [canScrollUp, setCanScrollUp] = useState(false);
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

  // Whether there's anywhere to scroll up to, gating the active tab's "click to scroll to top" tooltip so
  // it only appears when it would do something. Header collapse is no longer inferred from scroll position
  // — it's an explicit boolean prop — so this is the only thing scroll position still decides here.
  useEffect(() => {
    const sync = () => setCanScrollUp(getWindowScrollY() > 0);
    sync();
    window.addEventListener("scroll", sync, { passive: true });
    window.addEventListener("resize", sync);
    return () => {
      window.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
    };
  }, [activeTab]);

  // Scroll position takes precedence over header state. Scrolled away from the top, the header is off-screen
  // either way, so toggling it would be an invisible no-op — "back to top" is the only action with a visible
  // effect there, and it's what a control in the top-left corner is expected to do. Only once at the top does
  // the caret become the header toggle.
  let caretMode = "backToTop";
  if (!canScrollUp) {
    caretMode = collapsed ? "reveal" : "collapse";
  }
  const { icon: CaretIcon, label: caretLabel } = CARET_MODES[caretMode];

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

        {/* Corner caret — at the top it toggles the title (the discoverable equivalent of the pull gesture in
            useHeaderCollapse, which is natural on touch but undiscoverable with a mouse); scrolled away from
            the top it is a plain "back to top".

            ONE ACTION PER CLICK. It previously combined the two — expanding from a scrolled position also
            jumped to the top — which meant a user who only wanted to return to the top had the title forced
            on them. Since the header is off-screen while scrolled anyway, toggling it there would be an
            invisible no-op, so the split costs nothing and removes the surprise. Getting the title from deep
            is now two clicks, but "just take me up" is one with no side effect.

            This also sidesteps the layout hazard that made the combined version fragile: the intro and the
            paddings above the tab bar all live above the scroll position, so revealing them while scrolled
            grows the document upward and pushes content down ~120px. Revealing now only ever happens AT the
            top, exactly like the pull gesture, where that growth is invisible.

            Always rendered, never hidden by scroll position: a control that vanishes reads as flakiness, and
            it is the only visible route back to the title (the pull gesture requires already being at the
            top, which is the hard part).

            THE ICON DISTINGUISHES THREE ACTIONS, not two. Expanding from a scrolled position also jumps to
            the top, and a plain "show title" chevron hid that — the jump was the dominant effect and came as
            a surprise. A DOUBLE chevron is the established "go to the end" idiom, so it advertises the jump
            instead. At the top there is nothing to jump to, so the single chevron is honest there:

              expanded            → ChevronUp     collapse, no scrolling
              collapsed, at top   → ChevronDown   reveal in place
              collapsed, scrolled → ChevronsUp    jump to top, then reveal

            Absolutely positioned at every width. Being out of flow is what keeps it from decentering the
            tablist — the row is `justify-center`, so an in-flow caret would shove the tabs right by its
            own width. Nothing else occupies this row now that the admin links moved to the Theory
            toolbar, so the left edge is free at every width for every user. */}
        <button
          type="button"
          onClick={() => {
            if (caretMode === "backToTop") {
              scrollWindowToTop({ behavior: "smooth" });
              return;
            }
            onCollapsedChange?.(caretMode === "collapse");
          }}
          title={caretLabel}
          aria-label={caretLabel}
          // Only a header toggle has an expanded/collapsed state to report; as "back to top" it's a plain button.
          aria-expanded={caretMode === "backToTop" ? undefined : !collapsed}
          className="absolute left-0 top-1/2 inline-flex size-8 shrink-0 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-slate-100/80 text-slate-500 transition-colors hover:bg-slate-200/80 hover:text-slate-900 print:hidden"
        >
          <CaretIcon className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}

export { AppShellIntro, AppShellTabBar };
