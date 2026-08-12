import { useEffect, useRef, useState } from "react";

import { AdminContent } from "@/components/AdminContent";
import { AppBottomNav } from "@/components/AppBottomNav";
import { AppShellHeaderStack } from "@/components/AppShellHeader";
import { ScrollTopFab } from "@/components/ScrollTopFab";
import { TheoryContent } from "@/components/TheoryContent";
import { ToolContent } from "@/components/ToolContent";
import { Toaster } from "@/components/ui/Toaster";

import { getPersistedActiveTab, useTabScrollMemory } from "@/hooks/useTabScrollMemory";
import { useTheoryUpdates } from "@/hooks/useTheoryUpdates";

import { FE_UI, IS_ADMIN, SITE_COPY } from "@/constants";
import { cn } from "@/utils";
import { track } from "@/utils/analytics";
import { cleanTheoryDeepLinkParams, getTabFromUrl, parseTheoryDeepLink, syncTabInUrl } from "@/utils/theory-url";

const appVersion = import.meta.env.VITE_APP_VERSION;
// Keep in step with AppBottomNav's NAV_ITEMS. Gating here is what makes a stale `?tab=admin` fall back to the
// default for a normal visitor rather than selecting a tab the nav is not showing.
const VALID_TABS = IS_ADMIN ? ["tool", "theory", "admin"] : ["tool", "theory"];

/**
 * A tab's content region. Once rendered, panels stay MOUNTED and toggle with `hidden` rather than being
 * conditionally rendered: chart sizing passes and scroll positions are expensive to rebuild, and `isVisible` is
 * what children use to skip work while off screen. Only the first render skips a panel (see `inactivePhase`).
 *
 * Each panel carries its OWN `widthStyle` measure (Theory 900, tool 550) rather than both taking the active
 * tab's, so a hidden panel lays out at the width it will be shown at and its charts can be pre-fitted.
 *
 * `prefit` is the first-paint preload: a `display: none` panel has no width, so its charts cannot converge.
 * This mode lays the panel out for real but clips it to zero height with `inert` on. See
 * docs/DECISIONS.md#tab-panel-prefit.
 *
 * The `overflow-x-clip` rules and the one-sided transition both guard the same one-frame horizontal scrollbar,
 * which makes the fixed bottom nav jump. See docs/DECISIONS.md#tab-switch-scrollbar-jump before changing them.
 */
function TabPanel({ label, active, prefit = false, leaving = false, animating = false, direction = "left", widthStyle, children }) {
  // The leaving panel is invisible and zero-height, which is why there is so little machinery here: it only has
  // to avoid being seen (`opacity: 0`) and taking space (`h-0`). An earlier version faded it out and needed
  // measured `fixed` positioning to do so; the visible exit is what caused the ghosting.
  return (
    <div
      className={cn(
        "w-full self-center px-3",
        // `h-0` instead of the margins whenever the panel is laid out but must occupy no height: both `prefit`
        // and `leaving` display the panel so its contents lay out for real. Margin on a zero-height box still
        // grows the document, which is the whole thing these modes exist to avoid.
        prefit || leaving ? "h-0 overflow-hidden" : "mt-3 mb-0",

        // Keyed off `active` and it must stay that way: widening this to "active OR leaving" reintroduces the
        // scrollbar jump, since a leaving panel is still laid out at its own measure. It also clips the slide,
        // whose transform lives on the inner wrapper below for exactly that reason.
        !active && "overflow-x-clip",

        // `absolute` alone does NOT keep the leaving panel out of the layout: an out-of-flow box still extends
        // its containing block's scrollable overflow, so Theory's height propped the scrollbar open after
        // switching to Tool. `h-0 overflow-hidden` above is the fix. What stays here is leaving-specific:
        // `absolute` so the box cannot affect the flex column, `inset-x-0` so width resolves against `main`.
        leaving && "pointer-events-none absolute inset-x-0",

        // The arriving panel is clipped for the length of its entrance, because the enter animation's
        // horizontal offset is itself overflow. `clip` not `hidden`: `hidden` would make this a scroll
        // container, and an ancestor scroll container stops the sticky header pinning to the viewport.
        active && !prefit && animating && "overflow-x-clip",
      )}
      /* `min(measure, 100%)` so the panel's border-box can never be what overflows the document. Inline rather
         than a `max-w-full` class because inline styles beat utilities, so a Tailwind cap would be overridden. */
      style={{
        maxWidth: `min(${widthStyle.maxWidth}px, 100%)`,
        // Feeds the `.tab-enter-*` / `.tab-leave-*` rules in index.css. Lives in JS because the same number
        // drives the timer keeping a leaving panel mounted. Unset when idle, so no stray custom property.
        ...(active && animating ? { "--tab-transition-ms": `${TAB_TRANSITION_MS}ms` } : null),
      }}
      role="tabpanel"
      /* The leaving panel is deliberately not `hidden` for the frames it lingers: flipping display on the
         outgoing panel in the same commit that mounts the incoming one is a layout change on both halves at
         once, in the frame the switch is trying to keep smooth. */
      hidden={!active && !prefit && !leaving}
      /* Keyed to `active`, not to whether the panel is painted, so a lingering leaving panel is never reachable
         by tab order, pointers or a screen reader. */
      aria-hidden={!active}
      inert={!active}
      aria-label={label}
    >
      {/* The entrance animation lives one level in from the panel, deliberately: a `translateX` on the panel
          moves its own border-box and so extends the document's scrollable width. A clip cannot crop the box it
          is declared on, only what is inside it. Idle, this wrapper carries no classes and so creates no
          containing block, stacking context, or layout of its own. */}
      <div
        className={cn(
          leaving && (direction === "left" ? "tab-leave-left" : "tab-leave-right"),
          active && !prefit && animating && (direction === "left" ? "tab-enter-left" : "tab-enter-right"),
        )}
      >
        {children}
      </div>
    </div>
  );
}

