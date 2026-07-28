export const STICKY_SCROLL_GAP_PX = 8;
export const STICKY_OFFSET_CSS_VAR = "--app-sticky-offset";

/** Disable browser scroll restoration on refresh/navigation. Call once at app boot. */
export function disableBrowserScrollRestoration() {
  if ("scrollRestoration" in history) {
    history.scrollRestoration = "manual";
  }
}

export function getWindowScrollY() {
  return window.scrollY;
}

/**
 * When the last app-initiated scroll was issued, plus how long its resulting scroll events may keep
 * arriving. Scroll events carry no origin, so anything that reacts to scrolling as *user intent* has to be
 * able to exclude the app's own scrolls: the per-tab restore, deep-link glides, the matrix pillar jump.
 *
 * Timing alone can't do it from the listener side — a tab switch right after a wheel gesture puts a
 * programmatic scroll a few milliseconds after real input, which is indistinguishable from that input
 * having caused it. So the scroll helpers mark their own calls here instead, and listeners consult
 * {@link isProgrammaticScroll}.
 */
let programmaticScrollUntil = 0;
// A smooth scroll keeps emitting events for as long as the browser's animation runs, so the window has to
// outlast that; an instant jump only needs a frame or two. Both are covered by the longer bound.
const PROGRAMMATIC_SCROLL_WINDOW_MS = 900;

/** Whether scroll events arriving now are still plausibly from an app-initiated scroll. */
export function isProgrammaticScroll() {
  return performance.now() < programmaticScrollUntil;
}

/** Mark app-initiated scrolling as in progress — for callers that move the window without these helpers. */
export function markProgrammaticScroll(durationMs = PROGRAMMATIC_SCROLL_WINDOW_MS) {
  programmaticScrollUntil = Math.max(programmaticScrollUntil, performance.now() + durationMs);
}


export function scrollWindowTo(y, { behavior = "auto" } = {}) {
  markProgrammaticScroll();
  window.scrollTo({ top: Math.max(0, y), left: 0, behavior });
}

export function scrollWindowToTop({ behavior = "auto" } = {}) {
  scrollWindowTo(0, { behavior });
}

/** Measured sticky tab bar inset (set by AppShellTabBar). */
export function getStickyScrollOffsetPx() {
  const offsetValue = getComputedStyle(document.documentElement).getPropertyValue(STICKY_OFFSET_CSS_VAR);
  return Number.parseFloat(offsetValue) || 0;
}

export function setStickyScrollOffset(heightPx) {
  const offset = Math.ceil(heightPx) + STICKY_SCROLL_GAP_PX;
  document.documentElement.style.setProperty(STICKY_OFFSET_CSS_VAR, `${offset}px`);
}

export function clearStickyScrollOffset() {
  document.documentElement.style.removeProperty(STICKY_OFFSET_CSS_VAR);
}

// `isTabBarStuck()` and `getTabBarPinnedScrollY()` lived here until the intro became a CSS-collapsed block
// (see useHeaderCollapse). Both described a world where the header's state was a scroll position — "is the
// bar pinned yet", "what scrollY pins it" — and neither has a meaning now: when collapsed the intro is out
// of the layout, so the bar's anchor is simply 0 and it is always pinned.

/**
 * How much document sits above the sticky tab bar right now — the intro block plus the page paddings that
 * collapse with it. Exactly 0 when the header is collapsed, since collapsing takes all of it out of the
 * layout (see HomePage).
 *
 * This is the unit that makes a remembered scroll offset portable. A raw `window.scrollY` is measured in a
 * coordinate space whose origin moves: expanding the header inserts this much document ABOVE every existing
 * position, so the same content is suddenly at a different `y`. Storing `y - anchor` instead measures from
 * the tab bar, which is the one landmark the collapse cannot move.
 *
 * Measured off the intro rather than the bar itself because the bar is `position: sticky` — once stuck its
 * rect reports the viewport top, not its place in the document. The intro is static, so its bottom edge is
 * honest at any scroll position, and the bar follows it immediately (`mt-0`).
 */
export function getHeaderAnchorPx() {
  const intro = document.getElementById("app-shell-intro");
  if (!intro) {
    return 0;
  }
  return Math.max(0, intro.getBoundingClientRect().bottom + window.scrollY);
}

/** Scroll so `element` sits just below the sticky app tab bar. */
export function scrollBelowStickyHeader(element, { behavior = "smooth" } = {}) {
  if (!element) {
    return;
  }

  const top = element.getBoundingClientRect().top + window.scrollY - getStickyScrollOffsetPx();
  scrollWindowTo(top, { behavior });
}

/**
 * Smooth-scroll `element` just below the sticky bar, then keep re-aiming until layout settles.
 *
 * When a matrix pillar expands while another above it collapses (toggle or deep-link to a different
 * pillar), the target keeps sliding up during the collapse animation — a single scroll lands it under
 * the bar with no gap. We re-issue the scroll on each frame whose computed destination differs from
 * the last, stopping once it holds steady for `stableFrames` or the `maxFrames` cap is hit (so a card
 * that genuinely can't reach the inset, e.g. near the page bottom, still terminates).
 *
 * Returns a cleanup function that cancels the pending animation frame.
 */
export function scrollBelowStickyHeaderUntilSettled(element, { stableFrames = 5, maxFrames = 120 } = {}) {
  if (!element) {
    return () => {};
  }

  let raf = 0;
  let frames = 0;
  let stable = 0;
  let lastTarget = Number.NaN;
  const tick = () => {
    frames += 1;
    const target = Math.round(element.getBoundingClientRect().top + window.scrollY - getStickyScrollOffsetPx());
    if (target === lastTarget) {
      stable += 1;
    } else {
      // Destination moved (a pillar above is still collapsing/expanding) — re-aim at the new position.
      stable = 0;
      lastTarget = target;
      scrollWindowTo(target, { behavior: "smooth" });
    }
    if (stable >= stableFrames || frames >= maxFrames) {
      return;
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(raf);
}
