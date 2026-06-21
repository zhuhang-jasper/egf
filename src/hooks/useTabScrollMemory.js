import { useLayoutEffect, useRef } from "react";

import { getWindowScrollY, scrollWindowTo } from "@/utils/scroll";

const SESSION_TAB_KEY = "app:activeTab";
const SESSION_SCROLL_PREFIX = "app:tabScroll:";

export function getPersistedActiveTab(validTabs) {
  try {
    const saved = sessionStorage.getItem(SESSION_TAB_KEY);
    if (saved && validTabs.includes(saved)) {
      return saved;
    }
  } catch {}
  return null;
}

function persistActiveTab(tab) {
  try {
    sessionStorage.setItem(SESSION_TAB_KEY, tab);
  } catch {}
}

function getPersistedScroll(tab) {
  try {
    const raw = sessionStorage.getItem(`${SESSION_SCROLL_PREFIX}${tab}`);
    return raw !== null ? Number(raw) : 0;
  } catch {}
  return 0;
}

function persistScroll(tab, y) {
  try {
    sessionStorage.setItem(`${SESSION_SCROLL_PREFIX}${tab}`, String(y));
  } catch {}
}

/**
 * Remember per-tab window scroll in sessionStorage; persists across page refresh.
 *
 * `keepStuckAnchorRef` is a consumed-once ref carrying the tab bar's pinned-scroll anchor, captured
 * at switch time *only when the bar was stuck* (else null). When set, the new tab is raised to at
 * least that anchor so the bar stays pinned across every switch — landing at the stick point hides
 * only the header, never body content, so this is always safe. The anchor is captured by the caller
 * on the settled layout — never measured here at restore time — so the page-refresh path is unaffected.
 *
 * `suppressInitialRestore` skips the very first restore (used when booting from a deep-link, which
 * owns the initial scroll to a target section/pillar). Subsequent tab switches still restore.
 */
export function useTabScrollMemory(activeTab, keepStuckAnchorRef, suppressInitialRestore = false) {
  // The tab whose initial restore should be skipped (deep-link boot owns that first scroll). Gated on
  // the tab *value*, not a one-shot ref — so StrictMode's double-invoked effect skips on BOTH passes,
  // and a real tab switch (different value) clears the suppression and restores normally.
  const suppressedTabRef = useRef(suppressInitialRestore ? activeTab : null);

  const saveActiveTabScroll = () => {
    persistScroll(activeTab, getWindowScrollY());
  };

  useLayoutEffect(() => {
    persistActiveTab(activeTab);

    // Booting from a deep-link: that flow owns the initial scroll, so skip this restore (but still
    // register the unload save below). Subsequent tab switches restore normally.
    const skipRestore = suppressedTabRef.current === activeTab;
    if (suppressedTabRef.current !== null && suppressedTabRef.current !== activeTab) {
      suppressedTabRef.current = null; // user navigated away from the deep-linked tab — done suppressing
    }

    let y = getPersistedScroll(activeTab);
    const anchor = keepStuckAnchorRef?.current;
    if (anchor != null) {
      y = Math.max(y, anchor); // keep the bar pinned across the switch
      keepStuckAnchorRef.current = null; // consumed once
    }

    // Content keeps growing/reflowing after mount — notably the radar chart, which sizes its frame
    // across several ResizeObserver-driven passes that can land well after the first frames. Until it
    // settles the page is too short to reach `y` (scrollTo clamps), so a one-shot restore lands above
    // the saved bottom. We re-assert the saved position (a) every frame for a brief initial burst and
    // (b) whenever the document height changes, until a max window elapses — then stop. Any real user
    // gesture (wheel/touch/keydown) stops it immediately so we never fight manual scrolling.
    let rafId = 0;
    let stopped = false;
    const start = performance.now();
    const MAX_SETTLE_MS = 2000;
    const STABLE_FRAMES = 5; // stop once the page height holds steady this many frames in a row

    const docHeight = () => document.documentElement.scrollHeight;
    let lastHeight = -1;
    let stableCount = 0;

    const reassert = () => {
      if (stopped) {
        return;
      }
      scrollWindowTo(y); // re-assert when the page height changes (chart settles)
    };

    // Re-assert the saved position every frame until the page height is stable. We deliberately do
    // NOT stop on the first frame where scroll matches `y`: the height oscillates as the radar chart
    // sizes across passes, so an early match is against an unsettled layout — late growth would leave
    // us short with no correction. Stop only after the height holds steady, the time budget elapses,
    // or a real user gesture takes over.
    const burst = () => {
      if (stopped) {
        return;
      }
      scrollWindowTo(y);
      const h = docHeight();
      stableCount = h === lastHeight ? stableCount + 1 : 0;
      lastHeight = h;
      if (stableCount >= STABLE_FRAMES || performance.now() - start >= MAX_SETTLE_MS) {
        stop();
      } else {
        rafId = requestAnimationFrame(burst);
      }
    };

    const onUserScroll = () => stop();
    const ro = new ResizeObserver(reassert); // re-assert when the page height changes (chart settles)

    function stop() {
      stopped = true;
      cancelAnimationFrame(rafId);
      ro.disconnect();
      window.removeEventListener("wheel", onUserScroll);
      window.removeEventListener("touchmove", onUserScroll);
      window.removeEventListener("keydown", onUserScroll);
    }

    let stopTimer = null;
    if (!skipRestore) {
      window.addEventListener("wheel", onUserScroll, { passive: true });
      window.addEventListener("touchmove", onUserScroll, { passive: true });
      window.addEventListener("keydown", onUserScroll);
      ro.observe(document.body);
      rafId = requestAnimationFrame(burst);
      // Hard stop after the max window even if nothing else fires.
      stopTimer = setTimeout(stop, MAX_SETTLE_MS);
    }

    const onBeforeUnload = () => persistScroll(activeTab, getWindowScrollY());
    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      stop();
      if (stopTimer !== null) {
        clearTimeout(stopTimer);
      }
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [activeTab]);

  return { saveActiveTabScroll };
}
