import { useRef, useState } from "react";

import { AppBottomNav } from "@/components/AppBottomNav";
import { AppShellHeaderStack, AppShellIntro } from "@/components/AppShellHeader";
import { TheoryContent } from "@/components/TheoryContent";
import { ToolContent } from "@/components/ToolContent";
import { Toaster } from "@/components/ui/Toaster";

import { useHeaderCollapse } from "@/hooks/useHeaderCollapse";
import { getPersistedActiveTab, useTabScrollMemory } from "@/hooks/useTabScrollMemory";
import { useTheoryUpdates } from "@/hooks/useTheoryUpdates";

import { FE_UI } from "@/constants";
import { cn } from "@/utils";
import { track } from "@/utils/analytics";
import { cleanTheoryDeepLinkParams, getTabFromUrl, parseTheoryDeepLink, syncTabInUrl } from "@/utils/theory-url";

const appVersion = import.meta.env.VITE_APP_VERSION;
const VALID_TABS = ["tool", "theory"];

/**
 * A tab's content region. Both panels stay MOUNTED at all times and are toggled with `hidden` rather than
 * conditionally rendered — the radar chart's sizing passes and each tab's scroll position are expensive to
 * rebuild, and `isVisible` is what the children use to skip work while off screen.
 *
 * `widthStyle` caps the measure per tab (Theory is wider) while `main` itself stays full-width, so the sticky
 * header spans the viewport and does not change width when the tab changes. `self-center` centres the capped
 * box inside that full-width column.
 *
 * The bottom margin is the gap above the footer. It lives out here rather than on the footer because padding
 * there would only make that strip taller, and the footer's own top margin is already spoken for by `mt-auto`.
 *
 * `overflow-x-clip` WHILE INACTIVE, to stop a one-frame horizontal scrollbar on tab switch. Both panels share one
 * `widthStyle` derived from the ACTIVE tab, so on the frame a switch commits, the outgoing panel is momentarily
 * still laid out with content sized for the old (wider) measure inside the new (narrower) one. That overflowed the
 * document horizontally for a frame, the browser showed a scrollbar, and the visual viewport shrank — which the
 * `fixed` bottom nav is positioned against, so it visibly jumped ~15px.
 *
 * Clipping only the INACTIVE panel is what makes this safe: the visible panel keeps `visible` overflow, so nothing
 * that should be able to escape its box (tooltips, dropdowns) is affected, and a hidden panel has nothing to show
 * anyway. Fixing it here rather than by clipping `body` matters — `body` must keep `overflow-x: auto` so the 350px
 * min-width floor stays reachable at narrow viewports (see index.css).
 */
function TabPanel({ label, active, widthStyle, children }) {
  return (
    <div
      className={cn("mt-3 mb-0 w-full self-center px-3", !active && "overflow-x-clip")}
      style={widthStyle}
      role="tabpanel"
      hidden={!active}
      aria-hidden={!active}
      aria-label={label}
    >
      {children}
    </div>
  );
}

