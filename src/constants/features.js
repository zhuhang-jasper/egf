import { ADMIN_UNLOCK_KEY } from "@/constants/storage";

// Build-time PBKDF2 digest of VITE_ADMIN_PASSWORD; absent in local dev, preview and forks, where admin
// stays locked. See docs/DECISIONS.md#admin-gating-is-not-a-security-boundary.
const ADMIN_PASSWORD_HASH = import.meta.env.VITE_ADMIN_PASSWORD_HASH;
const PBKDF2 = import.meta.env.VITE_ADMIN_PBKDF2;

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

// NOTHING HERE MAY BLOCK: this runs at module-eval, before React mounts. It only reports that the password
// question is outstanding; AdminUnlockPrompt renders the form after mount.
// See docs/DECISIONS.md#admin-gating-is-not-a-security-boundary.
function resolveAdminState() {
  if (typeof window === "undefined") {
    return { isAdmin: false, passwordRequested: false };
  }
  if (!ADMIN_PASSWORD_HASH) {
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
    // Unlock check precedes the request, so `?admin=1` on an unlocked device is a no-op rather than a
    // second password question.
    return { isAdmin: alreadyUnlocked, passwordRequested: param === "1" && !alreadyUnlocked };
  } catch {
    // Without localStorage the unlock cannot outlive the reload `unlockAdmin` uses to apply it, so don't
    // ask a question we can't honour.
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

// Async because `deriveBits` has no sync form; returns "" when crypto.subtle is unavailable, which reads as
// a failed unlock.
async function derivePasswordHash(password) {
  if (!password || !globalThis.crypto?.subtle) {
    return "";
  }
  const encoder = new TextEncoder();
  try {
    const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt: encoder.encode(PBKDF2.salt),
        iterations: PBKDF2.iterations,
        hash: PBKDF2.hash,
      },
      key,
      PBKDF2.keyLengthBytes * 8,
    );
    return Array.from(new Uint8Array(bits), (byte) => byte.toString(16).padStart(2, "0")).join("");
  } catch {
    return "";
  }
}

/** Constant-time compare, so a wrong answer's failure point is not observable in the timing. */
function timingSafeEqual(a, b) {
  if (a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Unlocks and RELOADS on a correct password, resolving false otherwise. The reload is what keeps `IS_ADMIN` a
 * plain module constant: re-evaluating the bundle applies a mid-session unlock everywhere it is derived from.
 * `.trim()` because a soft keyboard's trailing space is an invisible wrong password.
 */
export async function unlockAdmin(password) {
  // Explicit, so an empty answer cannot match an absent hash.
  if (!ADMIN_PASSWORD_HASH) {
    return false;
  }
  const digest = await derivePasswordHash(password.trim());
  if (!digest || !timingSafeEqual(digest, ADMIN_PASSWORD_HASH)) {
    return false;
  }
  try {
    localStorage.setItem(ADMIN_UNLOCK_KEY, "1");
  } catch {
    // An unwritable store means the reload comes back locked.
    return false;
  }
  window.location.reload();
  return true;
}

/** When false, hides score cards and the Scores display toggle. Admin-gated. */
export const FEATURE_SCORES_SETTINGS = IS_ADMIN;

/**
 * When false, hides the "Chart" and "Level labels" toggles: both strip information the exported image needs
 * to stand on its own. parseChartDisplay() in utils/storage.js must also force both flags off, or a draft
 * persisted while the toggle was reachable strands a public user with a broken chart.
 */
export const FEATURE_CHART_STRUCTURE_SETTINGS = IS_ADMIN;

/**
 * When false, hides the "Attribution" toggle so every exported PNG carries the credit line, which CC BY-NC
 * requires and which travels with an image that has left its posting context. Admin-gated rather than absent
 * because the author's own materials already carry the credit around the image.
 * parseChartDisplay() must also force the flag off, or a draft persisted while the toggle was reachable
 * keeps stripping it.
 */
export const FEATURE_CHART_ATTRIBUTION_SETTING = IS_ADMIN;

/**
 * When false, pins exports to the default scale (exportImageCssScale, tuned for social feeds). The higher
 * scale only pays off in print or across a slide, an authoring need rather than a sharing one.
 * parseChartDisplay() must also force the flag off, or a draft persisted while the toggle was reachable
 * leaves a public user exporting oversized files with no control to switch off.
 */
export const FEATURE_CHART_UHD_EXPORT_SETTING = IS_ADMIN;

/**
 * When false, every chart carries the cluster legend. Separate from FEATURE_CHART_STRUCTURE_SETTINGS despite
 * both being IS_ADMIN today: hiding the polygon makes the image unreadable, whereas hiding the legend only
 * costs the reach of naming the framework. That bet is worth revisiting, so keep it independently flippable.
 */
export const FEATURE_CHART_LEGEND_SETTING = IS_ADMIN;
