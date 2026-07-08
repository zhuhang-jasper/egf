import { useCallback, useState } from "react";

import { FRAMEWORK_VERSION, THEORY_SHOW_CHANGES_KEY } from "@/constants";
import { isReturningUser } from "@/utils/storage";

// Preference is stored WITH the framework version it was made for: `{ show, version }`. A choice is
// only honored while its version matches the current FRAMEWORK_VERSION — a version bump makes an old
// choice stale, so the default is re-derived (see below). This is what keeps the toggle in step with
// the Theory-tab "unseen updates" dot: when the dot reappears on a new version, the highlighter is
// forced back ON so opening Theory actually shows what changed, even for someone who'd turned it off.
function readStored() {
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

function writeStored(show) {
  try {
    localStorage.setItem(THEORY_SHOW_CHANGES_KEY, JSON.stringify({ show, version: FRAMEWORK_VERSION }));
  } catch {
    // localStorage unavailable (private mode / quota) — keep the session-only value.
  }
}

/**
 * Theory tab preference: whether the "What's New" highlighter is shown.
 *
 * Two things drive the default when there's no *current-version* choice on record:
 *   1. Returning vs. new — a returning user (any tool-tab data in localStorage) benefits from seeing
 *      what changed, so default ON; a new user has no baseline, so default OFF (highlights = noise).
 *   2. Version freshness — a stored choice is only honored while its `version` matches the current
 *      {@link FRAMEWORK_VERSION}. On a version bump the old choice goes stale and the default is
 *      re-derived, so a returning user who'd turned the highlighter OFF is forced back ON once for
 *      the new material (matching the "unseen updates" dot). Their next OFF sticks until the *next*
 *      bump.
 *
 * The resolved default is written back immediately (stamped with the current version) so the
 * heuristic runs at most once per version per browser — no mid-session flips when the tool tab
 * writes data, and no re-deriving on every load.
 *
 * Persisted under its own key ({@link THEORY_SHOW_CHANGES_KEY}) — a standalone display toggle, kept
 * out of the tool-tab draft store. Reads/writes are guarded against a disabled/throwing localStorage.
 */
export function useShowLatestChanges() {
  const [show, setShow] = useState(() => {
    const stored = readStored();
    if (stored && stored.version === FRAMEWORK_VERSION) {
      // A choice made for the current version wins (explicit toggle, or an earlier hardened default).
      return stored.show;
    }
    // No choice yet, or one made for an older version (now stale) — re-derive and harden. Returning
    // users default ON (and are re-enabled on a version bump); new users default OFF.
    const next = isReturningUser();
    writeStored(next);
    return next;
  });

  const toggle = useCallback(() => {
    setShow((prev) => {
      const next = !prev;
      writeStored(next);
      return next;
    });
  }, []);

  return [show, toggle];
}
