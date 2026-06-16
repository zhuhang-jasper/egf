import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/utils";

/** Keep the tooltip at least this far from the viewport edges. */
const VIEWPORT_PAD_PX = 8;

/**
 * Styled hover/focus tooltip. Render inside a `group relative` element; it fades in on
 * `group-hover`/`group-focus-visible`. Used instead of the native `title` attribute so it appears
 * immediately (no browser delay) and matches the app's styling.
 *
 * It is centered above its parent, then clamped horizontally so it never spills past the window
 * edge (recomputed each time it is shown, so it stays correct across resizes / tab switches).
 *
 * Defaults to a single short line; pass `className` (e.g. `whitespace-normal w-[...]`) for longer
 * wrapping text.
 */
export function Tooltip({ text, className }) {
  const ref = useRef(null);
  const [shiftX, setShiftX] = useState(0);

  const clampToViewport = useCallback(() => {
    const tip = ref.current;
    const parent = tip?.parentElement;
    if (!tip || !parent) {
      return;
    }
    const pr = parent.getBoundingClientRect();
    const centerX = pr.left + pr.width / 2;
    const half = tip.offsetWidth / 2;
    const leftEdge = centerX - half;
    const rightEdge = centerX + half;
    // clientWidth excludes the vertical scrollbar, so the right edge isn't overestimated.
    const viewportRight = document.documentElement.clientWidth - VIEWPORT_PAD_PX;
    let shift = 0;
    if (leftEdge < VIEWPORT_PAD_PX) {
      shift = VIEWPORT_PAD_PX - leftEdge;
    } else if (rightEdge > viewportRight) {
      shift = viewportRight - rightEdge;
    }
    setShiftX(Math.round(shift));
  }, []);

  // Recompute whenever the tooltip is (re)shown so the clamp reflects the current window size.
  useEffect(() => {
    const tip = ref.current;
    const parent = tip?.parentElement;
    if (!parent) {
      return undefined;
    }
    parent.addEventListener("mouseenter", clampToViewport);
    parent.addEventListener("focusin", clampToViewport);
    window.addEventListener("resize", clampToViewport);
    return () => {
      parent.removeEventListener("mouseenter", clampToViewport);
      parent.removeEventListener("focusin", clampToViewport);
      window.removeEventListener("resize", clampToViewport);
    };
  }, [clampToViewport]);

  if (!text) {
    return null;
  }
  return (
    <span
      ref={ref}
      role="tooltip"
      style={{ transform: `translateX(calc(-50% + ${shiftX}px))` }}
      className={cn(
        "pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[11px] font-medium leading-none text-white opacity-0 transition-opacity duration-100 group-hover:opacity-100 group-focus-visible:opacity-100",
        className,
      )}
    >
      {text}
    </span>
  );
}
