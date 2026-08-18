import { useEffect, useLayoutEffect, useState } from "react";

import { getPopoverViewportBounds } from "@/utils/scroll";

// Gap between trigger and panel, plus the margin that keeps the panel off the viewport edge.
const GAP_PX = 4;
const MARGIN_PX = 8;

/**
 * Shared dropdown behaviour: outside-click and Escape close, plus the flip decision measured against the band
 * between the sticky header and fixed bottom nav (see getPopoverViewportBounds).
 *
 * Returns `openUp` for the panel's `top-`/`bottom-` class, and the raw `spaceAbove`/`spaceBelow` for a caller
 * that needs to cap its own height (ProfileCombobox's row-peek maths).
 *
 * `remeasureKey` re-runs the measurement when something changes the panel's height while open — the save menu's
 * undo item appearing, for instance.
 *
 * `onClose` is deliberately NOT a dependency, so an inline arrow doesn't re-bind the listeners every render. It
 * must therefore not close over state: `() => setOpen(false)` is fine, since the setter is stable.
 */
export function useMenuPosition({ open, onClose, rootRef, menuRef, remeasureKey }) {
  const [position, setPosition] = useState({ openUp: false, spaceAbove: 0, spaceBelow: 0 });

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    const onKey = (e) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    const onMouse = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onMouse);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onMouse);
    };
    // `onClose` is called, not tracked: an inline arrow would re-bind these listeners every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, rootRef]);

  useLayoutEffect(() => {
    if (!open) {
      setPosition({ openUp: false, spaceAbove: 0, spaceBelow: 0 });
      return undefined;
    }
    const decide = () => {
      const root = rootRef.current;
      const menu = menuRef.current;
      if (!root || !menu) {
        return;
      }
      const rootRect = root.getBoundingClientRect();
      const { top: topBoundary, bottom: bottomBoundary } = getPopoverViewportBounds();
      const spaceBelow = bottomBoundary - rootRect.bottom - GAP_PX - MARGIN_PX;
      const spaceAbove = rootRect.top - topBoundary - GAP_PX - MARGIN_PX;
      // `offsetHeight`, not `scrollHeight`: a capped panel scrolls, and its natural height would flip menus that
      // fit fine once bounded. The two agree for the fixed-row menus, which is why the drift went unnoticed.
      const needed = menu.offsetHeight;
      setPosition({ openUp: needed > spaceBelow && spaceAbove > spaceBelow, spaceAbove, spaceBelow });
    };
    decide();
    window.addEventListener("resize", decide);
    return () => window.removeEventListener("resize", decide);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, rootRef, menuRef, remeasureKey]);

  return position;
}