// Parse once at module evaluation time so the URL is read before React renders.
const BOOT_DEEP_LINK = parseTheoryDeepLink();

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

  // The intro's collapsed state is CSS, not a scroll position — one boolean shared by both tabs, changed
  // ONLY by the user (the caret, or a pull at the top). Scrolling no longer touches it in either direction;
  // see useHeaderCollapse for why having two writers for this one bit was the source of the whole class of
  // bugs here.
  const { collapsed: headerCollapsed, setCollapsed: setHeaderCollapsed } = useHeaderCollapse();

  // Cross-tab jump from a tool-form pillar's help icon into the theory matrix. The `seq` bump makes
  // repeated clicks on the same pillar re-trigger the expand + scroll even when the tab is already open.
  const [matrixNav, setMatrixNav] = useState(null);

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
    saveActiveTabScroll();
    track("tab_view", { tab: nextTab });
    setActiveTab(nextTab);
    syncTabInUrl(nextTab);
  };

  const handleOpenPillarInMatrix = (pillarId) => {
    if (!pillarId) {
      return;
    }
    if (activeTab !== "theory") {
      // Let the theory tab restore its remembered scroll; the matrix jump (below) takes over once it
      // scrolls to the pillar card. No header anchor to carry — collapse is a shared boolean now.
      saveActiveTabScroll();
      setActiveTab("theory");
      syncTabInUrl("theory");
    }
    setMatrixNav((prev) => ({ pillarId, seq: (prev?.seq ?? 0) + 1, cancelRestoreRef }));
  };

  // Applied to each TAB PANEL, not to `main`. The sticky header spans the full viewport while the content it
  // sits above stays bound to a readable measure — and since the two tabs want different measures (Theory is
  // 900 vs the tool's 550), constraining `main` meant the pinned header physically changed width when you
  // switched tabs, which is not something a fixed bar should do.
  const contentWidthStyle = {
    maxWidth: activeTab === "theory" ? FE_UI.page.theoryMaxWidthPx : FE_UI.page.maxWidthPx,
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
    <div className="flex min-h-dvh flex-col bg-black print:block print:min-h-0 print:bg-white print:p-0">
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
          the viewport, so a very short tab can scroll by ~48px — a far smaller cost than a visible jump on every
          switch, and `min-h-dvh` is left off `main` entirely so the footer's `mt-auto` still has a floor to push
          against via `#root`.

          The `env(safe-area-inset-bottom)` term matches the bar's own — see AppBottomNav — so the reservation
          tracks the real painted height on a notched iPhone rather than assuming zero.

          `print:pb-0`: the bar is `print:hidden`, so on paper there is nothing to reserve for. */}
      <main
        className="flex w-full flex-1 flex-col bg-white pb-[calc(3rem+env(safe-area-inset-bottom))] print:max-w-none print:p-0 print:pb-0 print:shadow-none"
        style={{ minWidth: FE_UI.page.minWidthPx }}
      >
        {/* The sticky app header: the collapsing title block, plus the brand mark and caret that the stack
            positions in its own corners. Full-width, so it spans the viewport regardless of which tab's measure
            is active below it.

            NAVIGATION IS NOT IN HERE. It was a segmented control in a second row of this stack; it now sits at the
            viewport bottom (AppBottomNav, rendered after the footer below), which is what lets the header be
            brand + caret and nothing else — and is why the stack has a single child again. */}
        <AppShellHeaderStack collapsed={headerCollapsed} onCollapsedChange={setHeaderCollapsed}>
          <AppShellIntro collapsed={headerCollapsed} />
        </AppShellHeaderStack>

        <TabPanel label="Tool" active={activeTab === "tool"} widthStyle={contentWidthStyle}>
          <ToolContent isVisible={activeTab === "tool"} onOpenPillarInMatrix={handleOpenPillarInMatrix} />
        </TabPanel>
        <TabPanel label="Theory" active={activeTab === "theory"} widthStyle={contentWidthStyle}>
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
        </TabPanel>

        {/* Inside `main` and full-bleed, so it reads as the page's own footer rather than a strip of the page
            behind it.

            `mt-auto` against `main`'s `min-h` is what pins it to the bottom of the content area when a tab's
            content is short, while letting it sit after the content on a long page. Deliberately NOT fixed: it
            is passive text, so pinning it would spend permanent viewport height on something nobody needs
            mid-scroll — which is a live distinction now that AppBottomNav sits fixed below it and does earn that
            height.

            Rendered once outside both tabpanels, so it survives tab switches untouched. */}
        {/* WHITE, NOT BLACK, AND THAT IS ABOUT THE BOTTOM NAV. This was a black band, which read as the page's
            own base while it was the last thing on screen. It is not the last thing any more — AppBottomNav is
            fixed directly beneath it — and a black strip meeting a white bar looked like two unrelated pieces of
            chrome stacked by accident. Matching the nav (and the header above it) makes the shell one surface,
            with the `border-t` hairlines doing the separating instead of a colour change.

            The black survives where it still means something: the page wrapper outside `main`, which shows down
            both sides once the viewport is wider than the content measure.

            `text-slate-500` rather than `text-white/60` follows from the background; it is the same muted weight
            against light that the old value was against dark.

            NO BORDER of its own. This briefly had a `border-t` to replace the boundary the colour change used to
            provide, but the bottom nav casts an upward shadow onto this strip (see AppBottomNav), so a hairline
            here as well reads as two separators 40px apart. The footer is passive text at the end of the content;
            it does not need to announce its own edge.

            The tab panels' own bottom margin supplies the gap above — padding here would only make the strip
            taller, and `mt-*` is unavailable because `mt-auto` owns that margin to push the footer down on short
            pages. */}
        <footer className="mt-auto bg-white px-3 py-2 text-center text-[11px] text-slate-500 print:bg-transparent">
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

      <Toaster />
    </div>
  );
}
