import { useLayoutEffect } from "react";

import { getHeaderAnchorPx, getWindowScrollY, scrollWindowTo } from "@/utils/scroll";

const SESSION_TAB_KEY = "app:activeTab";
// Each bump abandons the previous values, which is cheap — they only live for a session, so orphaning them
// costs one stale restore instead of a silent offset. `:v2` dropped v1's values because those were recorded
// while the intro was always in the layout. `:v3` changes the unit itself: these are no longer `window.scrollY`
// but scroll measured from the tab bar (see `getHeaderAnchorPx`), so a v2 value read as v3 would be off by the
// header's height.
const SESSION_SCROLL_PREFIX = "app:tabScroll:v3:";

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

/**
 * The remembered offset for `tab`, or `null` when the tab has never been left. `null` is NOT 0: an offset of
 * 0 means "the tab bar is at the viewport top" (which with the header expanded is ~120px down the page),
 * whereas a tab with no memory should open at the actual top.
 *
 * Negative values are legitimate and must survive — they mean the header was visible above the bar.
 */
function getPersistedOffset(tab) {
  try {
    const raw = sessionStorage.getItem(`${SESSION_SCROLL_PREFIX}${tab}`);
    if (raw !== null) {
      const offset = Number(raw);
      if (Number.isFinite(offset)) {
        return offset;
      }
    }
  } catch {}
  return null;
}

/**
 * Whether `tab` would open at or above the tab bar rather than scrolled past it.
 *
 * `useHeaderCollapse` consults this to decide whether a reveal earned on one tab should carry into another:
 * only worth adopting where the header will actually be on screen. Because offsets are measured FROM the
 * bar, `<= 0` reads directly as "has not scrolled past it" — no knowledge of the header's height required,
 * which is what makes it safe to ask while deciding what the header's height should be.
 *
 * A tab with no memory opens at the true top, so it counts.
 */
export function isTabParkedAtTop(tab) {
  const offset = getPersistedOffset(tab);
  return offset === null || offset <= 0;
}

function persistOffset(tab, offset) {
  try {
    sessionStorage.setItem(`${SESSION_SCROLL_PREFIX}${tab}`, String(offset));
  } catch {}
}

/** Current scroll in the storable, header-independent unit. */
function captureOffset() {
  return getWindowScrollY() - getHeaderAnchorPx();
}

/**
 * Remember per-tab window scroll in sessionStorage; persists across page refresh.
 *
 * VALUES ARE STORED RELATIVE TO THE TAB BAR, not as raw `window.scrollY` — `offset = scrollY - anchor`, with
 * the anchor being however much document currently sits above the bar (see `getHeaderAnchorPx`).
 *
 * That indirection exists because the header's collapsed state is a single boolean SHARED by both tabs, and
 * it can be toggled while a tab is inactive. Expanding it inserts ~120px of document above every position in
 * both tabs at once, so a raw `scrollY` recorded before the toggle names different content after it. Storing
 * raw offsets meant: scroll the tool tab to the bottom (which collapses the header), switch to theory, expand
 * the header there, come back — and the tool tab restored to its old number, now 120px short of the bottom,
 * with the title scrolled off-screen so it still looked collapsed. Collapsing the header again on theory
 * "fixed" it, because that put the coordinate space back the way it was.
 *
 * Measuring from the bar removes the header from the number entirely. The anchor is re-read at save AND at
 * every re-assert, so whatever the header did in between simply cancels out.
 *
 * `cancelRestoreRef` lets a later in-tab scroll take over from the restore loop. The restore always runs
 * (so the tab lands at its remembered position), but a scroll that owns its own target — a cross-tab matrix
 * jump, or a deep-link gliding to its section/pillar — flips this ref the instant it scrolls. The burst
 * checks it each frame and stops, so that scroll's final position isn't re-asserted away. It's a
 * programmatic equivalent of the wheel/touch/keydown gestures that already stop restore. Reset to false at
 * the start of each switch.
 */
export function useTabScrollMemory(activeTab, cancelRestoreRef = null) {
  const saveActiveTabScroll = () => {
    persistOffset(activeTab, captureOffset());
  };

  useLayoutEffect(() => {
    persistActiveTab(activeTab);

    // Fresh switch: clear any leftover cancel flag so this tab's restore can run; a later in-tab
    // scroll (matrix jump or deep-link glide) will flip it again to take over.
    if (cancelRestoreRef) {
      cancelRestoreRef.current = false;
    }

    const offset = getPersistedOffset(activeTab);

    // Resolved fresh on every call rather than computed once, so the header's height is taken from the
    // layout as it stands AT THAT MOMENT. The burst below spans a couple of seconds; if the header changes
    // inside that window the target follows it instead of stranding the page in the old coordinate space.
    //
    // An offset at or above the bar restores to the TRUE top, not to `offset + anchor`. Within that band
    // the exact value only encodes how much of the header was showing, which is meaningless once the header
    // has changed size — and it actively misfires when `useHeaderCollapse` adopts a reveal into this tab: a
    // tab left at offset 0 (bar at the viewport top, header collapsed) would otherwise reopen at `anchor`,
    // i.e. with the freshly revealed header scrolled off the top of the screen. Being at the top means
    // being at the top.
    const targetY = () => {
      if (offset === null || offset <= 0) {
        return 0;
      }
      return offset + getHeaderAnchorPx();
    };

    // Apply the remembered position SYNCHRONOUSLY, before the browser paints. The burst below re-asserts
    // it from inside a rAF, which runs after the first paint — so on a reload whose remembered state is
    // "header collapsed", the full header would paint for one frame and then jump away. Being in a layout
    // effect is not enough on its own; the scroll has to happen here, not a frame later.
    scrollWindowTo(targetY());

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
      scrollWindowTo(targetY()); // re-assert when the page height changes (chart settles)
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
      scrollWindowTo(targetY());
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

    const onBeforeUnload = () => persistOffset(activeTab, captureOffset());
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
