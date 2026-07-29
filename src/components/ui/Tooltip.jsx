import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { cn } from "@/utils";

/** Keep the tooltip at least this far from its bounding box's edges. */
const EDGE_PAD_PX = 8;

/**
 * Styled hover/focus tooltip. Render inside a `group relative` element; it fades in on
 * `group-hover`/`group-focus-visible`. Used instead of the native `title` attribute so it appears
 * immediately (no browser delay) and matches the app's styling.
 *
 * It is centered above its parent, then clamped horizontally so it never spills past the tab's page
 * (the nearest `<main>` element — its max width plus padding), falling back to the viewport when no
 * `<main>` ancestor exists. Recomputed each time it is shown so it stays correct across resizes /
 * tab switches (the active tab's page width differs).
 *
 * Defaults to a single short line; pass `className` (e.g. `whitespace-normal w-[...]`) for longer
 * wrapping text.
 */
export function Tooltip({ text, className, visible = false, placement = "top" }) {
  const ref = useRef(null);
  const [shiftX, setShiftX] = useState(0);

  const clampToPage = useCallback(() => {
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
    // Bound to the tab's page (main's box, padding included) rather than the full viewport.
    // getBoundingClientRect is border-box, so its left/right already include main's padding.
    const main = tip.closest("main");
    const mr = main?.getBoundingClientRect();
    // clientWidth excludes the vertical scrollbar, so the viewport right isn't overestimated.
    const boundsLeft = (mr ? mr.left : 0) + EDGE_PAD_PX;
    const boundsRight = (mr ? mr.right : document.documentElement.clientWidth) - EDGE_PAD_PX;
    let shift = 0;
    if (leftEdge < boundsLeft) {
      shift = boundsLeft - leftEdge;
    } else if (rightEdge > boundsRight) {
      shift = boundsRight - rightEdge;
    }
    setShiftX(Math.round(shift));
  }, []);

  // CLAMPED BEFORE FIRST PAINT, not only on hover — and that is the point of the layout effect.
  //
  // `shiftX` starts at 0, so an unclamped tooltip is centred on its trigger. For a trigger near the
  // right edge (the chart's settings gear, the profile actions menu) half of it hangs past `main`,
  // and since it is `absolute` inside a box nothing clips, the DOCUMENT grows to contain it — a
  // permanent horizontal scrollbar on `body` (which is `overflow-x: auto` on purpose; see index.css).
  //
  // Hover was never going to fix that: the overhang exists while nobody is pointing at anything, so
  // the one event that recomputed the clamp is the one event that had not happened. `useLayoutEffect`
  // runs after layout and before the browser paints, so the tooltip is already shifted on the frame
  // it first appears — the scrollbar never flashes rather than merely going away on mouseenter.
  useLayoutEffect(clampToPage, [clampToPage, text, className, placement]);

  // Recompute whenever the tooltip is (re)shown so the clamp reflects the current page width.
  //
  // Still needed on top of the initial pass: `main`'s width changes with the active tab (Theory's
  // measure is wider), and a trigger can move without this component re-rendering — the header's
  // collapse animation and the chart's fit passes both shift things underneath it.
  useEffect(() => {
    const tip = ref.current;
    const parent = tip?.parentElement;
    if (!parent) {
      return undefined;
    }
    parent.addEventListener("mouseenter", clampToPage);
    parent.addEventListener("focusin", clampToPage);
    window.addEventListener("resize", clampToPage);
    // Catches the moves no event reports: the trigger being laid out at a different x after the
    // chart's converge loop settles, or its own width changing (e.g. "Copy link" → "Copied").
    const observer = new ResizeObserver(clampToPage);
    observer.observe(parent);
    observer.observe(tip);
    return () => {
      parent.removeEventListener("mouseenter", clampToPage);
      parent.removeEventListener("focusin", clampToPage);
      window.removeEventListener("resize", clampToPage);
      observer.disconnect();
    };
  }, [clampToPage]);

  if (!text) {
    return null;
  }
  return (
    <span
      ref={ref}
      role="tooltip"
      style={{ transform: `translateX(calc(-50% + ${shiftX}px))` }}
      className={cn(
        "pointer-events-none absolute left-1/2 z-10 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[11px] font-medium leading-none text-white opacity-0 transition-opacity duration-100 group-hover:opacity-100 group-focus-visible:opacity-100",
        placement === "bottom" ? "top-full mt-1.5" : "bottom-full mb-1.5",
        visible && "opacity-100",
        className,
      )}
    >
      {text}
    </span>
  );
}
