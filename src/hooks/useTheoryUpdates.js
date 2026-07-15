import { useEffect, useState } from "react";

import { FRAMEWORK_VERSION, THEORY_SEEN_VERSION_KEY } from "@/constants";

/**
 * Drives the Theory tab's version-bump indicator (the unseen-updates dot). One stored value
 * ({@link THEORY_SEEN_VERSION_KEY}, the framework version the user last opened Theory at) is all
 * this tracks — the "What's New" highlighter toggle has been removed, so there is nothing else to
 * keep in sync.
 *
 * The dot shows for a returning user whose stored seen-version is older than the current
 * {@link FRAMEWORK_VERSION}. Opening the Theory tab is what dismisses it: on open we stamp
 * seen = current, so the dot clears immediately and stays cleared until the next version bump. A
 * fresh user (no stored version) never sees the dot — their first open just records the baseline.
 *
 * @param {boolean} theoryActive Whether the Theory tab is currently open — opening it stamps the
 *   current version as seen and dismisses the dot. Pass the live tab-active flag from the page.
 */
export function useTheoryUpdates(theoryActive) {
  // The framework version the user last opened Theory at. null = fresh user (never recorded).
  const [seenVersion, setSeenVersion] = useState(readSeenVersion);

  // A returning user whose recorded version is older than current has an unseen bump. A fresh user
  // (null) has no baseline, so no dot.
  const hasUnseenUpdates = seenVersion != null && seenVersion !== FRAMEWORK_VERSION;

  // Opening the Theory tab is the dismiss signal: stamp seen = current so the dot clears and stays
  // cleared until the next version bump. Also covers the fresh-user first-open baseline stamp.
  useEffect(() => {
    if (theoryActive && seenVersion !== FRAMEWORK_VERSION) {
      writeSeenVersion(FRAMEWORK_VERSION);
      setSeenVersion(FRAMEWORK_VERSION);
    }
  }, [theoryActive, seenVersion]);

  return { hasUnseenUpdates };
}

function readSeenVersion() {
  try {
    return localStorage.getItem(THEORY_SEEN_VERSION_KEY);
  } catch {
    return null;
  }
}

function writeSeenVersion(version) {
  try {
    localStorage.setItem(THEORY_SEEN_VERSION_KEY, version);
  } catch {
    // localStorage unavailable — keep the session-only value.
  }
}
