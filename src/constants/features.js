import { ADMIN_UNLOCK_KEY } from "@/constants/storage";

/**
 * Admin (dev) unlock. `?admin=1` asks for a password (AdminUnlockPrompt renders the form) and persists the
 * result; `?admin=0` clears it. The param is stripped once consumed. Resolved once at module-eval, since the
 * URL is already correct before React mounts and this need not react mid-session. localStorage access is
 * guarded, so a disabled store simply stays locked.
 *
 * The password is injected from the VITE_ADMIN_PASSWORD GitHub Actions secret at build time. It still lands
 * in the bundle and stops nobody determined. See docs/DECISIONS.md#admin-gating-is-not-a-security-boundary.
 * When the var is unset (local dev, preview, forks) admin stays locked rather than falling back to a literal.
 */
const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD;

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

/**
 * NOTHING HERE MAY BLOCK. This module is evaluated before React mounts, so a `window.prompt` (which this
 * used to do) white-screens the app wherever modals are suppressed. This only reports that the question is
 * outstanding; AdminUnlockPrompt renders the form after mount.
 * See docs/DECISIONS.md#admin-gating-is-not-a-security-boundary.
 */
function resolveAdminState() {
  if (typeof window === "undefined") {
    return { isAdmin: false, passwordRequested: false };
  }
  // No password configured (local dev, preview, forks): stay locked. Asking would be unanswerable.
  if (!ADMIN_PASSWORD) {
    stripAdminParam();
    return { isAdmin: false, passwordRequested: false };
  }
  const param = new URLSearchParams(window.location.search).get("admin");
  try {
    if (param === "0") {
      localStorage.removeItem(ADMIN_UNLOCK_KEY);
      return { isAdmin: false, passwordRequested: false };
    }
    const alreadyUnlocked = localStorage.getItem(ADMIN_UNLOCK_KEY) === "1";
    // THE UNLOCK CHECK COMES BEFORE THE REQUEST, so `?admin=1` on a device that is already unlocked is a
    // no-op rather than a second password question. A wrong answer cannot lock a device out either: the
    // stored state is returned untouched, and only `?admin=0` ever clears it.
    return { isAdmin: alreadyUnlocked, passwordRequested: param === "1" && !alreadyUnlocked };
  } catch {
    // No localStorage: the unlock cannot be persisted, so there is nothing an answer could achieve
    // beyond this load — and `unlockAdmin` reloads to apply it. Don't ask a question we can't honour.
    return { isAdmin: false, passwordRequested: false };
  } finally {
    stripAdminParam();
  }
}

const ADMIN_STATE = resolveAdminState();

/** True when dev options are unlocked. Enabled via `?admin=1` + password (persisted), cleared via `?admin=0`. */
export const IS_ADMIN = ADMIN_STATE.isAdmin;

/** True when `?admin=1` was visited on a locked device — AdminUnlockPrompt asks for the password. */
export const ADMIN_PASSWORD_REQUESTED = ADMIN_STATE.passwordRequested;

/**
 * Check `password` and, if it is right, unlock and RELOAD.
 *
 * The reload is what keeps `IS_ADMIN` a plain module constant: everything derived from it is computed at
 * module-eval (see the note above), so re-evaluating the whole bundle is both the simplest and the most
 * complete way to apply a mid-session unlock. Alternative would be making the flag reactive state and
 * threading it through every consumer, for a once-per-device event.
 *
 * `.trim()` because a soft keyboard will happily append a space, and a trailing space is an invisible
 * wrong password.
 *
 * @returns false when the password is wrong. On success it does not return — the page reloads.
 */
export function unlockAdmin(password) {
  // Guard the unset case explicitly: an empty answer must not match an absent ADMIN_PASSWORD.
  if (!ADMIN_PASSWORD || password.trim() !== ADMIN_PASSWORD) {
    return false;
  }
  try {
    localStorage.setItem(ADMIN_UNLOCK_KEY, "1");
  } catch {
    // A store that cannot be written means the reload would come back locked. Nothing useful to do.
    return false;
  }
  window.location.reload();
  return true;
}

/** When false, hides score cards and the Scores display toggle. Admin-gated. */
export const FEATURE_SCORES_SETTINGS = IS_ADMIN;

/**
 * When false, hides the "Chart" and "Level labels" display toggles. Admin-gated because both strip
 * information the exported image needs to stand on its own: the polygon IS the data and the 0-5 ticks are the
 * only scale to read it against.
 *
 * Gating the toggle is not enough on its own: parseChartDisplay() in utils/storage.js also forces both flags
 * off whenever this is false, or a draft persisted while the toggle was reachable would strand a public user
 * with a broken chart and no way back.
 */
export const FEATURE_CHART_STRUCTURE_SETTINGS = IS_ADMIN;

/**
 * When false, hides the "Attribution" toggle so every exported chart PNG carries the credit line.
 *
 * The line is what makes a shared image traceable: an exported chart travels without the message it was
 * posted with, and the framework content is CC BY-NC, which requires attribution. So the public build has no
 * control to remove it, and parseChartDisplay() forces the flag back off whenever this is false, or a draft
 * persisted while the toggle was reachable would keep stripping it.
 *
 * Admin-gated rather than absent because the author's own materials (poster, README, slides) already carry
 * the credit around the image and do not need it burned in twice.
 */
export const FEATURE_CHART_ATTRIBUTION_SETTING = IS_ADMIN;

/**
 * When false, hides the high-res export toggle so every exported chart PNG uses the default scale
 * (exportImageCssScale, tuned for social feeds — see the note there).
 *
 * The default is the right one for sharing: it lands just above the width the feeds render at, and it keeps the
 * file small. The higher scale only pays off when the still is blown up well past that — print, or stretched
 * across a slide — which is an authoring need rather than a sharing one, so it is admin-gated instead of a
 * public choice nobody has the context to make.
 *
 * Gating the toggle is not enough on its own: parseChartDisplay() in utils/storage.js also forces the flag
 * off whenever this is false, or a draft persisted while the toggle was reachable would leave a public user
 * exporting oversized files they never asked for and have no control to switch off.
 */
export const FEATURE_CHART_UHD_EXPORT_SETTING = IS_ADMIN;

/**
 * When false, hides the "Legend" display toggle so every chart carries the cluster legend.
 *
 * Deliberately separate from FEATURE_CHART_STRUCTURE_SETTINGS despite both being IS_ADMIN today, because only
 * this one is a judgement call: hiding the polygon makes the image unreadable, whereas hiding the legend only
 * costs reach. The legend is what names the model and marks a shared chart as this framework rather than a
 * generic radar. That is a promotion bet worth revisiting, so keep it independently flippable.
 */
export const FEATURE_CHART_LEGEND_SETTING = IS_ADMIN;
