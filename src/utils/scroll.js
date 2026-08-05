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

/**
 * Suspend the browser's scroll anchoring while an app-driven scroll is in flight.
 *
 * Scroll anchoring is Chrome/Firefox keeping the visible content still when the document changes height
 * ABOVE the viewport: it picks an anchor node and silently adjusts `scrollY` to hold it in place. Normally
 * invaluable, and the reason a collapsing pillar above the reader does not throw them somewhere random.
 *
 * It is ruinous when WE are the ones doing the compensating. A per-frame scroll loop and the anchor are two
 * controllers writing one value from the same layout pass: our frame sets a new target, the anchor corrects
 * it back toward its node, the next frame measures the corrected position and aims again. The result is a
 * visible shake for as long as the document keeps changing height, and — since the anchor gets the last
 * word after the final frame — a resting position that is not the one we asked for.
 *
 * That is why this is needed for the expand GLIDE and not for the collapse pin: the pin writes the same
 * value every frame, so a fight with the anchor converges invisibly. The glide writes a moving value, so
 * the contention is the animation.
 *
 * Scoped to `documentElement` (the scrolling element, where anchor selection happens) and restored to
 * whatever was there before, so this composes with any future stylesheet rule instead of clobbering it.
 */
export function suspendScrollAnchoring() {
  const root = document.documentElement;
  const previous = root.style.overflowAnchor;
  root.style.overflowAnchor = "none";
  // Idempotent: callers restore both when their loop finishes normally and from a cleanup function that may
  // run afterwards, so this has to tolerate being called twice without a second suspension's `previous`
  // (already "none") being latched in as the restored value.
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

/**
 * Glide `element`'s top to the sticky inset over `durationMs`, re-reading the destination every frame.
 *
 * For expanding a matrix pillar while another collapses above it — the case `behavior: "smooth"` cannot
 * serve, and the reason this interpolates by hand rather than delegating.
 *
 * A native smooth scroll picks its own duration (~400-500ms in Chrome, and it restarts its easing from
 * scratch on every re-aim), so it necessarily finishes AFTER the 300ms panel animation. That is what made
 * the expand read as two events: the new levels animated in at the reader's current offset — a flash of
 * content in the wrong place — and only then did the page travel to meet them. Waiting for the animation
 * before scrolling at all, which is what the old code did, guarantees that ordering.
 *
 * Running the scroll on the SAME clock as the animation collapses the two into one movement: the card
 * arrives under the sticky bar exactly as its levels finish opening. Both are 300ms, so neither waits.
 *
 * The destination cannot be captured once at click time, because the collapse above is still shortening the
 * document and the card's final resting place is not yet knowable. What IS fixed at click time is the
 * distance the card must travel relative to the sticky inset, so that is what gets eased: each frame drives
 * the card's top to its scheduled place on that trajectory, in viewport coordinates. Layout shifts need no
 * separate handling, since a shift changes `rect.top` and the same correction absorbs it.
 *
 * Returns a cleanup function that cancels the pending animation frame.
 */
export function glideElementBelowStickyHeader(element, { durationMs = 300 } = {}) {
  if (!element) {
    return () => {};
  }

  // Off for the whole glide: we are compensating for the collapsing pillar ourselves, and the anchor
  // trying to do the same job on the same frames is a fight, not a redundancy. See suspendScrollAnchoring.
  const restoreAnchoring = suspendScrollAnchoring();

  // THE CARD'S TOP IS DRIVEN ALONG A TRAJECTORY, NOT CHASED WITH A LAG FILTER.
  //
  // Everything here is in VIEWPORT coordinates, which is the whole trick. `rect.top` already accounts for
  // the document changing height above us, so a frame that both advances the animation and absorbs a
  // collapse needs no separate compensation term: correcting `rect.top` to where the trajectory says it
  // should be does both at once, exactly, in the frame the shift happens.
  //
  // The previous version closed a fixed FRACTION of the remaining distance per frame. Against a static
  // target that eases nicely, but the target here is not static: the pillar collapsing above moves it by
  // ~110px per frame early in the animation, far faster than a 15%-per-frame filter can track. The error
  // therefore accumulated for the whole 300ms and was discharged in one jump when the loop ended — the
  // "shake" at the end — and if layout had not finished settling by then, that jump landed somewhere
  // inside the matrix. Tracking an explicit trajectory has no lag to accumulate and nothing to discharge.
  const startError = element.getBoundingClientRect().top - getStickyScrollOffsetPx();
  // Matches the panel's `ease-out` closely enough to read as one motion; the exact curve matters less than
  // both finishing together.
  const easeOut = (p) => 1 - (1 - p) ** 3;

  let raf = 0;
  let stable = 0;
  // WALL CLOCK, NOT A FRAME COUNT. A CSS transition is paced by elapsed time, so anything that means to
  // finish alongside one has to be too. Counting frames and assuming 16.7ms each silently desynchronises the
  // moment frames drop — and expanding a pillar BELOW the open one is the worst case for that, running a
  // full-height collapse and a full-height expand in the same layout pass. The trajectory would reach p=1
  // early, pin `desiredTop` to the inset while the panel was still moving, and leave the transition's tail to
  // be taken up by per-frame absolute corrections: a twitch, right at the otherwise-correct final position.
  const start = performance.now();
  // Keep correcting past the trajectory's end until the card actually holds still: p=1 means our clock is
  // done, not that layout is. The cap is a backstop for a card that can never reach the inset (page bottom),
  // where the dead zone below is never satisfied and `stable` would never climb.
  const deadlineMs = durationMs + 500;

  const tick = () => {
    const elapsed = performance.now() - start;
    const progress = Math.min(1, elapsed / durationMs);
    const offset = getStickyScrollOffsetPx();
    // Where the card's top belongs right now: the full error at p=0, none of it at p=1.
    const desiredTop = offset + startError * (1 - easeOut(progress));
    const currentY = window.scrollY;
    // ROUND TO WHOLE PIXELS AND IGNORE ANYTHING UNDER ONE. Scroll position is quantised (and fractional to
    // begin with on HiDPI), so asking for a sub-pixel destination gets snapped to something else and reads
    // back as fresh error next frame — a correction that can never succeed, applied forever. This is the
    // same integer target and 1px dead zone `holdElementInPlace` uses.
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
 * The opposite job to `scrollBelowStickyHeaderUntilSettled`, which GLIDES to a target that happens to
 * be moving. This one keeps an already-correct position from being lost while the document changes
 * height underneath it — collapsing a matrix pillar from the strip at its foot removes several screens
 * of content from ABOVE the viewport, so the browser clamps `scrollY` to the shrinking `scrollHeight`
 * and the page appears to lurch upward on its own. Re-asserting the card's position on each frame of the
 * animation absorbs that clamp as it happens: the card does not move, and the levels concertina shut
 * into it.
 *
 * WHERE IT HOLDS IS WHEREVER THE ELEMENT ALREADY IS, floored at the sticky inset. Pinning it *to* the inset
 * unconditionally was wrong in a way that only shows up once the reader has scrolled: with a pillar open but
 * scrolled up so the card sits mid-viewport, collapsing it hauled the card up to the top of the page. Nothing
 * asked for that. The card was already in view, so the correct amount of scrolling is none, and any movement
 * reads as the page taking over.
 *
 * The floor is what keeps the original case working, and is the whole reason this cannot just preserve the
 * current position: the close control sits at the FOOT of an expanded matrix, so it is normally clicked with
 * the card's top several screens ABOVE the viewport. Holding it there would leave it off-screen and strand the
 * reader among the pillars that follow. Clamping to the inset means "as close to where you were as is still
 * visible", which collapses to the old behaviour in that case and to no movement at all in this new one.
 *
 * `behavior: "auto"` is essential and not an optimisation — a smooth scroll owns the scroll position
 * for its own duration and eases toward a snapshot of the target, so issuing one per frame against a
 * live layout fights itself and lands late. Corrections here must be instant to be invisible.
 *
 * Runs on a frame count rather than a deadline because `Date.now()` and friends measure wall time,
 * which is not what a CSS transition is paced by; a dropped frame should extend the guard, not end it
 * early while the panel is still moving.
 *
 * Returns a cleanup function that cancels the pending animation frame.
 */
export function holdElementInPlace(element, { durationMs = 300 } = {}) {
  if (!element) {
    return () => {};
  }

  // The pin IS scroll anchoring, done deliberately and against a node we chose rather than one the browser
  // picked. Leaving the native one on means two controllers writing `scrollY` from the same layout pass; it
  // converges here (unlike the glide, since every frame writes the same value) but it can hold `drift` off
  // zero and so defeat the early release below, keeping the pin — and the scroll lock it implies — alive for
  // the full frame budget when the panel has already finished closing.
  const restoreAnchoring = suspendScrollAnchoring();

  // CAPTURED ONCE, BEFORE THE ANIMATION HAS MOVED ANYTHING. This is the position being defended, so it has to
  // be read now; measuring it per frame would just re-read wherever the collapse had already dragged the card
  // and there would be nothing to correct against.
  const anchorTop = Math.max(element.getBoundingClientRect().top, getStickyScrollOffsetPx());

  let raf = 0;
  let frames = 0;
  let stable = 0;
  // ~60fps, plus a small margin so the final settled layout is asserted after the transition ends.
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
    // RELEASE EARLY ONCE NOTHING IS MOVING. The pin overrides the scroll position on every frame it runs,
    // so while it is active the user cannot scroll — acceptable for the ~300ms a collapse actually takes,
    // but not a moment longer. Three consecutive driftless frames mean the layout has stopped changing and
    // the guard has nothing left to absorb. This is what keeps `motion-reduce` honest, where the panel
    // closes instantly and every frame after the first would be pure interference.
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
