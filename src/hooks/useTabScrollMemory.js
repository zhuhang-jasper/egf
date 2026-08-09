import { useLayoutEffect } from "react";

import { getWindowScrollY, scrollWindowTo } from "@/utils/scroll";

const SESSION_TAB_KEY = "app:activeTab";
// Each bump abandons the previous values, which is cheap — they only live for a session, so orphaning them
// costs one stale restore instead of a silent offset. `:v4` returns the unit to a plain `window.scrollY`;
// `:v3` held scroll measured from the tab bar, so a v3 value read as v4 would be off by the header's height.
const SESSION_SCROLL_PREFIX = "app:tabScroll:v4:";

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

/** The remembered `window.scrollY` for `tab`, or `null` when the tab has never been left. */
function getPersistedScroll(tab) {
  try {
    const raw = sessionStorage.getItem(`${SESSION_SCROLL_PREFIX}${tab}`);
    if (raw !== null) {
      const y = Number(raw);
      if (Number.isFinite(y)) {
        return y;
      }
    }
  } catch {}
  return null;
}

function persistScroll(tab, y) {
  try {
    sessionStorage.setItem(`${SESSION_SCROLL_PREFIX}${tab}`, String(y));
  } catch {}
}

/**
 * Remember per-tab window scroll in sessionStorage; persists across page refresh.
 *
 * Values are a plain `window.scrollY`, which is ONLY safe because the header is sticky. Do not reintroduce a
 * document-flow header without also reintroducing an anchor-relative offset. See
 * docs/DECISIONS.md#tab-scroll-memory-uses-plain-scrolly.
 *
 * `cancelRestoreRef` lets a later in-tab scroll take over: restore always runs, but a scroll that owns its
 * own target (a matrix jump, a deep-link glide) flips the ref and the burst stops re-asserting. The
 * programmatic equivalent of the wheel/touch/keydown gestures that already stop restore.
 */
export function useTabScrollMemory(activeTab, cancelRestoreRef = null) {
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

    // A tab with no memory opens at the true top.
    const y = getPersistedScroll(activeTab) ?? 0;

    // Apply the remembered position SYNCHRONOUSLY, before the browser paints. The burst below re-asserts
    // it from inside a rAF, which runs after the first paint — so the page would visibly land somewhere
    // else for one frame and then jump. Being in a layout effect is not enough on its own; the scroll has
    // to happen here, not a frame later.
    scrollWindowTo(y);

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
    // cancelRestoreRef is stable — restore is driven by activeTab.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  return { saveActiveTabScroll };
}
