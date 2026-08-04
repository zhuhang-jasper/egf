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
// the matrix jump. Nothing reacts to scrolling as *intent* any more — the header does not respond to scrolling
// at all (see AppShellHeader) — so there is no longer anything to discriminate for.

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

// `getHeaderToggleDeltaPx()` lived here: how much the sticky header's height changed when its title block was
// toggled, so the page could be shifted by exactly that and content appear to stay still. The header has no
// title block and no toggle any more (see AppShellHeader) — its height is the `min-h-14` floor, always — so
// there is no delta to measure and nothing to compensate. `--app-sticky-offset` is still published from the
// stack's real height, which is what every scroll target actually needs.

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
