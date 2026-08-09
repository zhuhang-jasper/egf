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

export function scrollWindowTo(y, { behavior = "auto" } = {}) {
  window.scrollTo({ top: Math.max(0, y), left: 0, behavior });
}

/**
 * Suspend native scroll anchoring while an app-driven scroll loop is running, returning a restore function.
 *
 * The anchor and a per-frame scroll loop are two controllers writing `scrollY` from one layout pass, which
 * shakes and lands off-target. See docs/DECISIONS.md#scroll-anchoring.
 */
export function suspendScrollAnchoring() {
  const root = document.documentElement;
  const previous = root.style.overflowAnchor;
  root.style.overflowAnchor = "none";
  // Idempotent: callers restore on normal completion and from a cleanup that may run afterwards, so a second
  // call must not latch "none" in as the restored value.
  let restored = false;
  return () => {
    if (restored) {
      return;
    }
    restored = true;
    root.style.overflowAnchor = previous;
  };
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

/**
 * The vertical band a popover may occupy, in viewport coordinates: `{ top, bottom }`.
 *
 * Both edges are pinned chrome, so a popover must be bounded geometrically (stacking already favours it).
 * Missing elements fall back to the full viewport, keeping this correct on Poster/Social, which render neither bar.
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
 * Smooth-scroll `element` below the sticky bar, re-aiming each frame until the destination holds steady for
 * `stableFrames`. The `maxFrames` cap terminates cards that can never reach the inset (page bottom).
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

/**
 * Glide `element`'s top to the sticky inset over `durationMs`, re-reading the destination every frame.
 *
 * For expanding a matrix pillar while another collapses above it, where `behavior: "smooth"` cannot serve:
 * it picks its own duration and so finishes after the 300ms panel animation. Running on the same clock makes
 * the two read as one movement. See docs/DECISIONS.md#matrix-expand-glide.
 *
 * Returns a cleanup function that cancels the pending animation frame.
 */
export function glideElementBelowStickyHeader(element, { durationMs = 300 } = {}) {
  if (!element) {
    return () => {};
  }

  const restoreAnchoring = suspendScrollAnchoring();

  // The card's top is driven along a trajectory, not chased with a lag filter, and everything is in VIEWPORT
  // coordinates: `rect.top` already accounts for the document changing height above, so one correction both
  // advances the animation and absorbs the collapse.
  const startError = element.getBoundingClientRect().top - getStickyScrollOffsetPx();
  // Approximates the panel's `ease-out`; both finishing together matters more than the exact curve.
  const easeOut = (p) => 1 - (1 - p) ** 3;

  let raf = 0;
  let stable = 0;
  // Wall clock, not a frame count: a CSS transition is paced by elapsed time, so dropped frames must not
  // desynchronise the trajectory from it.
  const start = performance.now();
  // p=1 means our clock is done, not that layout is, so keep correcting past it. The cap backstops a card
  // that can never reach the inset (page bottom), where `stable` would never climb.
  const deadlineMs = durationMs + 500;

  const tick = () => {
    const elapsed = performance.now() - start;
    const progress = Math.min(1, elapsed / durationMs);
    const offset = getStickyScrollOffsetPx();
    // Where the card's top belongs right now: the full error at p=0, none of it at p=1.
    const desiredTop = offset + startError * (1 - easeOut(progress));
    const currentY = window.scrollY;
    // Whole pixels with a 1px dead zone, as in `holdElementInPlace`: scroll position is quantised, so a
    // sub-pixel destination is snapped and reads back as fresh error forever.
    const nextY = Math.round(currentY + (element.getBoundingClientRect().top - desiredTop));
    if (Math.abs(nextY - Math.round(currentY)) >= 1) {
      stable = 0;
      scrollWindowTo(nextY, { behavior: "auto" });
    } else if (progress >= 1) {
      stable += 1;
    }
    if ((progress >= 1 && stable >= 3) || elapsed >= deadlineMs) {
      restoreAnchoring();
      return;
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return () => {
    cancelAnimationFrame(raf);
    restoreAnchoring();
  };
}

/**
 * Hold `element` still on screen for `durationMs` while the document changes height, correcting every frame.
 *
 * Collapsing a matrix pillar removes content from above the viewport, so the browser clamps `scrollY` to the
 * shrinking `scrollHeight` and the page lurches upward. Re-asserting the position each frame absorbs that.
 *
 * It holds wherever the element already is, FLOORED at the sticky inset: the close control sits at the foot of
 * an expanded matrix, so the card's top is usually well above the viewport and holding it there would strand
 * the reader. See docs/DECISIONS.md#matrix-collapse-pin.
 *
 * `behavior: "auto"` is required, not an optimisation: a smooth scroll owns the position for its own duration
 * and eases toward a stale snapshot, so per-frame corrections fight themselves and land late.
 *
 * Returns a cleanup function that cancels the pending animation frame.
 */
export function holdElementInPlace(element, { durationMs = 300 } = {}) {
  if (!element) {
    return () => {};
  }

  // Native anchoring converges here (every frame writes the same value) but can hold `drift` off zero and so
  // defeat the early release below, keeping the pin alive after the panel has finished closing.
  const restoreAnchoring = suspendScrollAnchoring();

  // Captured once, before the animation has moved anything: this is the position being defended. Measuring per
  // frame would re-read wherever the collapse had already dragged the card.
  const anchorTop = Math.max(element.getBoundingClientRect().top, getStickyScrollOffsetPx());

  let raf = 0;
  let frames = 0;
  let stable = 0;
  // Frame count rather than a deadline: a dropped frame should extend the guard, not end it while the panel
  // is still moving. ~60fps plus a margin so the settled layout is asserted after the transition ends.
  const totalFrames = Math.ceil(durationMs / 16.7) + 4;
  const tick = () => {
    frames += 1;
    const target = Math.round(window.scrollY + (element.getBoundingClientRect().top - anchorTop));
    const drift = Math.abs(target - Math.round(window.scrollY));
    if (drift >= 1) {
      stable = 0;
      scrollWindowTo(target, { behavior: "auto" });
    } else {
      stable += 1;
    }
    // Release early once nothing is moving: the pin overrides scroll position on every frame it runs, so the
    // user cannot scroll while it is active. Also what keeps `motion-reduce` honest, where the panel closes
    // instantly and every later frame is pure interference.
    if (stable >= 3 || frames >= totalFrames) {
      restoreAnchoring();
      return;
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return () => {
    cancelAnimationFrame(raf);
    restoreAnchoring();
  };
}