// Parse once at module evaluation time so the URL is read before React renders.
const BOOT_DEEP_LINK = parseTheoryDeepLink();

/** Per-tab content measure, in px. TabPanel clamps it with `min(…, 100%)` rather than using it raw. */
const TAB_WIDTH_STYLE = {
  tool: { maxWidth: FE_UI.page.maxWidthPx },
  theory: { maxWidth: FE_UI.page.theoryMaxWidthPx },
  // The tool's measure, not theory's: two cards in a row want the narrower column, and it matches the
  // bottom nav's own cap so the Admin item sits under the content it navigates.
  admin: { maxWidth: FE_UI.page.maxWidthPx },
};

/**
 * How long the inactive panel stays in `prefit` before going back to `hidden`. Only has to outlast the charts'
 * startup (two rAFs each), and the panel is invisible throughout, so this is generous rather than tight.
 */
const PREFIT_WINDOW_MS = 300;

/**
 * How long a tab switch's cross-slide runs. Drives both the CSS animation (via `--tab-transition-ms`) and the
 * timer keeping the outgoing panel mounted, so it is one constant rather than a value in the stylesheet.
 *
 * Short on purpose: this fires on every navigation, and it should convey direction, not be watched. Do not
 * raise it to make the slide more visible; the keyframe distance is that knob. See
 * docs/DECISIONS.md#tab-transition-duration.
 */
const TAB_TRANSITION_MS = 160;

/**
 * Nav order, used only to derive which way a switch slides, matched to NAV_ITEMS in AppBottomNav. Separate from
 * VALID_TABS, which answers whether a tab may be selected at all.
 */
const TAB_ORDER = ["tool", "theory", "admin"];

function slideDirection(fromTab, toTab) {
  return TAB_ORDER.indexOf(toTab) >= TAB_ORDER.indexOf(fromTab) ? "left" : "right";
}

function scheduleIdle(callback) {
  if (typeof requestIdleCallback === "function") {
    const id = requestIdleCallback(callback, { timeout: 1000 });
    return () => cancelIdleCallback(id);
  }
  const id = setTimeout(callback, 200);
  return () => clearTimeout(id);
}

