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

// `isProgrammaticScroll()` / `markProgrammaticScroll()` lived here, tracking a window during which scroll
// events were known to come from the app rather than the user. Their only consumer was the header's
// auto-collapse, which had to tell a real downward gesture from the per-tab restore, a deep-link glide, or
// the matrix jump. Nothing reacts to scrolling as *intent* any more — the header is user-driven only (see
// useHeaderCollapse) — so there is no longer anything to discriminate for.

export function scrollWindowTo(y, { behavior = "auto" } = {}) {
  window.scrollTo({ top: Math.max(0, y), left: 0, behavior });
}

export function scrollWindowToTop({ behavior = "auto" } = {}) {
  scrollWindowTo(0, { behavior });
}

/** Measured sticky header inset (set by AppShellHeaderStack). */
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

// `isTabBarStuck()`, `getTabBarPinnedScrollY()` and `getHeaderAnchorPx()` all lived here, and all three
// described a world where the header sat in document flow at position 0 — "is the bar pinned yet", "what
// scrollY pins it", "how much document is above the bar". The header is sticky now, so it occupies viewport
// space instead: there is never any document above the bar, the bar is always pinned, and the anchor is
// permanently 0. `getHeaderAnchorPx` in particular was load-bearing for per-tab scroll offsets, and its own
// docstring noted it only worked because the intro was static — a sticky element's rect reports the viewport
// top once stuck, not its document position. Rather than being fixed, it stopped being needed:
// `useTabScrollMemory` stores a plain `scrollY` again.

/**
 * How much the sticky header's height CHANGES when the intro is toggled — the distance the page has to be
 * shifted so content appears to stay still.
 *
 * NOT THE INTRO'S OWN HEIGHT, which is what this used to return and is subtly wrong. The header stack has a
 * `min-h-14` floor (56px) that reserves the corner row for the absolutely-positioned brand mark and caret, since
 * neither contributes any height of its own. So the stack does not shrink to zero when the intro does — it stops
 * at that floor:
 *
 *   collapsed   max(56, 24 padding + 0)            = 56px
 *   expanded    24 padding + intro (~120px)        = ~144px
 *   the delta   ~88px, NOT the intro's ~120px
 *
 * Compensating by the intro's height over-scrolled by the difference (~32px), which is exactly the "content did
 * not stay still" symptom. The floor is a `min-height`, so the error is not even a constant — it is however much
 * of the floor the padding does not already fill.
 *
 * MEASURED, NOT DERIVED, for that reason: taking the stack's real height and subtracting what it will collapse to
 * keeps this correct if the padding, the floor, or the controls' size ever change, none of which this file should
 * have to know about.
 *
 * A HEIGHT, NOT A POSITION, which is what makes it safe to read off a sticky element. The position of a stuck
 * element's rect tracks the viewport rather than the document; its height does not.
 *
 * Reports the SETTLED delta, not an in-flight one: the intro animates, so a caller reacting to the toggle would
 * otherwise read a value part-way through the transition. The intro's `scrollHeight` ignores the animating
 * `grid-template-rows` track and gives the height it is heading for, and the floor is a static style value, so
 * both terms are already settled whichever direction the toggle is going.
 */
export function getHeaderToggleDeltaPx(stackEl = document.getElementById("app-shell-header-stack")) {
  const introEl = document.getElementById("app-shell-intro");
  const content = introEl?.firstElementChild;
  if (!stackEl || !content) {
    return 0;
  }

  // The stack's height with the intro fully open: its own vertical padding plus the intro's target height. Read
  // the padding off the computed style rather than hardcoding `p-3`, so this cannot drift from the class.
  const styles = getComputedStyle(stackEl);
  const verticalPadding = Number.parseFloat(styles.paddingTop) + Number.parseFloat(styles.paddingBottom);
  const floor = Number.parseFloat(styles.minHeight) || 0;
  const expanded = verticalPadding + content.scrollHeight;

  // Collapsed, the intro contributes nothing, so the stack rests at whichever is larger: its padding, or the
  // floor that holds the corner row. `max(0, …)` because a floor taller than the expanded height would otherwise
  // yield a negative shift.
  const collapsed = Math.max(verticalPadding, floor);
  return Math.max(0, expanded - collapsed);
}

/**
 * The vertical band a popover may occupy, in viewport coordinates: `{ top, bottom }`.
 *
 * Both edges are pinned app chrome, and a dropdown that ignores either reads as broken — it would be painted
 * over the title, or underneath the navigation bar. Neither is a stacking problem (popovers are `z-50` and both
 * bars are `z-40`, so the popover wins) which is exactly why it has to be handled geometrically instead.
 *
 * Shared rather than duplicated in each popover because the answer stopped being a one-liner: it used to be the
 * header's `bottom` alone, and the bottom edge was simply `window.innerHeight`. Navigation moving to a fixed
 * bottom bar (see AppBottomNav) added a second term that every consumer would otherwise have to remember.
 *
 * Missing elements fall back to the full viewport, so this stays correct on the standalone pages (Poster/Social)
 * that render neither bar.
 */
export function getPopoverViewportBounds() {
  const header = document.getElementById("app-shell-header-stack");
  const bottomNav = document.getElementById("app-bottom-nav");
  return {
    top: header ? Math.max(0, header.getBoundingClientRect().bottom) : 0,
    bottom: bottomNav ? Math.min(window.innerHeight, bottomNav.getBoundingClientRect().top) : window.innerHeight,
  };
}

/** Scroll so `element` sits just below the sticky app header. */
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
