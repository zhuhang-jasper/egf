/**
 * URL-based deep linking for the Theory tab.
 *
 * Supported params:
 *   tab=theory
 *   section=pillars|seniority|matrix|tracks
 *   pillar=<pillarId>   (only meaningful when section=matrix)
 *
 * Recipient flow: parse on boot → set tab + section + pillar → clean URL.
 * Sharer flow: build URL from current UI state → copy to clipboard.
 */

const EXPANDED_PILLAR_SESSION_KEY = "app:expandedPillar";

export function getPersistedExpandedPillar() {
  try {
    return sessionStorage.getItem(EXPANDED_PILLAR_SESSION_KEY) || null;
  } catch {
    return null;
  }
}

export function persistExpandedPillar(id) {
  try {
    if (id) {
      sessionStorage.setItem(EXPANDED_PILLAR_SESSION_KEY, id);
    } else {
      sessionStorage.removeItem(EXPANDED_PILLAR_SESSION_KEY);
    }
  } catch {}
}

export const THEORY_SECTIONS = {
  pillars: "pillars",
  seniority: "seniority",
  matrix: "matrix",
  tracks: "tracks",
};

export const THEORY_SECTION_IDS = {
  [THEORY_SECTIONS.pillars]: "theory-section-pillars",
  [THEORY_SECTIONS.seniority]: "theory-section-seniority",
  [THEORY_SECTIONS.matrix]: "theory-section-matrix",
  [THEORY_SECTIONS.tracks]: "theory-section-tracks",
};

/** Stable DOM id for a matrix pillar card, so deep-links can scroll to the pillar (not just the section). */
export function getPillarCardElementId(pillarId) {
  return `theory-matrix-pillar-${pillarId}`;
}

const PARAM_TAB = "tab";
const PARAM_SECTION = "section";
const PARAM_PILLAR = "pillar";

/**
 * Parse theory deep-link params from the current URL.
 * Returns null if this isn't a theory deep-link.
 */
export function parseTheoryDeepLink() {
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get(PARAM_TAB) !== "theory") {
      return null;
    }
    const section = params.get(PARAM_SECTION);
    const pillar = params.get(PARAM_PILLAR);
    return {
      section: Object.values(THEORY_SECTIONS).includes(section) ? section : null,
      pillar: pillar || null,
    };
  } catch {
    return null;
  }
}

/**
 * Read the active tab from the URL. Returns one of `validTabs` or null.
 */
export function getTabFromUrl(validTabs) {
  try {
    const tab = new URLSearchParams(window.location.search).get(PARAM_TAB);
    return tab && validTabs.includes(tab) ? tab : null;
  } catch {
    return null;
  }
}

/**
 * Reflect the active tab in the URL bar without a navigation event, so the URL
 * is shareable at all times. Drops the deep-link-only `section`/`pillar` params.
 */
export function syncTabInUrl(tab) {
  try {
    const url = new URL(window.location.href);
    url.searchParams.set(PARAM_TAB, tab);
    window.history.replaceState(null, "", url.toString());
  } catch {}
}

/**
 * Remove the consumed deep-link params (`section`/`pillar`) from the URL bar
 * without a navigation event, while keeping `tab` so the URL stays shareable.
 * Called after the app has consumed the deep-link on first mount.
 */
export function cleanTheoryDeepLinkParams() {
  try {
    const url = new URL(window.location.href);
    url.searchParams.delete(PARAM_SECTION);
    url.searchParams.delete(PARAM_PILLAR);
    window.history.replaceState(null, "", url.toString());
  } catch {}
}

/**
 * Build a shareable URL for the current theory state.
 * @param {string|null} section - one of THEORY_SECTIONS values
 * @param {string|null} pillar  - pillarId (only when section=matrix)
 */
export function buildTheoryShareUrl(section, pillar) {
  const url = new URL(window.location.href);
  // Preserve any existing params (e.g. ?score=1) except our own.
  url.searchParams.delete(PARAM_TAB);
  url.searchParams.delete(PARAM_SECTION);
  url.searchParams.delete(PARAM_PILLAR);

  url.searchParams.set(PARAM_TAB, "theory");
  if (section) {
    url.searchParams.set(PARAM_SECTION, section);
  }
  if (section === THEORY_SECTIONS.matrix && pillar) {
    url.searchParams.set(PARAM_PILLAR, pillar);
  }
  return url.toString();
}
