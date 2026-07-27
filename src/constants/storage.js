export const STORAGE_KEY = "fe-growth-framework:v1";
export const PROFILES_STORAGE_KEY = "fe-growth-framework:profiles:v1";
// Version of the persisted draft/profile payload shape (stored inline as `schemaVersion`). v1 = the
// original shape with a `trackVariant` field; v2 sunsets it for a cosmetic `attachedBadge` (legacy
// `fe` → `none`, `be` → `be`). On load, pre-v2 payloads are migrated in place (see storage.js).
export const SCHEMA_VERSION = 2;
// The framework revision surfaced in the Theory tab. Bump this only when there's genuinely new
// framework material worth alerting returning users to (not for minor copy tweaks). Rendered next to
// the Theory tab label, and stamped into THEORY_SEEN_SECTIONS_KEY as each section is read.
//
// A bump alone raises NO dots: which sections light up comes from the matching CHANGELOG entry's
// `sections` field, so add the entry in the same commit as the bump.
export const FRAMEWORK_VERSION = "4.1";
// LEGACY (v1): a single version string — the framework version the user last OPENED the Theory tab
// at. Superseded by the per-section map below, which dismisses on scroll rather than on open. Still
// read once, to migrate an existing user's baseline so the switch doesn't light every dot at once.
export const THEORY_SEEN_VERSION_KEY = "fe-growth-framework:theory-seen-version:v1";
// The per-section seen map: `{ sectionId: version }`, the changelog version each Theory section was
// last SCROLLED INTO VIEW at. Drives the section dots and, in aggregate, the Theory tab dot (see
// useTheoryUpdates). Absent map = fresh user, baselined to current on first visit so no dot shows.
export const THEORY_SEEN_SECTIONS_KEY = "fe-growth-framework:theory-seen-sections:v1";
// In-progress reads: `{ sectionId: { version, edges: ["head"|"tail"] } }`. A section is marked read
// only once BOTH its head and tail have been in view, and those two rarely happen in one sitting for
// a tall section — so a partial (one-edge) read is parked here and survives a reload or tab switch.
// `version` scopes the progress: a half-read at v4.1 is discarded when v4.2 changes that section, so
// stale partial credit can never clear a newer version's dot. Cleared per section once complete.
export const THEORY_SECTION_PROGRESS_KEY = "fe-growth-framework:theory-section-progress:v1";
// Admin (dev) unlock, set by visiting `?admin=1` and cleared by `?admin=0` (see features.js).
// Persisted so dev options survive navigation to the Poster/Social pages and reloads.
export const ADMIN_UNLOCK_KEY = "fe-growth-framework:admin:v1";
