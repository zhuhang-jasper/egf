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

import { FE_UI, IS_ADMIN } from "@/constants";
import { cn } from "@/utils";
import { track } from "@/utils/analytics";
import { cleanTheoryDeepLinkParams, getTabFromUrl, parseTheoryDeepLink, syncTabInUrl } from "@/utils/theory-url";

const appVersion = import.meta.env.VITE_APP_VERSION;
// `admin` is only a valid tab while the dev unlock is on (see constants/features.js), which is what makes a
// stale `?tab=admin` or a remembered session tab fall back to the default for a normal visitor rather than
// selecting a tab the bottom nav is not showing. Kept in step with AppBottomNav's NAV_ITEMS.
const VALID_TABS = IS_ADMIN ? ["tool", "theory", "admin"] : ["tool", "theory"];

/**
 * A tab's content region. Once rendered, both panels stay MOUNTED and are toggled with `hidden` rather than
 * conditionally rendered — the radar chart's sizing passes and each tab's scroll position are expensive to
 * rebuild, and `isVisible` is what the children use to skip work while off screen. (First render is the one
 * exception: the inactive panel is skipped there and mounted on the next idle callback — see `inactivePhase`
 * in HomePage.)
 *
 * `widthStyle` caps the measure per tab (Theory's is 900 vs the tool's 550) while `main` itself stays
 * full-width, so the sticky header spans the viewport and does not change width when the tab changes.
 * `self-center` centres the capped box inside that full-width column. EACH PANEL CARRIES ITS OWN measure
 * rather than both taking the active tab's: a hidden panel then lays out at the width it will actually be
 * shown at, which is what lets its charts be pre-fitted (see `prefit`) and reused on the switch instead of
 * re-converging at a width that was never theirs.
 *
 * The bottom margin is the gap above the footer. It lives out here rather than on the footer because padding
 * there would only make that strip taller, and the footer's own top margin is already spoken for by `mt-auto`.
 *
 * `prefit` IS THE FIRST-PAINT PRELOAD. A `display: none` panel has no width, so a chart inside it cannot
 * measure its frame and cannot converge — which is why the first switch to Theory used to fit all eight of its
 * radars at once and flash. In this mode the panel is laid out for real (so every frame has its true width and
 * every fit converges and memoises), but `h-0 overflow-hidden` clips it to nothing and contributes no document
 * height, and `inert` keeps focus and pointers out. It is invisible and costs no layout above it, yet the
 * charts inside come out fitted. HomePage holds it for a short window after mounting the inactive panel, then
 * drops back to `hidden`.
 *
 * `overflow-x-clip max-w-full` WHILE INACTIVE, to stop a one-frame horizontal scrollbar on tab switch: on the
 * frame a switch commits, the outgoing panel can still be laid out at the wider measure. That overflows the
 * document horizontally for a frame, the browser shows a scrollbar, and the visual viewport shrinks — which the
 * `fixed` bottom nav is positioned against, so it visibly jumps ~15px (see AppBottomNav for the frame trace).
 *
 * BOTH HALVES ARE LOAD-BEARING, and the clip alone was not enough — this was still reproducing with it in
 * place. `overflow-x: clip` contains what is inside the box; it cannot clip the box itself, and the panel's own
 * border-box is what overflows, since each panel carries its tab's measure (550 / 900) as a `max-width` on top
 * of `w-full` and `px-3`. `max-w-full` caps the box at its container so it cannot exceed the viewport at all.
 *
 * Clipping only the INACTIVE panel is what makes this safe: the visible panel keeps `visible` overflow, so nothing
 * that should be able to escape its box (tooltips, dropdowns) is affected, and a hidden panel has nothing to show
 * anyway. Fixing it here rather than by clipping `body` matters — `body` must keep `overflow-x: auto` so the 350px
 * min-width floor stays reachable at narrow viewports (see index.css).
 *
 * THE TAB TRANSITION (`leaving` / `animating` / `direction`) IS ONE-SIDED: the arriving tab slides and fades in,
 * and the departing one is not animated at all, just hidden. It started as a cross-fade and that GHOSTED — two
 * semi-transparent copies of the app overlaid, the old tab's headings legible through the new one's. Cross-fading
 * two opaque full-page layouts always does; no pair of intermediate opacities shows only one of them. See the
 * keyframes note in index.css. Do not reintroduce an exit animation to "balance" the entrance.
 *
 * IT IS ALSO A THIRD WAY INTO THAT SAME SCROLLBAR BUG, and it is worth reading the two notes above before
 * touching it. The enter animation starts at a horizontal offset, i.e. content pushed to the side of where it
 * will rest — on a full-width panel that is horizontal overflow by construction, and it made the nav hop on
 * every single switch rather than only on the first frame after one.
 *
 * Two things keep it contained, and both are needed. The transform is on an INNER WRAPPER rather than on the
 * panel, so what moves is inside a box that can be clipped (a clip never crops the box it is declared on — the
 * lesson already learned above). And the panel takes `overflow-x-clip` FOR THE DURATION of the entrance, which is
 * the one window where the visible panel cannot keep `visible` overflow. It is given back immediately after, so
 * the steady-state guarantee that tooltips and dropdowns can escape their box is unchanged.
 *
 * `animating` IS WHAT KEEPS THIS OFF THE FIRST PAINT. It is true only while a switch is in flight, so the
 * entrance does not run when a panel first mounts — the app would otherwise slide in on every cold load, and
 * the prefit pass (which lays the inactive panel out for real) would animate an invisible panel for nothing.
 */
