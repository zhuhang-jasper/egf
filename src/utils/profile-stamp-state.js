import { CHANGELOG } from "@/constants/changelog";
import { isFlaggable, PILLAR_STATE, resolvePillarState, resolveProfileStamp, resolveProfileState } from "@/utils/profile-stamp";

/**
 * A profile's whole-profile stamp verdict, bound to the app's real CHANGELOG. Plain function, not a hook, so
 * the store can call it too — useProfileStamp.js memoizes it for the render path.
 */
export function profileStampState(profile) {
  const stamp = resolveProfileStamp({ profile });
  const state = isFlaggable(stamp)
    ? resolveProfileState({ pillarLevels: profile?.pillarLevels, stamp: stamp.version, changelog: CHANGELOG })
    : PILLAR_STATE.unverified;
  return { ...stamp, state };
}

/**
 * Whether something a profile scored moved since it was rated. `unverified` is NOT stale — without a version
 * we cannot say anything moved.
 */
export function isStaleProfile(profile) {
  const { state } = profileStampState(profile);
  return state === PILLAR_STATE.raised || state === PILLAR_STATE.eased || state === PILLAR_STATE.mixed;
}

/**
 * Pillars flagged on `profile` whose score `pillarLevels` leaves alone — the warnings an action would clear
 * without the user having looked at them. The stamp is one field, so anything advancing it silences all of
 * them at once, and this is the count worth confirming first.
 *
 * `requireLevelChange` (the save path) returns 0 when NO level moved: such a save carries the old stamp
 * forward, so its warnings survive and there is nothing to confirm. The restamp button passes false — it
 * advances the stamp on its own.
 */
export function untouchedFlaggedPillars(profile, pillarLevels, { requireLevelChange = false } = {}) {
  const stamp = resolveProfileStamp({ profile });
  if (!isFlaggable(stamp)) {
    return 0;
  }
  const stored = profile?.pillarLevels ?? {};
  let changedAny = false;
  let count = 0;
  for (const [pillar, score] of Object.entries(stored)) {
    if (pillarLevels?.[pillar] !== score) {
      changedAny = true; // the user edited this one, so its flag was addressed
      continue;
    }
    const state = resolvePillarState({ pillar, score, stamp: stamp.version, changelog: CHANGELOG });
    if (state === PILLAR_STATE.raised || state === PILLAR_STATE.eased || state === PILLAR_STATE.mixed) {
      count += 1;
    }
  }
  return requireLevelChange && !changedAny ? 0 : count;
}
