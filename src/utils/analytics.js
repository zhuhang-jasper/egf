// Google Analytics 4 (gtag.js) — conditional, prod-only loader.
//
// GA only runs when VITE_GA_ID is set at build time. In local dev and preview
// (where the var is absent) every function here is an inert no-op, so we never
// pollute production stats with our own testing. The Measurement ID is injected
// from the VITE_GA_ID GitHub Actions variable during the Pages build.

const GA_ID = import.meta.env.VITE_GA_ID;
const APP_VERSION = import.meta.env.VITE_APP_VERSION;

let initialized = false;

/**
 * How the app is being viewed:
 *  - "twa"            → Android Trusted Web Activity (installed via Play Store wrapper)
 *  - "standalone" / "fullscreen" / "minimal-ui" → installed PWA (matched display-mode)
 *  - "ios-standalone" → installed PWA on iOS (navigator.standalone; no reliable matchMedia)
 *  - "browser"        → a normal browser tab
 */
function getDisplayMode() {
  if (typeof window === "undefined") {
    return "unknown";
  }
  // Android TWA sets the referrer to android-app://
  if (document.referrer.startsWith("android-app://")) {
    return "twa";
  }
  // iOS Safari doesn't support display-mode media queries reliably; it exposes
  // navigator.standalone instead.
  if (window.navigator.standalone === true) {
    return "ios-standalone";
  }
  for (const mode of ["fullscreen", "standalone", "minimal-ui"]) {
    if (window.matchMedia(`(display-mode: ${mode})`).matches) {
      return mode;
    }
  }
  return "browser";
}

/** True when launched as an installed PWA / TWA (any non-browser display mode). */
function isInstalledApp(displayMode) {
  return displayMode !== "browser" && displayMode !== "unknown";
}

/** Coarse device class from UA + viewport — "mobile" | "tablet" | "desktop". */
function getDeviceType() {
  if (typeof window === "undefined") {
    return "unknown";
  }
  const ua = navigator.userAgent;
  if (/iPad|Tablet|PlayBook|Silk|(Android(?!.*Mobile))/i.test(ua)) {
    return "tablet";
  }
  if (/Mobi|Android|iPhone|iPod|IEMobile|BlackBerry|Opera Mini/i.test(ua)) {
    return "mobile";
  }
  // Touch-capable wide screens (large tablets/foldables) → tablet, else desktop.
  const isTouch = navigator.maxTouchPoints > 1;
  if (isTouch && Math.min(window.innerWidth, window.innerHeight) <= 1024) {
    return "tablet";
  }
  return "desktop";
}

/**
 * Inject gtag.js and initialize GA once. Safe to call multiple times and safe
 * to call when GA_ID is unset (does nothing). Called once on app mount.
 *
 * Sets app_version as a config-level param so it rides on every event, then
 * fires a one-off `app_open` event recording display mode + device type.
 */
export function initAnalytics() {
  if (initialized || !GA_ID || typeof document === "undefined") {
    return;
  }
  initialized = true;

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  // gtag must push the literal `arguments` object — do not refactor to (...args).
  function gtag() {
    // eslint-disable-next-line prefer-rest-params -- gtag relies on the live `arguments` object
    window.dataLayer.push(arguments);
  }
  window.gtag = gtag;

  gtag("js", new Date());
  // app_version sticks to every hit (incl. the automatic page_view) so all stats
  // can be sliced by release.
  gtag("config", GA_ID, { app_version: APP_VERSION });

  const displayMode = getDisplayMode();
  track("app_open", {
    display_mode: displayMode,
    install_type: isInstalledApp(displayMode) ? "installed_pwa" : "browser",
    device_type: getDeviceType(),
    app_version: APP_VERSION,
  });
}

/**
 * Fire a custom GA event. No-op when GA isn't loaded (dev/preview, or before
 * init). `params` is an optional flat object of event parameters.
 */
export function track(event, params = {}) {
  if (!GA_ID || typeof window === "undefined" || typeof window.gtag !== "function") {
    return;
  }
  window.gtag("event", event, params);
}
