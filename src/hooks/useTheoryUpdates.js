import { useCallback, useEffect, useState } from "react";

import { FRAMEWORK_VERSION, THEORY_SEEN_VERSION_KEY, THEORY_SHOW_CHANGES_KEY } from "@/constants";

/**
 * Single source of truth for the Theory tab's "What's New" affordances — the unseen-updates dot and
 * the highlighter toggle. Both derive from ONE stored value ({@link THEORY_SEEN_VERSION_KEY}, the
 * framework version the user last caught up to) so they can never drift apart.
 *
 * Three states, keyed off the stored seen-version vs. the current {@link FRAMEWORK_VERSION}:
 *
 *   | stored seen-version | who                              | dot | toggle default              |
 *   | ------------------- | -------------------------------- | --- | --------------------------- |
 *   | absent              | fresh user (never opened Theory) | off | off (no baseline to diff)   |
 *   | < current           | returning user on older material | ON  | ON (surface what changed)   |
 *   | == current          | caught up / dismissed            | off | honor their explicit choice |
 *
 * Transitions:
 *   - Fresh user's FIRST Theory open silently stamps seen = current → they move to the "== current"
 *     row (dot off, default off). They only ever see a dot after a FUTURE version bump, never for
 *     material they had no prior baseline for.
 *   - Turning the highlighter OFF is the explicit "I've read it" signal: it stamps seen = current
 *     (dismissing the dot for good on this version). Turning it back ON does not un-stamp.
 *
 * @param {boolean} theoryActive Whether the Theory tab is currently open — drives the fresh-user
 *   first-open stamp. Pass the live tab-active flag from the page.
 */
export function useTheoryUpdates(theoryActive) {
  // The framework version the user last caught up to. null = fresh user (never recorded).
  const [seenVersion, setSeenVersion] = useState(readSeenVersion);

  // Fresh users are "behind" only in the sense of having no baseline — they get no dot and default
  // OFF. A returning user whose recorded version is older than current is genuinely behind.
  const isFresh = seenVersion == null;
  const hasUnseenUpdates = !isFresh && seenVersion !== FRAMEWORK_VERSION;

  // The user's explicit toggle choice for the *current* version, if any. Only consulted once caught
  // up (see below) — while behind, being-behind wins.
  const [choice, setChoice] = useState(() => {
    const stored = readShowChoice();
    return stored?.version === FRAMEWORK_VERSION ? stored.show : null;
  });

  // Derived every render (NOT a one-shot init) so a FRAMEWORK_VERSION bump takes effect immediately:
  //   - behind → force the highlighter ON so opening Theory shows what changed;
  //   - caught up / fresh → honor the explicit choice, else default OFF.
  const showLatestChanges = hasUnseenUpdates ? true : (choice ?? false);

  // Fresh user's first Theory open: silently record that they've now seen the current version, so a
  // dot only ever appears after a LATER bump (never retroactively for content they had no baseline
  // for). Does not force the highlighter on — a fresh user has nothing to diff.
  useEffect(() => {
    if (theoryActive && seenVersion == null) {
      writeSeenVersion(FRAMEWORK_VERSION);
      setSeenVersion(FRAMEWORK_VERSION);
    }
  }, [theoryActive, seenVersion]);

  const toggleLatestChanges = useCallback(() => {
    // Toggle relative to what's shown now: while behind, the derived value is ON, so the first tap
    // means OFF. Persist the explicit choice for this version.
    const next = !showLatestChanges;
    writeShowChoice(next);
    setChoice(next);
    // Turning it OFF is the "I've read it" signal — mark this version caught up so the dot clears and
    // stays cleared until the next bump. Turning it back ON never un-marks.
    if (!next) {
      writeSeenVersion(FRAMEWORK_VERSION);
      setSeenVersion(FRAMEWORK_VERSION);
    }
  }, [showLatestChanges]);

  return { hasUnseenUpdates, showLatestChanges, toggleLatestChanges };
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

function readShowChoice() {
  try {
    const raw = localStorage.getItem(THEORY_SHOW_CHANGES_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.show === "boolean" && typeof parsed.version === "string") {
      return parsed;
    }
  } catch {
    // Missing / malformed / localStorage unavailable — treat as no stored choice.
  }
  return null;
}

function writeShowChoice(show) {
  try {
    localStorage.setItem(THEORY_SHOW_CHANGES_KEY, JSON.stringify({ show, version: FRAMEWORK_VERSION }));
  } catch {
    // localStorage unavailable (private mode / quota) — keep the session-only value.
  }
}
