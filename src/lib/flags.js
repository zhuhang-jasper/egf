const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");

/** Enable AI inputs, chart layer, and footer via `?ai=1`. */
export const AI_FEATURE_ENABLED = params.get("ai") === "1";

/** Show footer score boxes via `?score=1`. */
export const SHOW_FOOTER_AVERAGES = params.get("score") === "1";
