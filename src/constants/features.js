import { ADMIN_UNLOCK_KEY } from "@/constants/storage";

/**
 * Admin (dev) unlock. Visiting `?admin=1` ASKS FOR A PASSWORD (see AdminUnlockPrompt, which renders the
 * form) and, on the right answer, persists the unlock to localStorage so it survives navigation to the
 * Poster/Social pages and reloads; `?admin=0` clears it. Once the param has been consumed it is stripped
 * from the URL (the state now lives in localStorage), leaving a clean address bar. Gates dev-only UI: the
 * Scores display toggle/cards, the Poster/Social tabs, and the `/poster` and `/social` routes themselves.
 *
 * Resolved once at module-eval time — the URL is already correct before React mounts (see route.js), and
 * dev-unlock state doesn't need to react mid-session. localStorage access is guarded so a disabled or
 * throwing store simply stays locked.
 */

/**
 * The password `?admin=1` asks for. A plain literal in the bundle, and the localStorage flag can be set
 * by hand in devtools — so this stops a colleague who is handed the URL, not anyone determined. That is
 * the right ceiling for what is behind it (dev shortcuts and display toggles); anything that actually
 * needs protecting needs a server, not a longer string here.
 */
const ADMIN_PASSWORD = "zhuhang-jasper-egf";

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
 * NOTHING HERE MAY BLOCK, and `window.prompt` is exactly what this used to do wrong. This module is
 * evaluated on the import path, BEFORE React mounts, because `IS_ADMIN` has to be final by the time
 * HomePage's `VALID_TABS` and AppBottomNav's nav items are built from it at their own module-eval. A
 * blocking dialog there boots nothing until it is answered — and in any context that suppresses modals
 * (VS Code's Simple Browser, sandboxed iframes without `allow-modals`, some in-app webviews) it is never
 * answered and never dismissed, so the app white-screens instead of loading.
 *
 * So the password is asked for by ORDINARY UI, after mount: this function only reports that the question
 * is outstanding, and AdminUnlockPrompt renders the form. The suppressed-dialog case degrades to "the
 * app loads, unlocked stays off" rather than to a blank page.
 */
function resolveAdminState() {
  if (typeof window === "undefined") {
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
  if (password.trim() !== ADMIN_PASSWORD) {
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
 * information the exported image needs to stand on its own: the levels polygon IS the data, and the
 * 0–5 ticks are the only scale a viewer can read magnitude against. A chart that circulates without
 * them is unreadable and not comparable to anyone else's, so the public build keeps both on.
 *
 * Gating the toggle is not enough on its own — a draft persisted while the toggle was reachable
 * would otherwise leave a public user stuck with a broken chart and no way back. parseChartDisplay()
 * in src/utils/storage.js forces both flags off whenever this is false.
 */
export const FEATURE_CHART_STRUCTURE_SETTINGS = IS_ADMIN;

/**
 * When false, hides the "Legend" display toggle so every chart carries the cluster legend.
 *
 * Deliberately a separate flag from FEATURE_CHART_STRUCTURE_SETTINGS even though both are currently
 * IS_ADMIN, because the reasoning differs and only one of them is a judgement call. Hiding the
 * polygon or the ticks makes the image unreadable; hiding the legend only costs reach. The legend is
 * the one element that names the model (Technical / Product / Operational) and so marks a shared
 * chart as this framework rather than a generic radar. That is a promotion bet, and a reasonable one
 * to revisit, so keep it independently flippable.
 */
export const FEATURE_CHART_LEGEND_SETTING = IS_ADMIN;
