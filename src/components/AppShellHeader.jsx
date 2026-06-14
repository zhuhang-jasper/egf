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

  return (
    <div
      ref={barRef}
      id="app-shell-tab-bar"
      className="sticky top-0 z-10 -mx-2 mt-3 bg-white px-2 py-2 shadow-sm sm:-mx-3 sm:px-3 print:static print:shadow-none"
    >
      <div className="relative grid grid-cols-2 rounded-lg border border-slate-200 bg-slate-100/80 p-0.5" role="tablist" aria-label="App sections">
        <div
          aria-hidden
          className="pointer-events-none absolute top-0.5 bottom-0.5 left-0.5 rounded-md bg-slate-900 shadow-sm transition-transform duration-150 ease-out"
          style={{
            width: "calc(50% - 0.125rem)",
            transform: `translateX(calc(${selectedIndex} * 100%))`,
          }}
        />
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
                "relative z-10 cursor-pointer rounded-md px-3 py-1.5 text-xs font-semibold",
                selected ? "text-white" : "text-slate-600 hover:text-slate-800",
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
