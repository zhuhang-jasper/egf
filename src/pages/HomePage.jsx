import { useRef, useState } from "react";

import { AppShellHeaderStack, AppShellIntro, AppShellTabBar } from "@/components/AppShellHeader";
import { TheoryContent } from "@/components/TheoryContent";
import { ToolContent } from "@/components/ToolContent";
import { Toaster } from "@/components/ui/Toaster";

import { useHeaderCollapse } from "@/hooks/useHeaderCollapse";
import { getPersistedActiveTab, useTabScrollMemory } from "@/hooks/useTabScrollMemory";
import { useTheoryUpdates } from "@/hooks/useTheoryUpdates";

import { FE_UI } from "@/constants";
import { track } from "@/utils/analytics";
import { getWindowScrollY, scrollWindowTo } from "@/utils/scroll";
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
 * `mb-6` is the white gap above the black footer. It lives out here rather than on the footer because the gap
 * has to sit OUTSIDE the black — padding there would only make the band taller — and the footer's own top
 * margin is already spoken for by `mt-auto`.
 */
function TabPanel({ label, active, widthStyle, children }) {
  return (
    <div className="mt-3 mb-3 w-full self-center px-3" style={widthStyle} role="tabpanel" hidden={!active} aria-hidden={!active} aria-label={label}>
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
      // Clicking the already-active tab scrolls to the top and leaves the header exactly as it is.
      // Collapse is the user's choice, expressed elsewhere (the caret, or a pull at the top) — a scroll
      // shortcut has no business changing it.
      if (getWindowScrollY() > 0) {
        scrollWindowTo(0, { behavior: "smooth" });
      }
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
  // `main` also carries `min-h-dvh` and no horizontal padding of its own. The height is what lets the footer's
  // `mt-auto` push to the viewport bottom when a tab's content is short; the absent padding is what lets the
  // footer and the sticky header both bleed to the real edges. The 12px inset those two would have inherited
  // now lives on the pieces that actually want it — `px-3` on each tab panel, and the header's own `px-3`.
  return (
    <div className="bg-black print:bg-white print:p-0">
      <main
        className="flex min-h-dvh w-full flex-col bg-white print:max-w-none print:p-0 print:shadow-none"
        style={{ minWidth: FE_UI.page.minWidthPx }}
      >
        {/* Intro and tab bar pin together as one sticky unit — see AppShellHeaderStack for why they share a
            single sticky box rather than being two independently-sticky elements. Full-width, so it spans the
            viewport regardless of which tab's measure is active below it. */}
        <AppShellHeaderStack collapsed={headerCollapsed} onCollapsedChange={setHeaderCollapsed}>
          <AppShellIntro collapsed={headerCollapsed} />
          <AppShellTabBar activeTab={activeTab} onTabChange={handleTabChange} theoryHasUnseenUpdates={theoryHasUnseenUpdates} />
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

        {/* Inside `main` and full-bleed, so it reads as the page's own footer rather than a strip of the black
            page behind it — which is what it looked like once `main` went full-width and the black stopped
            showing down the sides.

            `mt-auto` against `main`'s `min-h-dvh` is what pins it to the viewport bottom when a tab's content
            is short, while letting it sit after the content on a long page. Deliberately NOT sticky: it is
            passive text, so pinning it would spend permanent viewport height on something nobody needs
            mid-scroll.

            Rendered once outside both tabpanels, so it survives tab switches untouched. */}
        {/* The gap above this footer is WHITE and comes from each tab panel's `mb-6`, not from here.
            Deliberately: the gap separates content from the black band, so it has to be outside the black.
            Padding on this element would only make the band taller, and `mt-*` is unavailable because
            `mt-auto` already owns this margin to push the footer down when a tab's content is short. */}
        <footer className="mt-auto bg-black px-3 py-2 text-center text-[11px] text-white/60 print:bg-transparent print:text-slate-500">
          © 2026 Jasper Loo Zhu Hang · All rights reserved · <span className="tabular-nums">v{appVersion}</span>
        </footer>
      </main>

      <Toaster />
    </div>
  );
}
