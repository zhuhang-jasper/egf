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
//
// SELF-RETIRING, AND DELIBERATELY NOT IN RETIRED_STORAGE_KEYS: it is deleted by the migration that
// consumes it (see useTheoryUpdates `readSeenSections`), which is the only place that can know the
// value has been transferred. The boot sweeper runs before React mounts, so retiring it there would
// delete the baseline before anything read it and re-baseline a returning user to "caught up".
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
// Admin (dev) unlock, set by visiting `?admin=1` and answering the password prompt, and cleared by
// `?admin=0` (see features.js). Persisted so dev options survive navigation to the Poster/Social pages
// and reloads.
//
// `:v2` INVALIDATES EVERY PRE-PASSWORD UNLOCK, which is the whole reason it was bumped. `?admin=1` used
// to unlock on its own, so a `:v1` flag is proof of nothing except that the URL was once visited — and
// the prompt is skipped for an already-unlocked device (by design, so it is asked once and not on every
// visit), which would have left the password gating new devices only. Abandoning the old key costs one
// re-entry per device and nothing else: the value is a single "1" with nothing to migrate.
export const ADMIN_UNLOCK_KEY = "fe-growth-framework:admin:v2";

/**
 * Keys this app WROTE in a previous version and will never read again. Deleted on first load (see
 * utils/storage.js `retireLegacyKeys`).
 *
 * AN EXPLICIT LIST, NOT A `:v1` PATTERN SWEEP, and the difference is load-bearing: superseded is not the
 * same as unread. STORAGE_KEY and PROFILES_STORAGE_KEY above are both still `:v1` and are the live,
 * current keys — a sweeper keyed on the version suffix would delete every saved profile. And
 * THEORY_SEEN_VERSION_KEY is read on boot by a user who has not migrated yet, so "not the current key"
 * fails too.
 *
 * A KEY BELONGS HERE ONLY IF NOTHING READS IT AND NOTHING CAN DELETE IT AT A BETTER MOMENT. Where a
 * migration consumes the old value, that migration should delete it itself — it is the only code that
 * knows the value has been transferred, and it cannot be beaten to the punch by a sweep that runs before
 * React mounts (THEORY_SEEN_VERSION_KEY does exactly this). This list is for the leftovers: keys whose
 * successor supersedes them outright, with no value to carry across, like a bumped unlock flag.
 *
 * Add an entry in the same commit that stops reading the key, and leave it in place afterwards: it is
 * what turns an orphan into a deletion, and dropping it later just re-orphans the key on any device that
 * has not visited since.
 *
 * ON A FUTURE `:v3`, REPLACE THE ENTRY RATHER THAN APPENDING TO IT. This list does NOT grow one line per
 * version — it holds at most one retired name per KEY, so its length tracks the number of keys that have
 * ever been bumped (about five, at the very most, for this app) and not the number of bumps. By the time
 * `:v3` ships, the `:v1` entry has been sweeping on every load for a whole release cycle, so the only
 * device still holding `:v1` is one that has not opened the app in all that time. Carrying every
 * historical name forever buys a rounding error's worth of extra cleanup for a list nobody can read.
 */
export const RETIRED_STORAGE_KEYS = [
  // Pre-password admin unlock, superseded by ADMIN_UNLOCK_KEY (`:v2`) above. Nothing reads it: the bump
  // was the lockout, so a leftover "1" here grants nothing — this only stops it lingering forever.
  "fe-growth-framework:admin:v1",
];
