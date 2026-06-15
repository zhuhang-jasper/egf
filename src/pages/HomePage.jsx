import { useState } from "react";

import { AppShellIntro, AppShellTabBar } from "@/components/AppShellHeader";
import { TheoryContent } from "@/components/TheoryContent";
import { ToolContent } from "@/components/ToolContent";

import { getPersistedActiveTab, useTabScrollMemory } from "@/hooks/useTabScrollMemory";

import { FE_UI } from "@/constants";

const appVersion = import.meta.env.VITE_APP_VERSION;

export default function HomePage() {
  const [activeTab, setActiveTab] = useState(() => getPersistedActiveTab(["tool", "theory"]) ?? "tool");
  const { saveActiveTabScroll } = useTabScrollMemory(activeTab);

  const handleTabChange = (nextTab) => {
    if (nextTab === activeTab) {
      return;
    }
    saveActiveTabScroll();
    setActiveTab(nextTab);
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
          <ToolContent />
        </div>
        <div className="mt-3" role="tabpanel" hidden={activeTab !== "theory"} aria-hidden={activeTab !== "theory"} aria-label="Theory">
          <TheoryContent />
        </div>
      </main>

      <p className="mt-auto mb-1 text-center text-[11px] tabular-nums text-white/60 print:mb-0 print:text-slate-500">v{appVersion}</p>
    </div>
  );
}
