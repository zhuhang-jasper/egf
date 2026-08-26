/**
 * Which framework revision a profile was rated against, and whether anything it scored has moved since.
 *
 * Dependency-free on purpose: the changelog is passed in, not imported, so verify-profile-stamp.mjs can run
 * this under bare node and stub its own history (changelog.js needs an alias and import.meta.env). Treated
 * as newest-first throughout.
 */

/** A profile's stamp is either recorded (saved with one) or inferred from when the profile was saved. */
export const STAMP_SOURCE = {
  recorded: "recorded",
  derived: "derived",
  unknown: "unknown",
};

/**
 * Bump commit timestamps, newest first — used to date an UNSTAMPED profile from its own `savedAt`.
 *
 * CLOSED: stamping shipped in 4.3, so an unstamped profile cannot reliably be identified as 4.3. The newest
 * version this fallback may infer is therefore 4.2; explicit 4.3 stamps are handled separately. Commit times
 * rather than changelog `date` strings, which are hand-typed and drift a day or two. 4.0 and 3.0 are absent
 * because they never shipped (3.2 → 4.1 direct).
 *
 * 2.9 and 2.8 predate both the changelog and FRAMEWORK_VERSION — 2.8's timestamp is the app commit that
 * first showed it on the Theory tab's nav label. 2.4-2.7 predate the app showing any version at all; those
 * four are dated from the source PDF's own revision timestamps instead, since that PDF is what the matrix
 * actually was before the app caught up to it. Nothing is known before 2.4, so a save older than that has
 * no version to name.
 */
const LEGACY_RELEASES = [
  ["4.2", "2026-08-07T16:06:57+08:00"],
  ["4.1", "2026-07-27T16:04:18+08:00"],
  ["3.2", "2026-07-16T02:36:36+08:00"],
  ["3.1", "2026-07-09T03:59:29+08:00"],
  ["2.9", "2026-06-21T19:49:21+08:00"],
  ["2.8", "2026-06-15T18:22:40+08:00"],
  ["2.7", "2026-06-11T19:43:00+08:00"],
  ["2.6", "2026-06-10T12:11:00+08:00"],
  ["2.5", "2026-06-10T10:30:00+08:00"],
  ["2.4", "2026-06-09T12:01:00+08:00"],
].map(([version, iso]) => ({ version, at: Date.parse(iso) }));

/** The version live when `savedAt` was written, or null if it predates the oldest release we know of. */
function versionLiveAt(savedAt) {
  if (!Number.isFinite(savedAt) || savedAt <= 0) {
    return null;
  }
  for (const { version, at } of LEGACY_RELEASES) {
    if (savedAt >= at) {
      return version;
    }
  }
  return null;
}

/** Per-pillar verdicts. `mixed` means the bars either side of the score moved toward it from both directions. */
export const PILLAR_STATE = {
  clear: "clear",
  raised: "raised",
  eased: "eased",
  mixed: "mixed",
  unverified: "unverified",
  /**
   * Flagged, but the user has since changed this pillar's score — so they have engaged with it. A VIEW state
   * only: it never comes out of the resolver (which sees one score, not an edit), and it is never stored. The
   * form derives it so a run of amber rows visibly shrinks as they are worked through.
   */
  reviewed: "reviewed",
};

/** "4.10" → 4.010, so minor numbers compare by magnitude rather than lexically. null if unparsable. */
function parseVersion(version) {
  if (typeof version !== "string") {
    return null;
  }
  const match = /^(?<major>\d+)(?:\.(?<minor>\d+))?/.exec(version.trim());
  if (!match) {
    return null;
  }
  return Number(match.groups.major) + Number(match.groups.minor ?? 0) / 1000;
}

/**
 * Position in the changelog: 0 is newest, higher is older, Infinity is "older than anything we record".
 * Mirrors `changelogRank` in changelog.js, which cannot be imported here (see the module note above).
 * A version ahead of the newest entry ranks -1 so an unreleased draft never reads as stale.
 */
export function rankVersion(version, changelog) {
  const index = changelog.findIndex((entry) => entry.version === version);
  if (index !== -1) {
    return index;
  }
  const parsed = parseVersion(version);
  const newest = parseVersion(changelog[0]?.version);
  if (parsed !== null && newest !== null && parsed > newest) {
    return -1;
  }
  return Number.POSITIVE_INFINITY;
}

/** True when `version` is strictly newer than `other`. */
function isNewer(version, other, changelog) {
  return rankVersion(version, changelog) < rankVersion(other, changelog);
}

/**
 * A stamp that IS a version, listed in the changelog or not. One below the floor ranks Infinity ("older than
 * everything"), so it still unions correctly — which is also what makes pruning old entries safe.
 */
