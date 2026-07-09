import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { FileText, Image, Radar, Share2 } from "lucide-react";

import { Tooltip } from "@/components/ui/Tooltip";

import { FRAMEWORK_VERSION, IS_ADMIN, SITE_COPY } from "@/constants";
import { cn } from "@/utils";
import { hrefForRoute } from "@/utils/route";
import { clearStickyScrollOffset, getTabBarPinnedScrollY, getWindowScrollY, setStickyScrollOffset } from "@/utils/scroll";

const TABS = [
  { id: "tool", label: "Tool", icon: Radar },
  // `version` derives from the single FRAMEWORK_VERSION source so the label and the "unseen" dot
  // (see useUnseenFramework) always agree — bumping that one constant updates both.
  { id: "theory", label: "Theory", icon: FileText, version: `v${FRAMEWORK_VERSION}` },
];

// Admin-only shortcuts to the standalone Poster/Social pages. These navigate away (full page load),
// not in-app tabs, so they render as a separate link row below the tablist — never mixed into the
// Tool/Theory sliding pill. Gated by IS_ADMIN (?admin=1).
const ADMIN_LINKS = [
  { route: "poster", label: "Poster", icon: Image },
  { route: "social", label: "Social", icon: Share2 },
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

function AppShellTabBar({ activeTab, onTabChange, theoryHasUnseenUpdates = false }) {
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
      {/* ≥470px: tabs centered (justify-center), admin icons absolute-floated right so they don't
          shift the tabs off-center. <470px + admin: justify-between — tabs to the left edge, icons
          to the right (absolute positioning drops so the flow spacing applies). Non-admin stays
          centered at every width (only the tablist is present). */}
      <div className={cn("relative flex items-center min-[470px]:justify-center", IS_ADMIN ? "justify-between" : "justify-center")}>
        <div
          className="relative grid w-68 grid-cols-2 rounded-lg border border-slate-200 bg-slate-100/80 p-0.5"
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
            // Shown on the Theory tab whether or not it's active — opening the tab no longer clears
            // the dot (only turning "What's New" off does), so a user viewing Theory should see it.
            const showUnseenDot = id === "theory" && theoryHasUnseenUpdates;
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
                {version ? (
                  // Version tag sits inline (baseline) with "Theory"; only the unseen-updates dot
                  // floats up as a superscript badge on the version text.
                  <span
                    className={cn("inline-flex items-start text-[11px] font-semibold leading-none", selected ? "text-white/70" : "text-slate-400")}
                  >
                    {version}
                    {/* Unseen-updates dot: a returning user hasn't dismissed this framework version
                        yet. `-translate-y` lifts just the dot to superscript height. */}
                    {showUnseenDot ? (
                      // iOS notification badge red (systemRed, #FF3B30).
                      <span className="ml-0.5 size-1.5 -translate-y-0.5 rounded-full bg-[#FF3B30]" aria-label="New framework updates" />
                    ) : null}
                  </span>
                ) : null}
                {selected && canScrollUp ? <Tooltip text="Click to scroll to top" placement="bottom" /> : null}
              </button>
            );
          })}
        </div>

        {/* Admin-only page-nav: compact icon buttons. Icon-only (labelled via title/aria-label);
            distinct icon per destination. ≥470px: absolute right edge (keeps tabs centered).
            <470px: static, so justify-between on the row pushes it to the right edge. */}
        {IS_ADMIN ? (
          <div className="flex items-center gap-1.5 min-[470px]:absolute min-[470px]:right-0 min-[470px]:top-1/2 min-[470px]:-translate-y-1/2">
            {ADMIN_LINKS.map(({ route, label, icon: Icon }) => (
              <a
                key={route}
                href={hrefForRoute(route)}
                title={label}
                aria-label={label}
                className="inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-slate-100/80 text-slate-600 transition-colors hover:bg-slate-200/80 hover:text-slate-900"
              >
                <Icon className="size-4" aria-hidden />
              </a>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export { AppShellIntro, AppShellTabBar };
