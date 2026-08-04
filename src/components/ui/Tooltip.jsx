import { useEffect, useRef, useState } from "react";

import { autoUpdate, flip, offset, shift, useFloating } from "@floating-ui/react-dom";

import { cn } from "@/utils";

/** Keep the tooltip at least this far from the viewport's edges. */
const EDGE_PAD_PX = 8;
/** Gap between the tooltip and its trigger. */
const GAP_PX = 6;

/**
 * THE STICKY HEADER IS TREATED AS THE TOP OF THE SCREEN, not something to be drawn over. A tooltip on a trigger
 * near the top of the page would otherwise open upward and land on top of the header — it wins on `z-index`
 * (`z-50` vs the header's `z-40`), so it painted over the brand lockup and read as a floating box detached from
 * anything.
 *
 * Implemented as extra TOP PADDING for the collision detection rather than a `boundary` element: padding is what
 * both `flip()` and `shift()` already consume, so one number makes the tooltip flip below its trigger when there
 * is not room above the header, and stops `shift()` sliding it up into the header in the cases where it does not
 * flip. A `boundary` would only constrain the clipping rect and still allow the overlap.
 *
 * Measured from the header's own box rather than hardcoded, because its height is not a constant the tooltip can
 * know: it is `min-h-14` plus `p-3` and grows with its content. Falls back to the `--app-sticky-offset` custom
 * property the header publishes (see utils/scroll.js), then to 0 when there is no header on the page at all —
 * the Poster and Social routes render no app shell.
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
 * POSITIONED BY FLOATING UI, which is the same engine Radix and shadcn tooltips use. It picks the side and
 * alignment from the space actually available: `flip()` swaps top↔bottom when the preferred side would collide,
 * and `shift()` slides it along the cross axis so an edge-adjacent tooltip stays inside the viewport while
 * remaining as centred on its trigger as it can. A tooltip in the middle of the page is centred; one at the
 * right edge slides left just enough; one near the top flips below. No per-call-site `align` to remember.
 *
 * WHY A LIBRARY RATHER THAN THE HAND-ROLLED CLAMP THIS REPLACES. The previous version measured the trigger, its
 * own width and `closest("main")`, then corrected a centred position via a `shiftX` in state, recomputed from
 * `useLayoutEffect` + `mouseenter` + `focusin` + `resize` + two `ResizeObserver`s. Every bug it had was a stale
 * input to that arithmetic — most recently a one-frame horizontal scrollbar on tab switch (a `hidden`, zero-width
 * panel makes the clamp compute against a collapsed parent), which shrank the visual viewport and made the fixed
 * bottom nav jump 15px. Collision detection is a solved problem with real edge cases (scroll containers, clipping
 * ancestors, sub-pixel rounding); this hands it to code that handles them.
 *
 * `position: fixed` (Floating UI's `strategy: "fixed"`) IS WHAT KEEPS IT OUT OF THE DOCUMENT'S SCROLL EXTENT. An
 * `absolute` tooltip that overhangs its container grows the document and produces a scrollbar even while it is
 * invisible — the bug this component kept reintroducing. A fixed-position box is laid out against the viewport
 * and contributes nothing to `scrollWidth`, so an overhang is impossible by construction rather than corrected.
 *
 * `autoUpdate` TRACKS THE TRIGGER while the tooltip is mounted, so the chart's converge passes, the header's
 * collapse, a tab switch and a window resize are all handled without this component knowing they exist.
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

  const { refs, floatingStyles } = useFloating({
    elements: { reference: anchor },
    // `fixed` so the tooltip never contributes to document overflow — see the note above.
    strategy: "fixed",
    placement: placement === "bottom" ? "bottom" : "top",
    middleware: [
      offset(GAP_PX),
      // Try the other side when the preferred one has no room. The `top` padding is the sticky header's
      // bottom edge, so "no room above" means "would reach the header" rather than "would leave the viewport"
      // — a trigger under the header flips its tooltip downward instead of hiding behind it.
      //
      // THE OPTIONS OBJECT IS THE DERIVABLE, NOT `padding` ITSELF. Floating UI types `padding` as
      // `number | SideObject` — a function there is not a valid padding. What accepts a function is the whole
      // options argument (`FlipOptions | Derivable<FlipOptions>`), which is re-evaluated on every position
      // update. That is the form used here, and it is what makes the header's bottom edge re-read rather than
      // captured once: the header grows with its content, and is absent entirely on the Poster/Social routes.
      // `autoUpdate` below is what drives those updates.
      // `fallbackStrategy: "initialPlacement"` is the DEFAULT and is wrong here: when no side fits (a trigger
      // wedged right under the header, with the tooltip taller than the gap), it returns to the preferred side
      // and overlaps the header again. `"bestFit"` picks whichever side overflows least instead, which is the
      // outcome that keeps the tooltip visible and off the trigger.
      flip(() => ({ padding: headerAwarePadding(), fallbackStrategy: "bestFit" })),
      // Then slide sideways to stay on screen, so alignment degrades from centred to start/end-ish only as far
      // as it must.
      //
      // DEFAULTS ARE CORRECT HERE AND SHOULD BE LEFT ALONE. Floating UI's axis names are counter-intuitive and
      // easy to "fix" wrongly: for this middleware `mainAxis` is the axis along the floating element's
      // ALIGNMENT (horizontal for a top/bottom tooltip) and defaults to `true`, while `crossAxis` runs along
      // its SIDE (vertical here) and defaults to `false`. So the horizontal sliding this wants is already on,
      // and the vertical movement that would drag the tooltip over its own trigger is already off. Setting
      // `mainAxis: false` disables the sideways shift — the opposite of what the name suggests.
      //
      // The header padding is still passed: it costs nothing on the axis that is not consulted, and keeps this
      // in step with `flip()` above if a future placement makes the vertical axis relevant.
      shift(() => ({ padding: headerAwarePadding() })),
    ],
    whileElementsMounted: autoUpdate,
  });

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
          "pointer-events-none z-50 w-max max-w-[calc(100vw-1rem)] rounded-md bg-slate-900 px-2 py-1 text-[11px] font-medium leading-none whitespace-nowrap text-white opacity-0 transition-opacity duration-100 group-hover:opacity-100 group-focus-visible:opacity-100",
          visible && "opacity-100",
          className,
        )}
      >
        {text}
      </span>
    </span>
  );
}