function isVersionShaped(version) {
  return typeof version === "string" && parseVersion(version) !== null;
}

/**
 * The version a profile was rated under: its own stamp, else dated from `savedAt`.
 *
 * Both inputs belong to the PROFILE. An earlier design inferred from the theory seen-map, which records the
 * user's last visit — so a v3.1 rating by an active user read as 4.2 and cleared flags that should fire.
 */
export function resolveProfileStamp({ profile }) {
  const recorded = profile?.frameworkVersion;
  if (isVersionShaped(recorded)) {
    return { version: recorded, source: STAMP_SOURCE.recorded };
  }
  const inferred = versionLiveAt(profile?.savedAt);
  if (inferred) {
    return { version: inferred, source: STAMP_SOURCE.derived };
  }
  return { version: null, source: STAMP_SOURCE.unknown };
}

/**
 * A version and a question mark cannot coexist: holding any version determines the verdict, so `unverified`
 * means no version at all. A dated stamp is flagged on exactly like a recorded one.
 */
export function isFlaggable(stamp) {
  return stamp?.source === STAMP_SOURCE.recorded || stamp?.source === STAMP_SOURCE.derived;
}

/**
 * Levels of `pillar` that moved across every release newer than `stamp`. The UNION, not newest-wins:
 * collapsing per pillar would discard older hardenings (4.2 hardens L4, 4.3 hardens L1 → a 4.1 stamp at 4.5
 * must still flag).
 */
export function movedLevelsSince(pillar, stamp, changelog) {
  const raised = new Set();
  const eased = new Set();
  for (const entry of changelog) {
    // Newest-first, so the first entry at or below the stamp means every remaining one is older too.
    if (!isNewer(entry.version, stamp, changelog)) {
      break;
    }
    for (const level of entry.barRaised?.[pillar] ?? []) {
      raised.add(level);
    }
    for (const level of entry.barEased?.[pillar] ?? []) {
      eased.add(level);
    }
  }
  return { raised, eased };
}

/**
 * Whether a score sits in any moved level's band. Asymmetric, and anchored to the LEVEL not the score:
 * hardened n → [n, n+1] (levels are cumulative, so a 2.0 asserts L1); eased n → [n-1, n] (fell just short).
 * So 4.5 flags under a hardened L4 but not L5 — a floor/ceil shortcut gets that wrong.
 */
function inBand(score, levels, direction) {
  for (const level of levels) {
    const low = direction === "raised" ? level : level - 1;
    if (score >= low && score <= low + 1) {
      return true;
    }
  }
  return false;
}

/**
 * One pillar's verdict. A score of 0 is excluded from EASED flags only: 0 is deliberate (the default is 2)
 * and reads as "I don't do this", so an easier L1 does not help. Hardened bands never reach 0.
 */
export function resolvePillarState({ pillar, score, stamp, changelog }) {
  // Same gate as resolveProfileStamp: a version we display must also get a verdict.
  if (!isVersionShaped(stamp)) {
    return PILLAR_STATE.unverified;
  }
  const { raised, eased } = movedLevelsSince(pillar, stamp, changelog);
  const mayBeHigh = inBand(score, raised, "raised");
  const mayQualify = score > 0 && inBand(score, eased, "eased");
  if (mayBeHigh && mayQualify) {
    return PILLAR_STATE.mixed;
  }
  if (mayBeHigh) {
    return PILLAR_STATE.raised;
  }
  if (mayQualify) {
    return PILLAR_STATE.eased;
  }
  return PILLAR_STATE.clear;
}

/**
 * Whole-profile roll-up for the chip: preserve whether changed pillars are raised, eased, or both. The chip
 * can style all three as amber while the state still tells callers what kind of change occurred.
 */
export function resolveProfileState({ pillarLevels, stamp, changelog }) {
  if (!isVersionShaped(stamp)) {
    return PILLAR_STATE.unverified;
  }
  let hasRaised = false;
  let hasEased = false;
  for (const [pillar, score] of Object.entries(pillarLevels ?? {})) {
    const state = resolvePillarState({ pillar, score, stamp, changelog });
    if (state === PILLAR_STATE.raised || state === PILLAR_STATE.mixed) {
      hasRaised = true;
    }
    if (state === PILLAR_STATE.eased || state === PILLAR_STATE.mixed) {
      hasEased = true;
    }
  }
  if (hasRaised && hasEased) {
    return PILLAR_STATE.mixed;
  }
  if (hasRaised) {
    return PILLAR_STATE.raised;
  }
  if (hasEased) {
    return PILLAR_STATE.eased;
  }
  return PILLAR_STATE.clear;
}
