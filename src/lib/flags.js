const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");

export const AI_MODE = params.get("ai");

/**
 * `?ai=1` — AI augmentation scores on Coding, Architecture, and Process (second chart polygon).
 * Chart uses 7 pillars (no dedicated AI pillar).
 */
export const AI_AUGMENTATION_ENABLED = AI_MODE === "1";

/**
 * `?ai=2` — 🤖 AI as a dedicated pillar on the chart and form (8 pillars).
 * No per-pillar AI augmentation inputs or second chart polygon.
 */
export const AI_PILLAR_ENABLED = AI_MODE === "2";

/** @deprecated Use {@link AI_AUGMENTATION_ENABLED}. */
export const AI_FEATURE_ENABLED = AI_AUGMENTATION_ENABLED;

/** Show footer score boxes via `?score=1`. */
export const SHOW_FOOTER_AVERAGES = params.get("score") === "1";