export default function HomePage() {
  const [activeTab, setActiveTab] = useState(() => {
    if (BOOT_DEEP_LINK) {
      return "theory";
    }
    // URL is the source of truth so the page is shareable; fall back to the
    // persisted tab, then default. Always reflected back into the URL below.
    const tab = getTabFromUrl(VALID_TABS) ?? getPersistedActiveTab(VALID_TABS) ?? "tool";
    syncTabInUrl(tab);
    return tab;
  });

  // Consumed-once ref: passed to TheoryContent on first render, then nulled so
  // subsequent tab switches don't re-trigger the scroll/expand.
  const deepLinkRef = useRef(BOOT_DEEP_LINK);

  // Flipped by an in-tab scroll (matrix jump, deep-link) so the restore loop yields to it. Restore still runs
  // first, landing at the remembered scroll, then the jump takes over. Reset by the hook on each tab switch.
  // This is what lets a shared link restore the previous position before gliding, rather than starting at top.
  const cancelRestoreRef = useRef(false);

  const { saveActiveTabScroll } = useTabScrollMemory(activeTab, cancelRestoreRef);

  // Cross-tab jump from a tool-form pillar's help icon into the theory matrix. The `seq` bump makes
  // repeated clicks on the same pillar re-trigger the expand + scroll even when the tab is already open.
  const [matrixNav, setMatrixNav] = useState(null);

  // The cross-slide's only state: which tab is leaving and which way. One object rather than two pieces of
  // state so tab and direction can never be applied on different renders, which would show a frame sliding the
  // wrong way. Null whenever nothing is animating.
  const [tabExit, setTabExit] = useState(null);
  const exitTimerRef = useRef(0);

  // Clear the timer if the component unmounts mid-transition, so a stale callback can't set state on a
  // torn-down tree. (Re-entrant switches clear it in `goToTab` itself — see there.)
  useEffect(() => () => clearTimeout(exitTimerRef.current), []);

  /**
   * The one place a tab actually changes. Both entry points (a nav tap, and the pillar help icon's jump into
   * the matrix) go through here so the transition and the bookkeeping cannot drift between them.
   *
   * The caller is responsible for the no-op check; by the time we're here the tab IS changing.
   */
  const goToTab = (nextTab) => {
    saveActiveTabScroll();

    // A switch during a switch replaces the one in flight rather than queueing behind it, so only ever one
    // panel is exiting: the panel that was arriving starts leaving from wherever it had got to.
    clearTimeout(exitTimerRef.current);
    setTabExit({ tab: activeTab, direction: slideDirection(activeTab, nextTab) });
    exitTimerRef.current = setTimeout(() => setTabExit(null), TAB_TRANSITION_MS);

    setActiveTab(nextTab);
    syncTabInUrl(nextTab);
  };

  // Keeps the inactive tab's content (eight radar charts, on Theory) off the first-paint path:
  //
  //   deferred — first render, active panel only.
  //   prefit   — on the next idle callback: mount the inactive panel laid out but clipped, so its charts
  //              measure real frame widths and converge once (see TabPanel's `prefit`, and useChartFrameFit's
  //              memo, which makes the result survive to the switch).
  //   mounted  — back to `hidden`, charts already fitted.
  //
  // Because a chart pre-fits at the width it is shown at, the switch is a memo hit: one `chart.resize()` each
  // rather than eight converge loops at once, which is what the flash on the first switch to Theory was.
  const [inactivePhase, setInactivePhase] = useState("deferred");
  const inactiveMounted = inactivePhase !== "deferred";

  useEffect(() => {
    if (inactivePhase !== "deferred") {
      return undefined;
    }
    return scheduleIdle(() => setInactivePhase("prefit"));
  }, [inactivePhase]);

  useEffect(() => {
    if (inactivePhase !== "prefit") {
      return undefined;
    }
    const timer = setTimeout(() => setInactivePhase("mounted"), PREFIT_WINDOW_MS);
    return () => clearTimeout(timer);
  }, [inactivePhase]);

  // Theory tab's version-bump indicators. `unseenSections` drives a dot on each changed section's
  // heading; `theoryHasUnseenUpdates` is their aggregate and drives the dot on the Theory tab label.
  // Dismissal is per-section and requires BOTH the section's head and tail to have been in view
  // (TheoryContent observes edge sentinels) — NOT tab open, so the tab dot survives a drive-by visit.
  // Half-read progress is persisted, so the two edges can be reached in separate sessions.
  const {
    hasUnseenUpdates: theoryHasUnseenUpdates,
    unseenSections,
    markSectionEdgeSeen,
    isSectionEdgePairComplete,
    markSectionSeen,
  } = useTheoryUpdates();

  const handleTabChange = (nextTab) => {
    if (nextTab === activeTab) {
      // Re-tapping the active tab does nothing, deliberately. From a bottom bar under the thumb, the active
      // item is the easiest thing to hit by accident, and a hidden action that discards your scroll position
      // is the wrong thing to put there. (It used to scroll to top, back when nav was a header control.)
      return;
    }
    track("tab_view", { tab: nextTab });
    goToTab(nextTab);
  };

  const handleOpenPillarInMatrix = (pillarId) => {
    if (!pillarId) {
      return;
    }
    if (activeTab !== "theory") {
      // Theory restores its remembered scroll first; the matrix jump below then takes over. The slide is a
      // transform, so it moves no scroll coordinates and the two do not interfere.
      goToTab("theory");
    }
    setMatrixNav((prev) => ({ pillarId, seq: (prev?.seq ?? 0) + 1, cancelRestoreRef }));
  };

  // `min-w` on `main` is the app's usability floor, and it sits on `main` so it is measured against the
  // VIEWPORT: on a tab panel (nested inside padding) the same 350 would become a larger effective floor.
  // Nothing in this shell may clip that overflow, or the right edge becomes unreachable instead of scrollable.
  // That also rules out enforcing it with an inner scroll container, which would stop the sticky header pinning.
  //
  // `main` has NO max width (the per-tab measure lives on the panels) so the header and footer span the
  // viewport and the pinned header does not change width on tab switch. It has no vertical padding and no
  // corner radius either, both of which are only visible at `scrollY 0` and so made the sticky header appear to
  // move or change shape on arrival at the top.
  //
  // `flex-1` rather than a viewport height of its own: it gives the footer's `mt-auto` a floor while keeping
  // every viewport unit out of this box, which is what stops the fixed nav jumping (see the padding note below).
  return (
    /* `bg-slate-100` matches `body` in index.css, and the pairing is the point: this wrapper paints the surround
       beside the content measure, and `body`'s identical value is what an over-pull past the document reveals.
       Change them together or an over-pull opens a gap that reads as a hole behind the chrome. */
    <div className="flex min-h-dvh flex-col bg-slate-100 print:block print:min-h-0 print:bg-white print:p-0">
      {/* The bottom nav's height is reserved with padding alone, deliberately NOT a matching
          `min-h-[calc(100dvh - …)]`: arithmetic on a viewport unit in the box the fixed nav's `bottom: 0` anchor
          is compared against makes the bar paint high for a frame on every tab switch. Bare `min-h-dvh` is safe;
          the arithmetic was the hazard. The `env(safe-area-inset-bottom)` term matches the bar's own so the
          reservation tracks the real painted height on a notched iPhone. See
          docs/DECISIONS.md#bottom-nav-height-reservation. */}
      <main
        /* `relative` anchors a leaving tab panel, which goes `absolute` for the frames it lingers so it does not
           stack below the incoming one. `absolute` alone does not keep it out of the layout, which is why the
           panel is also `h-0 overflow-hidden` (see TabPanel). No z-index, so no stacking context. */
        className="relative flex w-full flex-1 flex-col bg-white pb-[calc(3.5rem+env(safe-area-inset-bottom))] print:max-w-none print:p-0 print:pb-0 print:shadow-none"
        style={{ minWidth: FE_UI.page.minWidthPx }}
      >
        {/* The sticky app header: brand lockup plus install pill, full-width and propless. Neither navigation
            (AppBottomNav) nor the framework title (Theory tab) lives here any more, so what is left is the only
            chrome that earns its permanent 56px on every screenful of both tabs. */}
        <AppShellHeaderStack />

        {/* `active || inactiveMounted` rather than `active`: a panel is mounted for good once it has been
            rendered even once, so switching away never tears down a chart or a scroll position. Only the very
            first render can skip a panel — see `inactivePhase`. */}
        <TabPanel
          label="Tool"
          active={activeTab === "tool"}
          prefit={inactivePhase === "prefit" && activeTab !== "tool"}
          leaving={tabExit?.tab === "tool"}
          animating={tabExit !== null}
          direction={tabExit?.direction ?? "left"}
          widthStyle={TAB_WIDTH_STYLE.tool}
        >
          {activeTab === "tool" || inactiveMounted ? (
            /* `isVisible` stays tied to `active`, not to whether the panel is painted: a tab just left should go
               idle at once, and the exit animation is a transform on an already-rendered tree. */
            <ToolContent isVisible={activeTab === "tool"} onOpenPillarInMatrix={handleOpenPillarInMatrix} />
          ) : null}
        </TabPanel>
        <TabPanel
          label="Theory"
          active={activeTab === "theory"}
          prefit={inactivePhase === "prefit" && activeTab !== "theory"}
          leaving={tabExit?.tab === "theory"}
          animating={tabExit !== null}
          direction={tabExit?.direction ?? "left"}
          widthStyle={TAB_WIDTH_STYLE.theory}
        >
          {activeTab === "theory" || inactiveMounted ? (
            <TheoryContent
              deepLink={deepLinkRef.current}
              onDeepLinkConsumed={() => {
                deepLinkRef.current = null;
                cleanTheoryDeepLinkParams();
              }}
              matrixNav={matrixNav}
              cancelRestoreRef={cancelRestoreRef}
              isVisible={activeTab === "theory"}
              unseenSections={unseenSections}
              markSectionEdgeSeen={markSectionEdgeSeen}
              isSectionEdgePairComplete={isSectionEdgePairComplete}
              markSectionSeen={markSectionSeen}
            />
          ) : null}
        </TabPanel>
        {/* MOUNTED ONLY WHEN THE TAB IS ACTIVE, unlike its two siblings. They stay mounted because a radar
            chart's sizing passes and a long document's scroll position are expensive to rebuild; this panel is
            two static link cards, so there is nothing to preserve and nothing to prefit. It also never renders
            at all for a non-admin, since the tab cannot be selected (see VALID_TABS). */}
        {IS_ADMIN ? (
          <TabPanel
            label="Admin"
            active={activeTab === "admin"}
            leaving={tabExit?.tab === "admin"}
            animating={tabExit !== null}
            direction={tabExit?.direction ?? "left"}
            widthStyle={TAB_WIDTH_STYLE.admin}
          >
            {/* Mounted while LEAVING as well as while active, unlike the `active`-only test its siblings' unmount
                rule would suggest — there has to be something in the box for the exit animation to slide, or
                switching away from Admin would animate an empty panel. It unmounts when the exit finishes. */}
            {activeTab === "admin" || tabExit?.tab === "admin" ? <AdminContent /> : null}
          </TabPanel>
        ) : null}

        {/* Rendered once inside `main` and outside both tabpanels, so it survives tab switches untouched.
            `mt-auto` pins it to the bottom of a short tab's content area. Not fixed: it is passive text, and
            AppBottomNav below it is what earns permanent viewport height.

            No background and no border, inheriting `main`'s white on purpose. AppBottomNav already separates
            itself from white content with an upward shadow, so a tint here (which would need a `border-t` to stay
            crisp) puts a second separator 56px from the first. See docs/DECISIONS.md#footer-has-no-chrome.

            `data-print-running` makes this a running footer on paper, repeated at the foot of every sheet. The
            print form differs from the screen one in both directions — it names the framework and drops the
            version — because paper travels without the header, tab bar and URL that identify this on screen.
            See docs/DECISIONS.md#print-running-footer and the `@page` rules in index.css. */}
        <footer data-print-running className="mt-auto px-3 py-2 text-center text-[11px] text-slate-500">
          © 2026 Jasper Loo Zhu Hang · <span className="hidden print:inline">{SITE_COPY.title} · </span>
          <a
            href="https://creativecommons.org/licenses/by-nc/4.0/"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-slate-700"
          >
            CC BY-NC 4.0
          </a>
          {/* Screen only, and the separator hides WITH it so print does not end on a dangling `·`. */}
          <span className="print:hidden">
            {" "}
            · <span className="tabular-nums">v{appVersion}</span>
          </span>
        </footer>
      </main>

      {/* Primary navigation. Rendered outside `main` because it is `fixed`: its position comes from the
          viewport, so keeping it out leaves it clear of `main`'s `min-w` floor and print overrides. `main`
          carries the matching bottom padding so content is not hidden underneath it. */}
      <AppBottomNav activeTab={activeTab} onTabChange={handleTabChange} theoryHasUnseenUpdates={theoryHasUnseenUpdates} />

      {/* Scroll-to-top, theory tab only: it is the only document long enough to need it, and on the tool tab a
          floating button would cover form rows. Outside `main` for the same reason as AppBottomNav. */}
      {activeTab === "theory" ? <ScrollTopFab /> : null}

      <Toaster />
    </div>
  );
}
