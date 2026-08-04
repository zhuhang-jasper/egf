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

/**
 * Which matrix pillar is open, as THREE states rather than two:
 *
 *   "coding"   that pillar is open
 *   ""         nothing is open, and the user closed it
 *   null       nothing is open, and the user has not touched the matrix this session
 *
 * The last two used to be one value — closing everything called `removeItem`, so it was
 * indistinguishable from a fresh session. That is fine when the default is "all collapsed" and stops
 * being fine the moment there IS a default: the matrix opens its first pillar on a fresh visit (see
 * TheoryContent), which must not quietly undo a collapse the user performed and then reloaded into.
 *
 * So a deliberate none is STORED as the empty string, and only an absent key means "never chosen".
 * Callers wanting the plain two-state answer can read `getPersistedExpandedPillar() || null`.
 */
export function getPersistedExpandedPillar() {
  try {
    return sessionStorage.getItem(EXPANDED_PILLAR_SESSION_KEY);
  } catch {
    return null;
  }
}

export function persistExpandedPillar(id) {
  try {
    sessionStorage.setItem(EXPANDED_PILLAR_SESSION_KEY, id || "");
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
    // Only a real section deep-link counts. A plain `?tab=theory` (always present in the URL) is not
    // a deep-link — treating it as one made every Theory refresh run the boot deep-link path.
    if (!Object.values(THEORY_SECTIONS).includes(section)) {
      return null;
    }
    const pillar = params.get(PARAM_PILLAR);
    return {
      section,
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
  // Preserve any existing params (e.g. ?admin=1) except our own.
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
