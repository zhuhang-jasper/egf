import { useLayoutEffect, useRef } from "react";

import { SITE_COPY } from "@/lib/constants";
import { clearStickyScrollOffset, setStickyScrollOffset } from "@/lib/scroll";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "tool", label: "Tool" },
  { id: "documentation", label: "Documentation" },
];

function AppShellIntro() {
  return (
    <header className="space-y-2 pt-2 text-center sm:pt-3">
      <h1 className="text-balance text-xl font-bold tracking-tight text-slate-900">{SITE_COPY.title}</h1>
      <p className="text-pretty text-xs leading-snug text-slate-800">
        {SITE_COPY.tagline} {SITE_COPY.detail}
      </p>
      <p className="text-[11px] text-slate-500">{SITE_COPY.byline}</p>
    </header>
  );
}

function AppShellTabBar({ activeTab, onTabChange }) {
  const barRef = useRef(null);

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

  return (
    <div
      ref={barRef}
      id="app-shell-tab-bar"
      className="sticky top-0 z-10 -mx-2 mt-3 bg-white px-2 py-2 shadow-sm sm:-mx-3 sm:px-3 print:static print:shadow-none"
    >
      <div className="grid grid-cols-2 rounded-lg border border-slate-200 bg-slate-100/80 p-0.5" role="tablist" aria-label="App sections">
        {TABS.map(({ id, label }) => {
          const selected = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => onTabChange(id)}
              className={cn(
                "cursor-pointer rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
                selected ? "bg-slate-900 text-white shadow-sm" : "text-slate-600 hover:text-slate-800",
              )}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export { AppShellIntro, AppShellTabBar };
