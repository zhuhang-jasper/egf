import { useRef, useState } from "react";

import { AppShellHeaderStack, AppShellIntro, AppShellTabBar } from "@/components/AppShellHeader";
import { TheoryContent } from "@/components/TheoryContent";
import { ToolContent } from "@/components/ToolContent";
import { Toaster } from "@/components/ui/Toaster";

import { useHeaderCollapse } from "@/hooks/useHeaderCollapse";
import { getPersistedActiveTab, useTabScrollMemory } from "@/hooks/useTabScrollMemory";
import { useTheoryUpdates } from "@/hooks/useTheoryUpdates";

import { FE_UI } from "@/constants";
import { cn } from "@/utils";
import { track } from "@/utils/analytics";
import { getWindowScrollY, scrollWindowTo } from "@/utils/scroll";
import { cleanTheoryDeepLinkParams, getTabFromUrl, parseTheoryDeepLink, syncTabInUrl } from "@/utils/theory-url";

const appVersion = import.meta.env.VITE_APP_VERSION;
const VALID_TABS = ["tool", "theory"];

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

  const isTheory = activeTab === "theory";
  const pageWidthStyle = {
    maxWidth: isTheory ? FE_UI.page.theoryMaxWidthPx : FE_UI.page.maxWidthPx,
    minWidth: FE_UI.page.minWidthPx,
  };

  // overflow-x-clip (not -hidden): `hidden` on one axis forces `overflow-y` to compute to `auto`,
  // which turned this min-h-dvh container into an (unbounded) scroll container — the body scrolled
  // instead of the window and the sticky tab bar never pinned. `clip` suppresses the horizontal
  // overflow without establishing a scroll container, so the window scrolls and `sticky top-0` on
  // the header stack works again.
  //
  // NO VERTICAL PADDING above or below the card, and no corner radius, because the header is sticky.
  //
  // Black padding above the card is only ever visible at the very top of the page: once the header pins, that
  // padding has scrolled away. So the header sat that much lower at `scrollY 0` than it did anywhere else, and
  // scrolling to the top made it visibly shift down by the padding's height — when a sticky bar is meant to be
  // the one thing that never moves. The corner radius had the same problem: rounded top corners are only on
  // screen at `scrollY 0`, so the header changed shape on arrival at the top.
  //
  // No horizontal gutters either. Once `main` reaches its max width the black is already visible down both
  // sides, so the gutters add nothing there — and below that width they are pure waste, narrowing the content
  // on exactly the screens with the least room to give.
  return (
    <div className="flex min-h-dvh flex-col items-center gap-2 overflow-x-clip bg-black print:bg-white print:p-0">
      <main
        className="flex w-full flex-col bg-white px-3 pb-3 shadow-sm print:max-w-none print:p-0 print:shadow-none"
        style={pageWidthStyle}
      >
        {/* Intro and tab bar pin together as one sticky unit — see AppShellHeaderStack for why they share a
            single sticky box rather than being two independently-sticky elements. */}
        <AppShellHeaderStack collapsed={headerCollapsed} onCollapsedChange={setHeaderCollapsed}>
          <AppShellIntro collapsed={headerCollapsed} />
          <AppShellTabBar activeTab={activeTab} onTabChange={handleTabChange} theoryHasUnseenUpdates={theoryHasUnseenUpdates} />
        </AppShellHeaderStack>

        <div className="mt-3" role="tabpanel" hidden={activeTab !== "tool"} aria-hidden={activeTab !== "tool"} aria-label="Tool">
          <ToolContent isVisible={activeTab === "tool"} onOpenPillarInMatrix={handleOpenPillarInMatrix} />
        </div>
        <div className="mt-3" role="tabpanel" hidden={activeTab !== "theory"} aria-hidden={activeTab !== "theory"} aria-label="Theory">
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
        </div>
      </main>

      <p className="mt-auto mb-1 text-center text-[11px] text-white/60 print:mb-0 print:text-slate-500">
        © 2026 Jasper Loo Zhu Hang · All rights reserved · <span className="tabular-nums">v{appVersion}</span>
      </p>

      <Toaster />
    </div>
  );
}
