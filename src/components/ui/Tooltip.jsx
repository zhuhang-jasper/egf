import { useEffect, useRef, useState } from "react";

import { autoUpdate, flip, offset, shift, useFloating } from "@floating-ui/react-dom";

import { TOOLTIP_LAYER } from "@/constants";
import { cn } from "@/utils";

/** Keep the tooltip at least this far from the viewport's edges. */
const EDGE_PAD_PX = 8;
/** Gap between the tooltip and its trigger. */
const GAP_PX = 6;

/**
 * Treats the sticky header as the top of the screen, since the tooltip wins on z-index and would otherwise
 * paint across the brand lockup. Expressed as collision PADDING rather than a `boundary`, which constrains
 * only the clipping rect and still allows the overlap. Falls back to 0 on the app-shell-less routes.
 */
function getHeaderInsetPx() {
  const header = document.getElementById("app-shell-header-stack");
  if (header) {
    return header.getBoundingClientRect().bottom;
  }
  const fallback = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--app-sticky-offset"));
  return Number.isFinite(fallback) ? fallback : 0;
}

/** Collision padding with the sticky header's bottom edge standing in for the top of the screen. */
function headerAwarePadding() {
  return { top: getHeaderInsetPx() + EDGE_PAD_PX, right: EDGE_PAD_PX, bottom: EDGE_PAD_PX, left: EDGE_PAD_PX };
}

/**
 * Styled hover/focus tooltip. Render inside a `group relative` element; it fades in on
 * `group-hover`/`group-focus-visible`. Used instead of the native `title` attribute so it appears immediately
 * (no browser delay) and matches the app's styling.
 *
 * Positioned by Floating UI, which picks side and alignment from the space available, so there is no
 * per-call-site `align` to remember.
 *
 * `strategy: "fixed"` KEEPS IT OUT OF THE DOCUMENT'S SCROLL EXTENT. An `absolute` tooltip that overhangs its
 * container raises a scrollbar even while invisible, which makes the fixed bottom nav jump. See
 * docs/DECISIONS.md#tab-switch-scrollbar-jump.
 *
 * Defaults to a single short line; pass `className` (e.g. `whitespace-normal w-[...]`) for longer wrapping text.
 */
export function Tooltip({ text, className, visible = false, placement = "top" }) {
  const anchorRef = useRef(null);

  // The trigger is this component's PARENT (the `group relative` element), not a child it renders — that is the
  // existing contract at all seven call sites, so the reference element is resolved from the DOM after mount
  // rather than by wrapping anything.
  const [anchor, setAnchor] = useState(null);
  useEffect(() => {
    setAnchor(anchorRef.current?.parentElement ?? null);
  }, []);

  const { refs, floatingStyles, update } = useFloating({
    elements: { reference: anchor },
    // `fixed` so the tooltip never contributes to document overflow — see the note above.
    strategy: "fixed",
    placement: placement === "bottom" ? "bottom" : "top",
    middleware: [
      offset(GAP_PX),
      // The OPTIONS OBJECT is the derivable, not `padding` itself: Floating UI types `padding` as
      // `number | SideObject`, and only the whole options argument accepts a function. That is what re-reads
      // the header's edge on each update rather than capturing it once.
      //
      // `fallbackStrategy: "bestFit"` overrides the default `"initialPlacement"`, which returns to the
      // preferred side when no side fits and so overlaps the header again.
      flip(() => ({ padding: headerAwarePadding(), fallbackStrategy: "bestFit" })),
      // Defaults are correct here and should be left alone: Floating UI's `mainAxis` is the axis along the
      // floating element's ALIGNMENT (horizontal for a top/bottom tooltip) and is already `true`, while
      // `crossAxis` runs along its side and is already `false`. Setting `mainAxis: false` disables the sideways
      // shift, the opposite of what the name suggests.
      shift(() => ({ padding: headerAwarePadding() })),
    ],
    whileElementsMounted: autoUpdate,
  });

  // Re-measure when the trigger is actually pointed at. `autoUpdate` cannot catch the panel un-hiding on a tab
  // switch: its scroll listeners are bound to the overflow ancestors captured at setup (nothing scrolls, so
  // nothing fires), and its IntersectionObserver is never installed at all, because the trigger measured 0x0
  // while the panel was `hidden` and observeMove bails on a zero-sized reference. The placement left over from
  // that state points `top`, into the sticky header. Hover is the one signal that always precedes the tooltip
  // being seen, so it is what re-runs `flip()` against the trigger's real rect.
  useEffect(() => {
    if (!anchor) {
      return undefined;
    }
    anchor.addEventListener("pointerenter", update);
    anchor.addEventListener("focusin", update);
    return () => {
      anchor.removeEventListener("pointerenter", update);
      anchor.removeEventListener("focusin", update);
    };
  }, [anchor, update]);

  if (!text) {
    return null;
  }
  return (
    // A zero-size marker whose only job is to find the trigger (its parent) for the anchor lookup above. It
    // cannot itself be the positioned box: that is `fixed`, so it must not sit in the trigger's flow.
    <span ref={anchorRef} className="contents">
      <span
        ref={refs.setFloating}
        role="tooltip"
        style={floatingStyles}
        className={cn(
          // `w-max` because a fixed-position box shrink-wraps to its containing block otherwise; with
          // `whitespace-nowrap` this is the natural single-line width. `max-w-[calc(100vw-1rem)]` keeps a long
          // string inside the viewport, which is also what lets `shift()` place it sensibly.
          "pointer-events-none w-max max-w-[calc(100vw-1rem)] rounded-md bg-slate-900 px-2 py-1 text-[11px] font-medium leading-none whitespace-nowrap text-white opacity-0 transition-opacity duration-100 group-hover:opacity-100 group-focus-visible:opacity-100",
          TOOLTIP_LAYER,
          visible && "opacity-100",
          className,
        )}
      >
        {text}
      </span>
    </span>
  );
}
