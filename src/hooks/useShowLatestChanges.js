import { useCallback, useState } from "react";

import { THEORY_SHOW_CHANGES_KEY } from "@/constants";

/**
 * Theory tab preference: whether the v3.1 "latest changes" highlighter is shown. Defaults ON.
 * Persisted under its own localStorage key (see {@link THEORY_SHOW_CHANGES_KEY}) — a standalone
 * display toggle, deliberately kept out of the tool-tab draft store. Reads/writes are guarded so a
 * disabled or full localStorage degrades to session-only state instead of throwing.
 */
export function useShowLatestChanges() {
  const [show, setShow] = useState(() => {
    try {
      // Default ON: only an explicit "false" hides the highlights.
      return localStorage.getItem(THEORY_SHOW_CHANGES_KEY) !== "false";
    } catch {
      return true;
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
