import { useMemo } from "react";

import { CHANGELOG } from "@/constants/changelog";
import { isFlaggable, PILLAR_STATE, resolvePillarState, resolveProfileStamp, STAMP_SOURCE } from "@/utils/profile-stamp";
import { profileStampState } from "@/utils/profile-stamp-state";

/** Binds the pure per-pillar resolver to the app's real CHANGELOG (profile-stamp-state.js does the roll-up). */
function resolveState(stamp, resolve) {
  return isFlaggable(stamp) ? resolve(stamp.version) : PILLAR_STATE.unverified;
}

/** Whole-profile roll-up for one saved row: amber iff anything it scored was raised. */
export function useProfileStampState(profile) {
  // Memoizes the same helper the store's analytics uses, so the chip and the events cannot disagree.
  return useMemo(() => profileStampState(profile), [profile]);
}

/**
 * Per-pillar states for the loaded draft. The active profile's stamp with the draft's LIVE levels, so a
 * flag follows the number on screen rather than the saved one. No active profile → nothing to compare.
 */
export function usePillarStampStates(activeProfile, pillarLevels, inheritedVersion = null) {
  return useMemo(() => {
    // An unsaved clone has no active profile but did inherit a stamp (see duplicateDraft), so its flags show
    // before the first save rather than appearing only once it lands.
    const stamp = activeProfile ? resolveProfileStamp({ profile: activeProfile }) : inheritedStamp(inheritedVersion);
    if (!isFlaggable(stamp)) {
      return {};
    }
    const stored = activeProfile?.pillarLevels ?? null;
    const out = {};
    for (const [pillar, score] of Object.entries(pillarLevels ?? {})) {
      // WHETHER a pillar is flagged is decided by the SAVED score, not the live one. Resolving the live value
      // meant nudging a score out of the moved band cleared the flag outright — the user dodged the bar
      // rather than reviewing it, and the row went silent as if nothing had changed under it.
      const basis = stored?.[pillar] ?? score;
      const state = resolveState(stamp, (version) => resolvePillarState({ pillar, score: basis, stamp: version, changelog: CHANGELOG }));
      // The LIVE value only decides whether that flag reads as handled. Put the number back and the amber
      // returns, because `state` above never depended on the edit.
      const edited = stored != null && stored[pillar] !== score;
      out[pillar] = edited && state !== PILLAR_STATE.clear ? PILLAR_STATE.reviewed : state;
    }
    return out;
  }, [activeProfile, pillarLevels, inheritedVersion]);
}

/** A stamp shaped like the resolver's, for a version carried on the draft rather than read off a row. */
function inheritedStamp(version) {
  return version ? { version, source: STAMP_SOURCE.recorded } : { version: null, source: STAMP_SOURCE.unknown };
}
