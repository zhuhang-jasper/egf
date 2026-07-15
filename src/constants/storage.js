export const STORAGE_KEY = "fe-growth-framework:v1";
export const PROFILES_STORAGE_KEY = "fe-growth-framework:profiles:v1";
// Version of the persisted draft/profile payload shape (stored inline as `schemaVersion`). v1 = the
// original shape with a `trackVariant` field; v2 sunsets it for a cosmetic `attachedBadge` (legacy
// `fe` → `none`, `be` → `be`). On load, pre-v2 payloads are migrated in place (see storage.js).
export const SCHEMA_VERSION = 2;
// The framework revision surfaced in the Theory tab. Bump this only when there's genuinely new
// framework material worth alerting returning users to (not for minor copy tweaks). Rendered next to
// the Theory tab label and compared against THEORY_SEEN_VERSION_KEY to show the "unseen" dot.
export const FRAMEWORK_VERSION = "3.2";
// The framework version the user last opened the Theory tab at. Drives the unseen-updates dot (see
// useTheoryUpdates): absent = fresh user (no dot); < FRAMEWORK_VERSION = behind (dot on); == current
// = caught up. Stamped to current whenever the Theory tab is opened, which dismisses the dot.
export const THEORY_SEEN_VERSION_KEY = "fe-growth-framework:theory-seen-version:v1";
// Admin (dev) unlock, set by visiting `?admin=1` and cleared by `?admin=0` (see features.js).
// Persisted so dev options survive navigation to the Poster/Social pages and reloads.
export const ADMIN_UNLOCK_KEY = "fe-growth-framework:admin:v1";
