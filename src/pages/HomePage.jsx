import { useRef, useState } from "react";

import { AppShellIntro, AppShellTabBar } from "@/components/AppShellHeader";
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

  // The intro's collapsed state is CSS, not a scroll position. Stored per tab, but the directions differ:
  // collapsing anywhere collapses everywhere ("give me content space" is about the chrome), while revealing
  // stays on the tab that earned the pull. Takes `activeTab` so the switch lands in the same commit as the
  // scroll restore above, which measures the header to resolve its target. See useHeaderCollapse.
  const { collapsed: headerCollapsed, setCollapsed: setHeaderCollapsed } = useHeaderCollapse(activeTab);

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
  // the tab bar works again.
  // When the header is collapsed, EVERYTHING above the tab bar collapses with it — the intro, the black
  // wrapper's top padding, and the card's own top padding — so the tab bar becomes the true top of the
  // scrollable document. Leaving that ~18-24px of padding in place would keep a scrollable strip above the
  // bar: a band where the page is "not quite at the top", which is the same dead gap the intro used to
  // create, just relocated. Zeroing it makes `scrollY === 0` mean exactly "the bar is at the viewport top",
  // which is what the pull gesture keys on. Revealing restores the padding, and only then is there anything
  // above the bar to scroll to.
  return (
    <div
      className={cn(
        "flex min-h-dvh flex-col items-center gap-2 overflow-x-clip bg-black px-1.5 pb-1.5 sm:px-3 sm:pb-3 print:bg-white print:p-0",
        // Unanimated, like the intro's own height: these paddings sit on the page's outermost containers, so
        // transitioning them relayouts everything each frame — and it happens while the user scrolls.
        headerCollapsed ? "pt-0" : "pt-1.5 sm:pt-3",
      )}
    >
      <main
        className={cn(
          "flex w-full flex-col bg-white shadow-sm px-3 pb-3 print:max-w-none print:rounded-none print:p-0 print:shadow-none",
          // The top corners round only when there is black padding above to round against; flush to the
          // viewport edge they would clip the tab bar's own corners against nothing.
          headerCollapsed ? "rounded-b-[14px] pt-0" : "rounded-[14px] pt-3",
        )}
        style={pageWidthStyle}
      >
        <AppShellIntro collapsed={headerCollapsed} />
        <AppShellTabBar
          activeTab={activeTab}
          onTabChange={handleTabChange}
          theoryHasUnseenUpdates={theoryHasUnseenUpdates}
          collapsed={headerCollapsed}
          onCollapsedChange={setHeaderCollapsed}
        />

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
