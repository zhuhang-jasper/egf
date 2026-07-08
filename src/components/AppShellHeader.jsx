import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { FileText, Radar } from "lucide-react";

import { Tooltip } from "@/components/ui/Tooltip";

import { SITE_COPY } from "@/constants";
import { cn } from "@/utils";
import { clearStickyScrollOffset, getTabBarPinnedScrollY, getWindowScrollY, setStickyScrollOffset } from "@/utils/scroll";

const TABS = [
  { id: "tool", label: "Tool", icon: Radar },
  { id: "theory", label: "Theory", icon: FileText, version: "v3.1" },
];

function AppShellIntro() {
  return (
    <header id="app-shell-intro" className="space-y-2 pt-0 text-center sm:pt-2">
      <h1 className="text-balance text-xl sm:text-2xl font-bold leading-tight tracking-tight text-slate-900 mb-1">{SITE_COPY.title}</h1>
      <p className="text-pretty text-xs sm:text-sm leading-tight text-slate-700 sm:mb-1">
        {SITE_COPY.tagline} {SITE_COPY.detail} <span className="whitespace-nowrap text-slate-500">{SITE_COPY.byline}</span>
      </p>
    </header>
  );
}

function AppShellTabBar({ activeTab, onTabChange }) {
  const barRef = useRef(null);
  // Whether scrolling up is possible — i.e. we're scrolled past the point where the bar pins.
  // Gates the active tab's "click to scroll to top" tooltip so it only shows when it'd do something.
  const [canScrollUp, setCanScrollUp] = useState(false);
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

  // Track whether there's room to scroll up so the tooltip can hide when there isn't.
  useEffect(() => {
    const sync = () => setCanScrollUp(getWindowScrollY() > getTabBarPinnedScrollY());
    sync();
    window.addEventListener("scroll", sync, { passive: true });
    window.addEventListener("resize", sync);
    return () => {
      window.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
    };
  }, [activeTab]);

  return (
    <div ref={barRef} id="app-shell-tab-bar" className="sticky top-0 z-40 -mx-3 mt-0 bg-white px-3 py-2 shadow-sm print:static print:shadow-none">
      <div
        className="relative mx-auto grid max-w-xs grid-cols-2 rounded-lg border border-slate-200 bg-slate-100/80 p-0.5"
        role="tablist"
        aria-label="App sections"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute top-0.5 bottom-0.5 left-0.5 rounded-md bg-slate-900 shadow-sm transition-transform duration-150 ease-out"
          style={{
            width: "calc(50% - 0.125rem)",
            transform: `translateX(calc(${selectedIndex} * 100%))`,
          }}
        />
        {TABS.map(({ id, label, icon: Icon, version }) => {
          const selected = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => onTabChange(id)}
              className={cn(
                "group relative z-10 flex cursor-pointer items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold",
                selected ? "text-white" : "text-slate-600 hover:text-slate-800",
              )}
            >
              <Icon className="size-3.5 shrink-0" aria-hidden />
              {label}
              {version ? <span className={cn("text-[11px] font-semibold", selected ? "text-white/70" : "text-slate-400")}>{version}</span> : null}
              {selected && canScrollUp ? <Tooltip text="Click to scroll to top" placement="bottom" /> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export { AppShellIntro, AppShellTabBar };
