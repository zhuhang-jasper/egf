import { useCallback, useState } from "react";

import { FRAMEWORK_VERSION, THEORY_SEEN_VERSION_KEY } from "@/constants";
import { isReturningUser } from "@/utils/storage";

/**
 * Drives the "unseen framework updates" dot on the Theory tab. A returning user (see
 * {@link isReturningUser}) who hasn't marked the current {@link FRAMEWORK_VERSION} as seen gets the
 * dot. It is dismissed by calling {@link markSeen} — wired to the user turning the "What's New"
 * highlighter OFF, i.e. their explicit "I've seen it" signal, NOT merely opening the tab. Toggling
 * the highlighter back ON does not un-mark the version, so the dot stays gone until the next bump.
 *
 * Storing the *version* (not a boolean) is what makes this self-service across releases: bumping
 * FRAMEWORK_VERSION makes every stored value stale at once, so the dot returns for everyone with no
 * migration. First-time users never see it — they have no baseline to diff against.
 */
export function useUnseenFramework() {
  const [unseen, setUnseen] = useState(() => {
    if (!isReturningUser()) {
      return false;
    }
    try {
      return localStorage.getItem(THEORY_SEEN_VERSION_KEY) !== FRAMEWORK_VERSION;
    } catch {
      return false;
    }
  });

  const markSeen = useCallback(() => {
    // Idempotent — safe to call on every Theory open. Bail early once already seen so we don't
    // thrash localStorage or trigger a no-op re-render.
    setUnseen((wasUnseen) => {
      if (!wasUnseen) {
        return false;
      }
      try {
        localStorage.setItem(THEORY_SEEN_VERSION_KEY, FRAMEWORK_VERSION);
      } catch {
        // localStorage unavailable — clear it for the session anyway.
      }
      return false;
    });
  }, []);

  return [unseen, markSeen];
}
