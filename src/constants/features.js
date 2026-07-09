import { ADMIN_UNLOCK_KEY } from "@/constants/storage";

/**
 * Admin (dev) unlock. Visiting `?admin=1` once turns it on and persists it to localStorage, so it
 * survives navigation to the Poster/Social pages and reloads; `?admin=0` clears it. Once the param
 * has been consumed it is stripped from the URL (the state now lives in localStorage), leaving a
 * clean address bar. Gates dev-only UI: the Scores display toggle/cards, and the Poster/Social tabs.
 *
 * Resolved once at module-eval time — the URL is already correct before React mounts (see route.js),
 * and dev-unlock state doesn't need to react mid-session. localStorage access is guarded so a
 * disabled/throwing store falls back to "URL only, this load".
 */
function stripAdminParam() {
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("admin")) {
      return;
    }
    url.searchParams.delete("admin");
    window.history.replaceState(window.history.state, "", url);
  } catch {
    // history/URL unavailable — leave the URL as-is.
  }
}

function resolveIsAdmin() {
  if (typeof window === "undefined") {
    return false;
  }
  const param = new URLSearchParams(window.location.search).get("admin");
  try {
    if (param === "1") {
      localStorage.setItem(ADMIN_UNLOCK_KEY, "1");
      return true;
    }
    if (param === "0") {
      localStorage.removeItem(ADMIN_UNLOCK_KEY);
      return false;
    }
    return localStorage.getItem(ADMIN_UNLOCK_KEY) === "1";
  } catch {
    return param === "1";
  } finally {
    stripAdminParam();
  }
}

/** True when dev options are unlocked. Enabled via `?admin=1` (persisted), cleared via `?admin=0`. */
export const IS_ADMIN = resolveIsAdmin();

/** When false, hides score cards and the Scores display toggle. Admin-gated. */
export const FEATURE_SCORES_SETTINGS = IS_ADMIN;
