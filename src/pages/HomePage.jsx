import { useRef, useState } from "react";

import { AppShellIntro, AppShellTabBar } from "@/components/AppShellHeader";
import { TheoryContent } from "@/components/TheoryContent";
import { ToolContent } from "@/components/ToolContent";

import { getPersistedActiveTab, useTabScrollMemory } from "@/hooks/useTabScrollMemory";

import { FE_UI } from "@/constants";
import { getTabBarPinnedScrollY, isTabBarStuck } from "@/utils/scroll";
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

  // Consumed-once: the bar's pinned anchor captured at switch time when it was stuck, so the new
  // tab keeps it pinned. Null when the bar wasn't stuck (normal scroll restore on the new tab).
  const keepStuckAnchorRef = useRef(null);

  // Flipped by an in-tab scroll the instant it runs (cross-tab matrix jump, or a deep-link's scroll
  // to its target), so the restore loop yields to it: restore still runs first — landing at the
  // remembered scroll with the bar kept stuck — then the jump/glide takes over. Reset by the hook at
  // the start of each tab switch.
  const cancelRestoreRef = useRef(false);

  // Restore runs even on a deep-link boot now: it lands at the remembered scroll (bar stuck) and the
  // deep-link's own scroll-to-target then takes over via cancelRestoreRef — so a shared link restores
  // the previous position before gliding to the target, instead of starting from the top.
  const { saveActiveTabScroll } = useTabScrollMemory(activeTab, keepStuckAnchorRef, cancelRestoreRef);

  // Cross-tab jump from a tool-form pillar's help icon into the theory matrix. The `seq` bump makes
  // repeated clicks on the same pillar re-trigger the expand + scroll even when the tab is already open.
  const [matrixNav, setMatrixNav] = useState(null);

  const handleTabChange = (nextTab) => {
    if (nextTab === activeTab) {
      return;
    }
    // If the bar is pinned now, capture its anchor so the new tab restores at least that far down.
    keepStuckAnchorRef.current = isTabBarStuck() ? getTabBarPinnedScrollY() : null;
    saveActiveTabScroll();
    setActiveTab(nextTab);
    syncTabInUrl(nextTab);
  };

  const handleOpenPillarInMatrix = (pillarId) => {
    if (!pillarId) {
      return;
    }
    if (activeTab !== "theory") {
      // Keep the bar pinned across the switch if it's currently stuck, then let the theory tab restore
      // its remembered scroll. The matrix jump (below) takes over once it scrolls to the pillar card.
      keepStuckAnchorRef.current = isTabBarStuck() ? getTabBarPinnedScrollY() : null;
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

  return (
    <div className="flex min-h-dvh flex-col items-center gap-2 bg-black p-1.5 sm:p-3 print:bg-white print:p-0">
      <main
        className="flex w-full flex-col rounded-[14px] bg-white p-2 shadow-sm sm:p-3 print:max-w-none print:rounded-none print:p-0 print:shadow-none"
        style={pageWidthStyle}
      >
        <AppShellIntro />
        <AppShellTabBar activeTab={activeTab} onTabChange={handleTabChange} />

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
          />
        </div>
      </main>

      <p className="mt-auto mb-1 text-center text-[11px] tabular-nums text-white/60 print:mb-0 print:text-slate-500">v{appVersion}</p>
    </div>
  );
}
