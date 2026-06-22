import { useLayoutEffect } from "react";

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
 * `cancelRestoreRef` lets a later in-tab scroll take over from the restore loop. The restore always
 * runs (so the tab lands at its remembered position with the bar kept stuck), but a scroll that owns
 * its own target — a cross-tab matrix jump, or a deep-link gliding to its section/pillar — flips this
 * ref the instant it scrolls. The burst checks it each frame and stops, so that scroll's final
 * position isn't re-asserted away. It's a programmatic equivalent of the wheel/touch/keydown gestures
 * that already stop restore. Reset to false at the start of each switch.
 */
export function useTabScrollMemory(activeTab, keepStuckAnchorRef, cancelRestoreRef = null) {
  const saveActiveTabScroll = () => {
    persistScroll(activeTab, getWindowScrollY());
  };

  useLayoutEffect(() => {
    persistActiveTab(activeTab);

    // Fresh switch: clear any leftover cancel flag so this tab's restore can run; a later in-tab
    // scroll (matrix jump or deep-link glide) will flip it again to take over.
    if (cancelRestoreRef) {
      cancelRestoreRef.current = false;
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
      if (cancelRestoreRef?.current) {
        stop(); // an in-tab scroll (matrix jump) has taken over — stop re-asserting
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
      if (cancelRestoreRef?.current) {
        stop(); // an in-tab scroll (matrix jump) has taken over — stop re-asserting
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

    window.addEventListener("wheel", onUserScroll, { passive: true });
    window.addEventListener("touchmove", onUserScroll, { passive: true });
    window.addEventListener("keydown", onUserScroll);
    ro.observe(document.body);
    rafId = requestAnimationFrame(burst);
    // Hard stop after the max window even if nothing else fires.
    const stopTimer = setTimeout(stop, MAX_SETTLE_MS);

    const onBeforeUnload = () => persistScroll(activeTab, getWindowScrollY());
    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      stop();
      clearTimeout(stopTimer);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
    // Refs (keepStuckAnchorRef, cancelRestoreRef) are stable — restore is driven by activeTab.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  return { saveActiveTabScroll };
}
