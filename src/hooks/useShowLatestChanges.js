import { useCallback, useState } from "react";

import { PROFILES_STORAGE_KEY, STORAGE_KEY, THEORY_SHOW_CHANGES_KEY } from "@/constants";

/**
 * Theory tab preference: whether the "What's New" highlighter is shown.
 *
 * Smart default when the user hasn't set the toggle yet: a *returning* user (any tool-tab data in
 * localStorage — a saved draft or saved profiles) benefits from seeing what changed since their last
 * visit, so default ON. A *new* user has no baseline to diff against, so the highlights are just
 * noise — default OFF. The inferred default is written back on first load, so it hardens into a
 * concrete stored choice: the heuristic runs exactly once per browser, and later visits (and any
 * mid-session tool-tab activity) can't flip it. Flipping the toggle overwrites it as usual.
 *
 * Persisted under its own key ({@link THEORY_SHOW_CHANGES_KEY}) — a standalone display toggle, kept
 * out of the tool-tab draft store. Reads/writes are guarded so a disabled or full localStorage
 * degrades to session-only state instead of throwing.
 */
export function useShowLatestChanges() {
  const [show, setShow] = useState(() => {
    try {
      const stored = localStorage.getItem(THEORY_SHOW_CHANGES_KEY);
      if (stored !== null) {
        // Explicit (or already-hardened) choice wins.
        return stored === "true";
      }
      // First load with no choice yet — infer from whether this looks like a returning user, then
      // persist it so the heuristic never re-runs (no mid-session flip when the tool tab writes data).
      const isReturning = localStorage.getItem(STORAGE_KEY) !== null || localStorage.getItem(PROFILES_STORAGE_KEY) !== null;
      localStorage.setItem(THEORY_SHOW_CHANGES_KEY, isReturning ? "true" : "false");
      return isReturning;
    } catch {
      return false;
    }
  });

  const toggle = useCallback(() => {
    setShow((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(THEORY_SHOW_CHANGES_KEY, next ? "true" : "false");
      } catch {
        // localStorage unavailable (private mode / quota) — keep the session-only value.
      }
      return next;
    });
  }, []);

  return [show, toggle];
}
