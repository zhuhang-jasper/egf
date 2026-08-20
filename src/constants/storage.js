export const STORAGE_KEY = "fe-growth-framework:v1";
export const PROFILES_STORAGE_KEY = "fe-growth-framework:profiles:v1";

/** Persisted payload shape, stored inline as `schemaVersion`. Pre-v2 payloads migrate on load (storage.js). */
export const SCHEMA_VERSION = 2;

/**
 * Legacy (v1): the version the Theory tab was last OPENED at, superseded by the per-section map below and
 * still read once to migrate an existing baseline.
 *
 * Self-retiring, and deliberately NOT in RETIRED_STORAGE_KEYS: the migration that consumes it deletes it,
 * because the boot sweeper runs before React mounts and would wipe the baseline before anything read it.
 */
export const THEORY_SEEN_VERSION_KEY = "fe-growth-framework:theory-seen-version:v1";

/** `{ sectionId: version }` — the version each section was last scrolled through at. Absent = fresh user. */
export const THEORY_SEEN_SECTIONS_KEY = "fe-growth-framework:theory-seen-sections:v1";

/**
 * In-progress reads: `{ sectionId: { version, edges } }`. A section needs BOTH edges seen, which for a tall
 * one rarely happens in a single sitting. `version` scopes the progress, so stale partial credit can never
 * clear a newer version's dot.
 */
export const THEORY_SECTION_PROGRESS_KEY = "fe-growth-framework:theory-section-progress:v1";

/**
 * Admin unlock (see features.js). The suffix is bumped whenever the password itself is retired, because the
 * prompt is skipped for an already-unlocked device: without a bump, a new password would gate new devices
 * only and every device unlocked under the old one would stay in.
 *
 * `:v2` invalidated every pre-password unlock. `:v3` invalidates every unlock made with the pre-hash
 * password, which was a plain literal in a public repo and is therefore permanently compromised.
 *
 * A bump costs nothing but a re-entry for the DATA that matters: profiles, pillar levels and titles live in
 * their own keys and are never touched. The five admin-gated chart toggles are the exception — a locked load
 * reads them as their defaults and the next persistDraft writes that back (see parseChartDisplay), so they
 * are reset rather than preserved. Accepted deliberately: there is one admin, and re-setting a few display
 * toggles is cheaper than keeping dormant state alive for every public user.
 */
export const ADMIN_UNLOCK_KEY = "fe-growth-framework:admin:v3";

/**
 * Epoch ms of the last install-banner dismissal, read back as a cooldown. The header pill ignores it
 * entirely, which is what makes the cooldown safe: it silences only the surface that appears uninvited.
 */
export const INSTALL_DISMISSED_AT_KEY = "fe-growth-framework:install-dismissed-at:v1";

/**
 * How long a dismissal suppresses the banner. Rolling rather than a total cap, with deliberately no
 * "asked N times, give up" counter, since the pill is the permanent path. Only the X starts the cooldown;
 * cancelling the browser's own install sheet does not.
 */
export const INSTALL_DISMISS_DAYS = 7;

/**
 * Profiles this device has ever CREATED: a lifetime total, never decremented. Creations rather than saves,
 * so iterating on one profile reminds once; lifetime rather than `profiles.length`, so deleting everything
 * does not replay the reminder from 1.
 */
export const PROFILE_SAVE_COUNT_KEY = "fe-growth-framework:profile-save-count:v1";

/**
 * Creation counts that trigger the backup modal. First, then sparse: the 1st is the only moment the warning
 * is news, and a nudge that fires often enough to be dismissed reflexively teaches exactly that. Read via a
 * predicate rather than a "last shown" marker, so there is no second key to sync.
 */
export const BACKUP_REMINDER_FIRST = 1;
export const BACKUP_REMINDER_EVERY = 10;

/**
 * Keys written by a previous version and never read again, deleted on first load by `retireLegacyKeys`.
 *
 * An explicit list, NEVER a `:v1` pattern sweep: STORAGE_KEY and PROFILES_STORAGE_KEY are still `:v1` and
 * live, so a version-suffix sweep would delete every saved profile. A key belongs here only if nothing reads
 * it and nothing can delete it at a better moment.
 *
 * EVERY superseded generation stays listed, not just the most recent one. A device that has not loaded the
 * app since before a bump still holds that generation's key, and dropping the name is what would strand it
 * permanently — nothing else ever deletes it. Listing them all is free: the sweep names exact keys (so it
 * carries none of the pattern risk above) and `removeItem` on an absent key is a no-op.
 */
export const RETIRED_STORAGE_KEYS = [
  // Pre-password admin unlock, superseded by `:v2`. Nothing reads it; the bump was the lockout.
  "fe-growth-framework:admin:v1",
  // Unlocks made with the pre-hash password, superseded by `:v3` above. That password shipped as a literal
  // in a public repo, so every unlock it granted is void — see the ADMIN_UNLOCK_KEY note.
  "fe-growth-framework:admin:v2",
];
