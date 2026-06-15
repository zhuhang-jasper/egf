const SCORES_SETTINGS_DEFAULT = false;

function resolveScoresSettings() {
  if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("score") === "1") {
    return true;
  }
  return SCORES_SETTINGS_DEFAULT;
}

/** When false, hides score cards and the Scores display toggle. Enabled via `?score=1`. */
export const FEATURE_SCORES_SETTINGS = resolveScoresSettings();
