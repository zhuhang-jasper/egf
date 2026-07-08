export const STORAGE_KEY = "fe-growth-framework:v1";
export const PROFILES_STORAGE_KEY = "fe-growth-framework:profiles:v1";
// Theory tab: whether the "What's New" highlighter is shown, stored as `{ show, version }` so the
// choice can be aged out on a FRAMEWORK_VERSION bump (see useShowLatestChanges). Standalone display
// preference — kept out of the tool-tab draft payload.
export const THEORY_SHOW_CHANGES_KEY = "fe-growth-framework:theory-show-changes:v1";
// The framework revision surfaced in the Theory tab. Bump this only when there's genuinely new
// framework material worth alerting returning users to (not for minor copy tweaks). Rendered next to
// the Theory tab label and compared against THEORY_SEEN_VERSION_KEY to show the "unseen" dot.
export const FRAMEWORK_VERSION = "3.1";
// The framework version the user last saw (set when they open the Theory tab). When this differs
// from FRAMEWORK_VERSION for a returning user, the Theory tab shows an "unseen updates" dot.
export const THEORY_SEEN_VERSION_KEY = "fe-growth-framework:theory-seen-version:v1";
