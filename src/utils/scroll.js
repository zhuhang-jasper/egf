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

const TAB_BAR_ID = "app-shell-tab-bar";

/**
 * Whether the sticky tab bar is currently pinned to the top, read from its live rect (its top is
 * clamped to ~0 once stuck). Reliable only when layout is settled (e.g. at a tab switch) — not on a
 * fresh page where the rect may not be final yet.
 */
export function isTabBarStuck() {
  const bar = document.getElementById(TAB_BAR_ID);
  return bar ? bar.getBoundingClientRect().top <= 1 : false;
}

/**
 * The window scrollY at which the tab bar becomes pinned — i.e. the document Y of the bar's anchor,
 * which equals the bottom of the (never-sticky) intro header above it. Derived from the intro
 * header's live rect, which always reflects true layout position (unlike the pinned sticky bar,
 * whose rect top clamps to 0 and would collapse to the current scroll). Returns 0 if not found.
 */
export function getTabBarPinnedScrollY() {
  const intro = document.getElementById("app-shell-intro");
  if (!intro) {
    return 0;
  }
  return Math.max(0, Math.round(intro.getBoundingClientRect().bottom + window.scrollY));
}

/** Scroll so `element` sits just below the sticky app tab bar. */
export function scrollBelowStickyHeader(element, { behavior = "smooth" } = {}) {
  if (!element) {
    return;
  }

  const top = element.getBoundingClientRect().top + window.scrollY - getStickyScrollOffsetPx();
  scrollWindowTo(top, { behavior });
}
