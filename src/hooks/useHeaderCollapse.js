import { useCallback, useLayoutEffect, useRef, useState } from "react";

import { getHeaderToggleDeltaPx, scrollWindowTo } from "@/utils/scroll";

// `:v3` is a single shared boolean. v2 was briefly per-tab and v1 was a differently-shaped shared value;
// orphaning either costs one stale header state for the rest of a session.
const HEADER_COLLAPSED_SESSION_KEY = "app:headerCollapsed:v3";

/**
 * Whether the app intro (title + tagline) is showing, as CSS state rather than a scroll position.
 *
 * WHY THIS IS STATE, NOT A SCROLL POSITION. The intro used to collapse simply by being scrolled out of
 * view, which made "collapsed" mean "scrollY is about 120". That encoding caused every problem in this
 * area: the range between 0 and the tab bar's anchor was a set of legitimate scroll positions the browser
 * would happily leave the user at, so keeping the header out of that band meant intercepting the user's own
 * momentum and scrolling them somewhere else. Fighting the scroll is unwinnable — and interception could
 * itself strand the page mid-band, violating the very invariant it enforced.
 *
 * THE USER IS THE ONLY WRITER. Scrolling does not change this state; there is no auto-collapse. The
 * previous design had TWO writers for one bit — the user and scrolling — and every hard question in this
 * area turned out to be "which writer wins?" in a different costume: shared or per-tab, should a reveal
 * propagate, should collapse fire on a level or a crossing, is an explicit expand sticky. None have good
 * answers, because they are all the same conflict. One writer and they stop being questions.
 *
 * The header no longer hides itself, which is only acceptable because the tab bar carries a permanent brand
 * mark (see AppShellBrandMark) — "collapsed" is a space decision, not the framework going unbranded. Collapsed
 * now shows the FULL wordmark rather than an abbreviation, since navigation left that row.
 *
 * ONE BOOLEAN, SHARED BY BOTH TABS. With scrolling out of the picture this is not contentious: the only way
 * it changes is a deliberate act, and a deliberate act about the app's chrome is not tab-specific.
 *
 * THE HEADER IS STICKY, which is what makes all of the above affordable. It occupies viewport space, not
 * document space above the scroll position, so its height is no longer baked into every scroll coordinate
 * on the page — which is why `useTabScrollMemory` can store a plain `scrollY` again.
 */
export function useHeaderCollapse() {
  const [collapsed, setCollapsed] = useState(readCollapsed);

  // Where the page was when the toggle was requested. Captured in the setter because by the time the layout
  // effect runs the scroll position may already have been clamped by the reflow.
  const pendingScrollYRef = useRef(null);

  const setCollapsedPersisted = useCallback((next) => {
    setCollapsed((prev) => {
      if (prev === next) {
        return prev;
      }
      pendingScrollYRef.current = window.scrollY;
      writeCollapsed(next);
      return next;
    });
  }, []);

  /**
   * Shift the page so a toggle does not move what the user was looking at. Expand while a section title is
   * visible and that title should still be visible afterwards, pushed down by the header rather than covered
   * by it.
   *
   * WHAT MUST STAY PUT is a piece of content's position ON SCREEN, not its position in the document.
   *
   * Work it through. A section title sits at document 1000 and `scrollY` is 900, so it paints 100px down the
   * viewport, just clear of the collapsed bar. Expanding adds `delta = 120` of sticky chrome, which eats the
   * viewport from the top down — so to remain equally clear of the bar the title has to paint 120px FURTHER
   * DOWN, at 220. Screen position is `documentY - scrollY`, so moving it down means `scrollY` goes DOWN:
   * `900 - 120 = 780`, and `1000 - 780 = 220`. Correct.
   *
   * Hence `scrollY -= delta` on expand, `+= delta` on collapse. Both of the earlier attempts here got this
   * wrong in the same direction: `scrollY += delta` on expand scrolls the title to `1000 - 1020 = -20`, off
   * the top of the screen entirely — which is worse than the overlap it was trying to fix, and is why the
   * caret looked like it did nothing (it scrolled past the header it had just revealed).
   *
   * The page grows no taller when the header expands — the header is sticky, so it takes viewport space, not
   * document space. That is exactly why the fix is a scroll shift and not a layout correction: the document
   * is unchanged, only how much of it the chrome hides has changed.
   *
   * Skipped at `scrollY === 0`: already at the top, nothing is hidden, and the header simply grows downward
   * and pushes content down — the one case where the movement is the point.
   *
   * ONE INSTANT SCROLL AGAINST THE FINAL HEIGHT, not a per-frame chase. The intro animates, so its live
   * height here is still mid-transition; `getHeaderToggleDeltaPx()` reports the settled delta instead. Following
   * the animation frame by frame would mean a full page relayout every frame — with the radar chart inside
   * it — which is the stutter the intro's old "not animated" comment used to warn about. The scroll lands
   * instantly while the height eases, so content settles slightly ahead of the chrome; that reads as the
   * header pushing the page down, which is the intent.
   *
   * A layout effect rather than a rAF so the shift lands in the same paint as the height change; a rAF runs
   * after the first paint, so the unshifted frame would be visible as a jump.
   */
  useLayoutEffect(() => {
    const scrollYBefore = pendingScrollYRef.current;
    pendingScrollYRef.current = null;
    if (scrollYBefore === null || scrollYBefore <= 0) {
      return;
    }

    // HOW MUCH THE HEADER'S HEIGHT CHANGES, not how tall the intro is. The two differ: the stack has a
    // `min-h-14` floor holding the corner row, so it does not collapse all the way to its padding, and shifting
    // by the intro's full height therefore overshot by whatever the floor adds (see getHeaderToggleDeltaPx).
    const delta = getHeaderToggleDeltaPx();
    if (delta === 0) {
      return;
    }
    // Expanding hides `delta` more of the viewport, so scroll UP by that much to push content back into view;
    // collapsing frees it again, so scroll down to take up the slack.
    scrollWindowTo(collapsed ? scrollYBefore + delta : scrollYBefore - delta);
  }, [collapsed]);

  return { collapsed, setCollapsed: setCollapsedPersisted };
}

function readCollapsed() {
  try {
    return sessionStorage.getItem(HEADER_COLLAPSED_SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

function writeCollapsed(collapsed) {
  try {
    sessionStorage.setItem(HEADER_COLLAPSED_SESSION_KEY, collapsed ? "1" : "0");
  } catch {
    // sessionStorage unavailable — keep the in-memory value.
  }
}