function TabPanel({ label, active, prefit = false, leaving = false, animating = false, direction = "left", widthStyle, children }) {
  // THE LEAVING PANEL IS INVISIBLE AND ZERO-HEIGHT, WHICH IS WHY THERE IS SO LITTLE MACHINERY HERE. An earlier
  // version faded it out, and to do that correctly it had to be `fixed` at a viewport offset measured in a
  // layout effect, with a `maxHeight` clipping it to the visible region, so that the incoming panel did not
  // stack below it and the per-tab scroll restore did not drag it mid-fade.
  //
  // All of that existed to make a VISIBLE exit behave, and the visible exit is exactly what caused the
  // ghosting (see the keyframes note in index.css). With nothing painted there is nothing to mis-position,
  // drag, or overlap, so what remains is only the two things a still-mounted panel must not do: be seen
  // (`opacity: 0`) and take up space (`h-0`, see the class list). It stays displayed rather than
  // `display: none` — see the `hidden` note below for why that distinction is still load-bearing.
  return (
    <div
      className={cn(
        "w-full self-center px-3",
        // `h-0` INSTEAD OF THE MARGINS whenever the panel is laid out but must occupy no height — which is two
        // distinct cases with one requirement. `prefit` is the first-paint preload (see the class doc), and
        // `leaving` is the outgoing panel during a tab switch (see its positioning note below). In both, the
        // panel is displayed so its contents lay out for real, while `hidden`'s zero footprint is what the
        // document must actually see. The margins have to go with the height: 12px of margin on a zero-height
        // box still grows the document, which is the whole thing these two modes exist to avoid.
        prefit || leaving ? "h-0 overflow-hidden" : "mt-3 mb-0",

        // `overflow-x: clip` ON THE INACTIVE PANEL. It contains what is INSIDE the box; the box itself is capped
        // by `maxWidth` in the style object below, which is where that has to happen — see the note there.
        //
        // KEYED OFF `active`, AND IT MUST STAY THAT WAY. This was briefly widened to "active OR leaving", to
        // stop the clip cropping anything that overhangs the panel while it animates out — which reintroduced
        // the one-frame horizontal scrollbar that makes the fixed bottom nav jump (see AppBottomNav's frame
        // trace and the `overflow-x: auto` note on `body` in index.css). A leaving panel is still laid out at
        // its own measure, so it has to keep the clip for exactly the same reason a hidden one does. The
        // overhang concern was theoretical, the scrollbar is not.
        //
        // THE SLIDE ITSELF IS CLIPPED HERE TOO, and that is the other half of the same fix: the transform lives
        // on the inner wrapper below rather than on this box, so `translateX` moves content INSIDE a clipped
        // container instead of moving the container past the document's edge.
        !active && "overflow-x-clip",

        // THE LEAVING PANEL MUST CONTRIBUTE NO HEIGHT, and `absolute` IS NOT ENOUGH TO ACHIEVE THAT.
        //
        // It was `absolute inset-x-0`, on the reasoning that out-of-flow means out of the layout. It does not:
        // an absolutely-positioned box still extends the scrollable overflow of its containing block, which is
        // `main` (the `relative` there). So switching from the many-screens-tall Theory tab to the short Tool
        // tab left Theory's full height propping the document open for the whole transition window, and the
        // scrollbar visibly stayed long and then snapped short when the timer dropped the panel — read as the
        // scrollbar "growing at a delay".
        //
        // `h-0 overflow-hidden` is the fix, and it comes from the SAME TREATMENT `prefit` ALREADY USES — which
        // is why both now share one branch at the top of this list rather than each declaring their own. The
        // panel keeps a box (so its children are not torn down or reflowed while they wind down) and the
        // document is sized by the incoming tab alone, from the first frame.
        //
        // What stays here is only what is specific to leaving: `absolute` so the zero-height box cannot affect
        // the flex column's own sizing, `inset-x-0` so its width still resolves against `main` rather than
        // shrink-wrapping, and `pointer-events-none` so it cannot swallow a tap aimed at the new tab.
        leaving && "pointer-events-none absolute inset-x-0",

        // THE ARRIVING PANEL IS CLIPPED FOR THE LENGTH OF ITS ENTRANCE, and this is the fix for the bottom nav
        // jumping on tab switch. The enter animation starts offset horizontally — content pushed to the side of
        // its resting place — and on any viewport where the panel already spans the full width, that pushed its
        // right edge past the document's and raised a horizontal scrollbar for the frames it was in flight. A
        // horizontal scrollbar shrinks the VISUAL viewport, which is what `bottom: 0` on the fixed nav resolves
        // against, so the bar hopped up by the scrollbar's height and back (see AppBottomNav).
        //
        // The transform is on the inner wrapper (below), so clipping here contains it without the clip itself
        // being what moves. Temporary, and only while animating: the panel goes back to `visible` overflow the
        // moment the entrance ends, so tooltips and dropdowns that need to escape their box are unaffected in
        // the steady state — which is the same reason the inactive-panel clip above is safe.
        //
        // `overflow-x-clip` rather than `overflow-x-hidden`: `hidden` would make this a scroll CONTAINER, and an
        // ancestor scroll container is what would stop the sticky header pinning to the viewport (see the note
        // on `main` in HomePage). `clip` crops without creating one.
        active && !prefit && animating && "overflow-x-clip",
      )}
      /* `min(measure, 100%)` rather than the measure raw, so the panel's own border-box can never be wider than
         its container and become the thing that overflows the document horizontally. Cheap belt-and-braces: the
         `w-full` + `px-3` box is already within the viewport in practice, and the one-frame scrollbar that made
         the bottom nav jump turned out to be the invisible tooltips instead (see AppBottomNav's note and
         components/ui/Tooltip.jsx). Kept because a panel measure wider than the viewport is a real possibility
         at narrow widths and this costs nothing.

         INLINE, NOT A `max-w-full` CLASS: this is an inline style, and inline styles beat utility classes, so a
         Tailwind cap alongside it would be silently overridden. The clamp has to be in the same declaration. */
      style={{
        maxWidth: `min(${widthStyle.maxWidth}px, 100%)`,
        // Feeds the `.tab-enter-*` / `.tab-leave-*` rules in index.css. The duration lives in JS because the
        // same number drives the timer that decides how long a leaving panel stays mounted — see
        // TAB_TRANSITION_MS. Only set while animating, so an idle panel carries no stray custom property.
        ...(active && animating ? { "--tab-transition-ms": `${TAB_TRANSITION_MS}ms` } : null),
      }}
      role="tabpanel"
      /* THE LEAVING PANEL IS DELIBERATELY NOT `hidden` FOR THE FEW FRAMES IT LINGERS, even though it is
         invisible and `display: none` would look identical. Flipping display on the outgoing panel in the same
         commit that mounts the incoming one is a layout change on both halves at once, in the exact frame the
         switch is trying to keep smooth — and it is what the whole `hidden`-vs-mounted design above exists to
         avoid. It stays displayed, out of flow, at `opacity: 0`, and returns to `hidden` once the phase timer
         clears the flag and nothing else is in flight. */
      hidden={!active && !prefit && !leaving}
      /* Both stay keyed to `active`, NOT to whether the panel is painted. The leaving panel is an invisible
         remnant of a tab the user has already navigated away from: it must not be reachable by tab order,
         pointers, or a screen reader while it lingers, or the switch would briefly expose two tabpanels. */
      aria-hidden={!active}
      inert={!active}
      aria-label={label}
    >
      {/* THE ENTRANCE ANIMATION LIVES HERE, ONE LEVEL IN FROM THE PANEL — deliberately not on the panel itself.
          A `translateX` on the panel moves the panel's own border-box, and a box moved sideways of its resting
          place extends the document's scrollable width: that is what raised a horizontal scrollbar mid-switch
          and made the fixed bottom nav hop (see the clip notes above). Moving the transform inside means the
          panel stays exactly where it is and only its CONTENTS slide, so the panel's `overflow-x-clip` can
          contain the movement — a clip cannot crop the box it is declared on, only what is inside it.

          A PLAIN WRAPPER WITH NO CLASSES WHEN IDLE, which is the overwhelmingly common case. It adds a div to
          the tree but no styles, so it creates no containing block, no stacking context, and no layout of its
          own — the panel's children lay out against the panel exactly as they did before this existed. */}
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

/** Per-tab content measure, in px. Constant per tab. TabPanel clamps it with `min(…, 100%)` rather than using
 *  it raw — see the note on its `style` for why the panel's box must never exceed the viewport. */
const TAB_WIDTH_STYLE = {
  tool: { maxWidth: FE_UI.page.maxWidthPx },
  theory: { maxWidth: FE_UI.page.theoryMaxWidthPx },
  // The tool's measure, not theory's: two cards in a row want the narrower column, and it matches the
  // bottom nav's own cap so the Admin item sits under the content it navigates.
  admin: { maxWidth: FE_UI.page.maxWidthPx },
};

/**
 * How long the inactive panel stays in `prefit` before going back to `hidden`. It only has to outlast the
 * charts' own startup (each waits two rAFs after construction before its first fit), and the panel is
 * invisible and zero-height throughout, so this is deliberately generous rather than tight.
 */
const PREFIT_WINDOW_MS = 300;

/**
 * How long a tab switch's cross-slide runs. Drives BOTH the CSS animation (passed down as
 * `--tab-transition-ms`, see TabPanel and index.css) and the timer that keeps the outgoing panel mounted,
 * which is why it is one constant here rather than a value in the stylesheet: if the timer were shorter the
 * exit would be cut off mid-flight, and if it were longer the panel would sit on a finished frame.
 *
 * Short on purpose. This fires on every navigation between two tabs the user moves between constantly, and a
 * transition long enough to notice as an animation is long enough to be in the way by the tenth time. It is
 * meant to convey which direction you moved, not to be watched.
 *
 * WAS 220ms, WHICH READ AS A DELAY rather than as motion. The duration was only half of why (see the easing
 * note in index.css — the entrance also used to start fully transparent, which withheld a page that was
 * already laid out); but at 220ms the tail of the settle was still perceptible as waiting for the page to
 * arrive when the page was demonstrably already there. 160ms with the exit at 60% of it puts the whole switch
 * inside the window where it registers as a transition having happened rather than as one being watched.
 *
 * Do not raise this to make the slide more visible. If the motion needs more presence, the distance in the
 * keyframes is the knob — time is the part the user feels as lag.
 */
const TAB_TRANSITION_MS = 160;

/**
 * Nav order, used ONLY to derive which way a switch slides — matched to NAV_ITEMS in AppBottomNav, so the
 * content moves the same direction as the item you tapped. Moving to a later tab pushes the old content left
 * ("left"); moving back pushes it right. Admin is included unconditionally: it is only ever the active tab
 * when IS_ADMIN, and an index for a tab that cannot be selected costs nothing.
 *
 * Deliberately separate from VALID_TABS, which answers a different question (may this tab be selected at all).
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

  // Flipped by an in-tab scroll the instant it runs (cross-tab matrix jump, or a deep-link's scroll
  // to its target), so the restore loop yields to it: restore still runs first — landing at the
  // remembered scroll with the bar kept stuck — then the jump/glide takes over. Reset by the hook at
  // the start of each tab switch.
  const cancelRestoreRef = useRef(false);

  // Restore runs even on a deep-link boot now: it lands at the remembered scroll (bar stuck) and the
  // deep-link's own scroll-to-target then takes over via cancelRestoreRef — so a shared link restores
  // the previous position before gliding to the target, instead of starting from the top.
  const { saveActiveTabScroll } = useTabScrollMemory(activeTab, cancelRestoreRef);

  // Cross-tab jump from a tool-form pillar's help icon into the theory matrix. The `seq` bump makes
  // repeated clicks on the same pillar re-trigger the expand + scroll even when the tab is already open.
  const [matrixNav, setMatrixNav] = useState(null);

  // THE CROSS-SLIDE'S ONLY STATE: which tab is on its way out, and which way the pair is moving. Null when
  // nothing is animating, which is the overwhelmingly common case — every panel then renders exactly as it
  // did before this existed.
  //
  // It is a single object rather than two pieces of state so the tab and its direction can never be applied
  // on different renders, which would show one frame of the outgoing panel sliding the wrong way.
  const [tabExit, setTabExit] = useState(null);
  const exitTimerRef = useRef(0);

  // Clear the timer if the component unmounts mid-transition, so a stale callback can't set state on a
  // torn-down tree. (Re-entrant switches clear it in `goToTab` itself — see there.)
  useEffect(() => () => clearTimeout(exitTimerRef.current), []);

  /**
   * The one place a tab actually changes. Both entry points (a nav tap, and the pillar help icon's jump into
   * the theory matrix) go through here so the transition is identical either way and the bookkeeping — saving
   * the outgoing scroll, the URL, the exit phase — can't drift between them.
   *
   * The caller is responsible for the no-op check; by the time we're here the tab IS changing.
   */
  const goToTab = (nextTab) => {
    saveActiveTabScroll();

    // A SWITCH DURING A SWITCH REPLACES THE ONE IN FLIGHT rather than queueing behind it. Tapping Tool →
    // Theory → Tool quickly is a normal thing to do on a bottom bar, and the second tap's outgoing panel is
    // the first tap's incoming one. Clearing the pending timer and overwriting `tabExit` means the panel that
    // was arriving starts leaving from wherever it had got to, and only ever one panel is exiting at a time.
    clearTimeout(exitTimerRef.current);
    setTabExit({ tab: activeTab, direction: slideDirection(activeTab, nextTab) });
    exitTimerRef.current = setTimeout(() => setTabExit(null), TAB_TRANSITION_MS);

    setActiveTab(nextTab);
    syncTabInUrl(nextTab);
  };

  // THE INACTIVE TAB'S CONTENT IS NOT ON THE FIRST-PAINT PATH. The theory tab holds eight radar charts
  // (a hero, three career tracks, and the foundational phase's carousel plus its desktop 3-up grid), and
  // building all of them plus that tab's document was work the boot render did before showing the user the
  // one tab they asked for. Three phases, in order:
  //
  //   deferred — first render, active panel only.
  //   prefit   — on the next idle callback: mount the inactive panel LAID OUT BUT CLIPPED, so its charts
  //              measure their real frame widths and converge once (see TabPanel's `prefit`, and the fit
  //              memo in useChartFrameFit that makes the result survive to the switch).
  //   mounted  — the panel goes back to `hidden`, its charts already fitted.
  //
  // The point of the middle phase is that the width a chart pre-fits at is the width it is shown at, so the
  // switch is a memo hit — one `chart.resize()` per chart instead of eight converge loops at once, which is
  // what the flash on the first switch to Theory was.
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
      // Re-tapping the active tab does NOTHING. It used to scroll to the top, which made sense while navigation
      // was a segmented control in the header: the control was next to the title, so "go back to the top" read
      // as part of the same gesture, and the affordance was announced by a tooltip on hover.
      //
      // From a bottom bar it reads as a mis-tap instead. The bar is under the thumb, so the active item is the
      // easiest thing on screen to hit by accident, and a hidden action that throws away your scroll position is
      // the wrong thing to put there — on touch there is no hover, so nothing advertises it either.
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
      // Let the theory tab restore its remembered scroll; the matrix jump (below) takes over once it
      // scrolls to the pillar card. No header anchor to carry — collapse is a shared boolean now.
      //
      // Cross-slides like any other switch. The jump's own scroll to the pillar card runs alongside it and
      // is unaffected: the slide is a transform on the panel, so it moves no scroll coordinates.
      goToTab("theory");
    }
    setMatrixNav((prev) => ({ pillarId, seq: (prev?.seq ?? 0) + 1, cancelRestoreRef }));
  };

  // `min-w` ON `main` IS THE APP'S USABILITY FLOOR — below it the radar chart and the form's label/stepper rows
  // stop being usable rather than merely cramped. It sits on `main` and so is measured against the VIEWPORT,
  // which is the only place the number means what it says; on a tab panel (nested inside padding) the same 350
  // would silently become a larger effective floor.
  //
  // Nothing in this shell may CLIP that overflow, or the floor would make the app's right edge unreachable
  // instead of scrollable. So the outer div sets no `overflow-x` at all, and `body` is `overflow-x: auto`
  // (see index.css). The document simply grows wider than the viewport and the window scrolls it, which is
  // also why the floor must not be enforced by an inner scroll container: `overflow-x` on an ancestor of the
  // header would make it a scroll container, and `sticky top-0` would then pin to that box rather than the
  // viewport — on a container only as tall as its content, meaning it would never pin at all.
  //
  // NO VERTICAL PADDING above or below the card, and no corner radius, because the header is sticky.
  //
  // Black padding above the card is only ever visible at the very top of the page: once the header pins, that
  // padding has scrolled away. So the header sat that much lower at `scrollY 0` than it did anywhere else, and
  // scrolling to the top made it visibly shift down by the padding's height — when a sticky bar is meant to be
  // the one thing that never moves. The corner radius had the same problem: rounded top corners are only on
  // screen at `scrollY 0`, so the header changed shape on arrival at the top.
  //
  // No horizontal gutters either. The black is already visible down both sides wherever the content stops
  // short of the viewport, so gutters add nothing there — and on narrow screens they are pure waste, taking
  // width from exactly the sizes with the least to give.
  //
  // `main` HAS NO MAX WIDTH; the per-tab measure lives on the tab panels. That is what lets the sticky header
  // and footer span the viewport while the content between them keeps a readable measure, and it stops the
  // pinned header changing width when you switch tabs (Theory's measure is 900 vs the tool's 550).
  // `self-center` on each panel centres the constrained content.
  //
  // It DOES have a min width — the app's usability floor, covering header, body and footer alike since all
  // three are its children. See the note above the return for why the floor lives here and not on the panels.
  //
  // `main` carries `flex-1` (filling the `min-h-dvh` wrapper) rather than a viewport height of its own, and no
  // horizontal padding. The height is what lets the footer's `mt-auto` push to the bottom when a tab's content is
  // short; doing it with `flex-1` instead of `min-h-dvh` keeps every viewport unit out of this box, which is what
  // stops the fixed bottom nav jumping on tab switch (see the padding note below the return). The absent padding
  // is what lets the footer and the sticky header both bleed to the real edges — the 12px inset they would have
  // inherited lives on the pieces that want it: `px-3` on each tab panel, and the header's own `p-3`.
  return (
    /* `flex min-h-dvh flex-col` so `main` below can fill it with `flex-1` — which is what gives the footer's
       `mt-auto` a floor to push against without `main` itself doing viewport arithmetic (see the note on its
       padding for why any `calc()` on a viewport unit there made the fixed nav jump). `min-h-dvh` as a bare unit
       is fine; it is the arithmetic that was the problem. */
    /* `bg-slate-100` MATCHES `body` (index.css), AND THAT PAIRING IS THE POINT. This wrapper paints the
       surround visible down both sides once the viewport is wider than the content measure; `body`'s
       identical value propagates to the canvas and is what an over-pull past either end of the document
       reveals. Both were `bg-black` — one decision, split across two files — and the over-pull was the
       half that failed: a black gap opening above the `bg-slate-100` header read as a hole behind the
       chrome. Changing only `body` would have fixed the rubber-band and left a black column beside the
       page, so the two move together. */
    <div className="flex min-h-dvh flex-col bg-slate-100 print:block print:min-h-0 print:bg-white print:p-0">
      {/* THE BOTTOM NAV'S HEIGHT IS RESERVED WITH PADDING ALONE — `pb-[…]`, and deliberately NOT paired with a
          `min-h-[calc(100dvh - …)]` to match.

          That calc is what made the fixed nav jump upward for a frame on every tab switch. `dvh` resolves against
          the viewport, and the browser re-resolves it when the layout viewport changes — which a tab switch does,
          because the two tabs' content measures differ enough to add or drop the vertical scrollbar. For the frame
          in which that is being recomputed, `main`'s height and the nav's `bottom: 0` anchor disagree, and the bar
          paints high before settling. Any viewport unit here reintroduces it.

          `min-h-dvh` on its own is safe and is what `html`/`body`/`#root` already use (see index.css) — the
          hazard was specifically doing ARITHMETIC on a viewport unit in the same box whose height the fixed
          element's anchor is compared against.

          The padding alone is enough for what this actually has to do: keep the footer and the end of a tab's
          content out from under the bar. It does mean the shortest possible page is the bar's height taller than
          the viewport, so a very short tab can scroll by ~56px — a far smaller cost than a visible jump on every
          switch, and `min-h-dvh` is left off `main` entirely so the footer's `mt-auto` still has a floor to push
          against via `#root`.

          The `env(safe-area-inset-bottom)` term matches the bar's own — see AppBottomNav — so the reservation
          tracks the real painted height on a notched iPhone rather than assuming zero.

          `print:pb-0`: the bar is `print:hidden`, so on paper there is nothing to reserve for. */}
      <main
        /* `relative` IS THE ANCHOR FOR A LEAVING TAB PANEL, which goes `position: absolute` for the few frames
           it stays mounted after a tab switch so it does not stack below the incoming one (see TabPanel).
           Without a positioned ancestor here it would resolve against the initial containing block instead and
           take its width from the viewport rather than from this column.

           NOTE THAT `absolute` ALONE DOES NOT KEEP IT OUT OF THE LAYOUT: an out-of-flow box still extends the
           scrollable overflow of its containing block, which is this element. That is why the leaving panel is
           also `h-0 overflow-hidden` — see TabPanel, where getting this wrong left the tall Theory tab propping
           the scrollbar open after switching to the short Tool tab.

           It creates NO stacking context of its own (no z-index), so nothing that overlays this subtree —
           tooltips, dialogs, the fixed bottom nav outside it — changes behaviour. */
        className="relative flex w-full flex-1 flex-col bg-white pb-[calc(3.5rem+env(safe-area-inset-bottom))] print:max-w-none print:p-0 print:pb-0 print:shadow-none"
        style={{ minWidth: FE_UI.page.minWidthPx }}
      >
        {/* The sticky app header: the brand lockup and the scroll-to-top button, which the stack positions in
            its own two corners. Full-width, so it spans the viewport regardless of which tab's measure is active
            below it, and PROPLESS — it holds no state and takes none.

            NEITHER NAVIGATION NOR THE TITLE IS IN HERE. Navigation was a segmented control in a second row of
            this stack and now sits at the viewport bottom (AppBottomNav, rendered after the footer below); the
            framework title and tagline were a collapsible block in the first row and now open the Theory tab
            (see TheoryContent). What is left is pinned chrome that costs the same 56px on every screenful of
            both tabs, which is the only thing that earns a place there. */}
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
            /* `isVisible` STAYS TIED TO `active`, not to whether the panel is painted. It is what the children
               use to skip work while off screen, and a tab the user has just left should go idle immediately —
               the exit animation is a transform on an already-rendered tree and needs no updates to run. */
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

        {/* Inside `main` and full-bleed, so it reads as the page's own footer rather than a strip of the page
            behind it.

            `mt-auto` against `main`'s `min-h` is what pins it to the bottom of the content area when a tab's
            content is short, while letting it sit after the content on a long page. Deliberately NOT fixed: it
            is passive text, so pinning it would spend permanent viewport height on something nobody needs
            mid-scroll — which is a live distinction now that AppBottomNav sits fixed below it and does earn that
            height.

            Rendered once outside both tabpanels, so it survives tab switches untouched. */}
        {/* NO BACKGROUND AND NO BORDER — IT INHERITS `main`'s WHITE AND IS DELIBERATELY NOT PART OF THE CHROME.
            This went black → `bg-slate-100` → nothing, and each step was a correction to the one before.

            Black read as the page's own base while this was the last thing on screen. It stopped being the last
            thing when AppBottomNav arrived fixed directly beneath it, and a black strip meeting a light bar looked
            like two unrelated pieces of chrome stacked by accident. The fix at the time was to give it the tint the
            header and the nav carry, so all three read as one surface framing the white content.

            That over-corrected. The nav ALREADY separates itself from white content with an upward shadow (see
            AppBottomNav) — that is the whole reason it has no `border-t` — so the tint was buying a second copy of
            a boundary the nav owns, and the `border-t` it needed to keep that tint from going mushy put a hairline
            56px above the nav's shadow. Two separators that close together is exactly the objection that got the
            `border-b` removed from this element earlier. Dropping both leaves ONE bottom boundary: the nav's
            shadow, cast onto white, which is the case it was designed for.

            What the chrome loses is nothing real. The header still bounds the top with a tint plus `border-b`, the
            nav still bounds the bottom; this is passive legal text, and it reads as the end of the content rather
            than as a band of UI, which is what it actually is.

            The surround survives where it still means something: the page wrapper outside `main`, which shows
            down both sides once the viewport is wider than the content measure. That wrapper is no longer black
            either — it now carries the chrome's own `bg-slate-100` so an over-pull at either end of the document
            does not open a black gap above the header or below the nav (see the wrapper's own note).

            THAT DOES NOT REOPEN THE TINT QUESTION HERE. The objection to tinting this footer was never the
            particular colour; it was that the nav's upward shadow already draws this boundary, and a tint needs a
            `border-t` to stay crisp, putting a second separator 56px from the first. Both still hold. This element
            keeps inheriting `main`'s white, and the shadow still falls on white, which is the case it was drawn
            for.

            `text-slate-500` OUTLASTED BOTH BACKGROUNDS. It replaced `text-white/60` when the black went, and it is
            the same muted weight against white that it was against the tint — it needs no revisiting here.

            The tab panels' own bottom margin supplies the gap above — padding here would only make the strip
            taller, and `mt-*` is unavailable because `mt-auto` owns that margin to push the footer down on short
            pages.

            NO `print:` OVERRIDES LEFT. There were two, `print:border-0 print:bg-transparent`, and both existed only
            to undo the tint and the hairline on paper; with neither declared, the printed running footer gets the
            transparent, borderless box it always wanted by default. */}
        {/* `data-print-running` opts this into being a RUNNING FOOTER on paper — repeated at the foot of
            every sheet rather than appearing once at the end. See the `@page`/fixed-position rules in
            index.css for how that works and why page numbers are not part of it. */}
        <footer data-print-running className="mt-auto px-3 py-2 text-center text-[11px] text-slate-500">
          © 2026 Jasper Loo Zhu Hang · All rights reserved · <span className="tabular-nums">v{appVersion}</span>
        </footer>
      </main>

      {/* PRIMARY NAVIGATION, pinned to the viewport bottom rather than sitting in the header — see AppBottomNav
          for why it moved. Rendered outside `main` because it is `fixed`: its position comes from the viewport,
          not from this flow, and keeping it out of `main` means it is not caught by that element's `min-w` floor
          or its print overrides.

          `main` carries the matching bottom padding (see its className) so the footer and the end of a tab's
          content are not hidden underneath this bar. */}
      <AppBottomNav activeTab={activeTab} onTabChange={handleTabChange} theoryHasUnseenUpdates={theoryHasUnseenUpdates} />

      {/* SCROLL-TO-TOP, THEORY TAB ONLY. It used to live in the header's right corner, which the install pill now
          holds (see AppShellHeader and InstallPrompt's InstallPill). Gated on the tab rather than rendered always
          because the theory document is the only thing here long enough to need it — the tool tab is a chart and a
          form in about two screenfuls, and a floating button over the form's right edge would cover input rows to
          save a gesture nobody was asking for. See ScrollTopFab.

          Outside `main` alongside AppBottomNav, and for the same reason: it is `fixed`, so its position comes from
          the viewport rather than this flow, and keeping it out of `main` leaves it clear of that element's
          `min-w` floor and print overrides. */}
      {activeTab === "theory" ? <ScrollTopFab /> : null}

      <Toaster />
    </div>
  );
}
