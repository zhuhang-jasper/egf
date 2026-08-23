import { useMemo } from "react";

import { CHANGELOG } from "@/constants/changelog";
import { isFlaggable, PILLAR_STATE, resolvePillarState, resolveProfileStamp, resolveProfileState } from "@/utils/profile-stamp";

/**
 * Binds the pure resolver to the app's real CHANGELOG. The one place that supplies it, so every surface
 * resolves through identical inputs.
 */
function resolveState(stamp, resolve) {
  return isFlaggable(stamp) ? resolve(stamp.version) : PILLAR_STATE.unverified;
}

/** Whole-profile roll-up for one saved row: amber iff anything it scored was raised. */
export function useProfileStampState(profile) {
  return useMemo(() => {
    const stamp = resolveProfileStamp({ profile });
    const state = resolveState(stamp, (version) =>
      resolveProfileState({ pillarLevels: profile?.pillarLevels, stamp: version, changelog: CHANGELOG }),
    );
    return { ...stamp, state };
  }, [profile]);
}

/**
 * Per-pillar states for the loaded draft. The active profile's stamp with the draft's LIVE levels, so a
 * flag follows the number on screen rather than the saved one. No active profile → nothing to compare.
 */
export function usePillarStampStates(activeProfile, pillarLevels) {
  return useMemo(() => {
    if (!activeProfile) {
      return {};
    }
    const stamp = resolveProfileStamp({ profile: activeProfile });
    const out = {};
    for (const [pillar, score] of Object.entries(pillarLevels ?? {})) {
      out[pillar] = resolveState(stamp, (version) => resolvePillarState({ pillar, score, stamp: version, changelog: CHANGELOG }));
    }
    return out;
  }, [activeProfile, pillarLevels]);
}
