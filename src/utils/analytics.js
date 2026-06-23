// Google Analytics 4 (gtag.js) — conditional, prod-only loader.
//
// GA only runs when VITE_GA_ID is set at build time. In local dev and preview
// (where the var is absent) every function here is an inert no-op, so we never
// pollute production stats with our own testing. The Measurement ID is injected
// from the VITE_GA_ID GitHub Actions secret during the Pages build.

const GA_ID = import.meta.env.VITE_GA_ID;

let initialized = false;

/**
 * Inject gtag.js and initialize GA once. Safe to call multiple times and safe
 * to call when GA_ID is unset (does nothing). Called once on app mount.
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
    window.dataLayer.push(arguments);
  }
  window.gtag = gtag;

  gtag("js", new Date());
  gtag("config", GA_ID);
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
