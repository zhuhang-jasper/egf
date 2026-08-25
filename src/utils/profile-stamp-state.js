import { CHANGELOG } from "@/constants/changelog";
import { isFlaggable, PILLAR_STATE, resolveProfileStamp, resolveProfileState } from "@/utils/profile-stamp";

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
