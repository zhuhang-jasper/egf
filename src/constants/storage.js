export const STORAGE_KEY = "fe-growth-framework:v1";
export const PROFILES_STORAGE_KEY = "fe-growth-framework:profiles:v1";
// Version of the persisted draft/profile payload shape (stored inline as `schemaVersion`). v1 = the
// original shape with a `trackVariant` field; v2 sunsets it for a cosmetic `attachedBadge` (legacy
// `fe` → `none`, `be` → `be`). On load, pre-v2 payloads are migrated in place (see storage.js).
export const SCHEMA_VERSION = 2;
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
// Admin (dev) unlock, set by visiting `?admin=1` and cleared by `?admin=0` (see features.js).
// Persisted so dev options survive navigation to the Poster/Social pages and reloads.
export const ADMIN_UNLOCK_KEY = "fe-growth-framework:admin:v1";
