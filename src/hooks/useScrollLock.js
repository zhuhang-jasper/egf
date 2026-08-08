import { useEffect } from "react";

/** Width the scrollbar occupied, exposed to CSS while a modal holds the scroll lock. `0px` otherwise. */
const SCROLLBAR_WIDTH_CSS_VAR = "--scroll-lock-gutter";

/**
 * Locks body scrolling while `locked` is true, WITHOUT the page behind shifting sideways.
 *
 * `overflow: hidden` alone removes the document's scrollbar, handing its ~15px back to the layout: the
 * app column widens, its centred content slides, and the fixed bottom nav's centred items slide by a
 * different amount again. The width has to be given back — but WHICH ELEMENTS GET IT IS THE WHOLE
 * PROBLEM, and three narrower attempts each failed in an instructive way:
 *
 *   `padding-right` on `body` — `body` carries `bg-black` (index.css) as the surround the app sits on,
 *      and a background on `body` PROPAGATES TO THE CANVAS when `html` has none, as here. The reserved
 *      strip paints black across the full viewport, outside the modal's `fixed inset-0` scrim, reading
 *      as a black bar down the right edge.
 *   `margin-right` on `body` — identical, for the same reason: what shows in the gap is the propagated
 *      canvas background, which nothing done to `body`'s own box can avoid.
 *   `margin-right` on `#root` alone — no black, but it insets only the in-flow column, so AppBottomNav
 *      (fixed, and therefore laid out against the viewport) stayed full-width while the page it belongs
 *      to pulled in beneath it.
 *
 * So the compensation is published as a CSS variable, and the elements that take it are decided by ONE
 * QUESTION: does this belong to the page, or to the viewport?
 *
 *   The page — `#root` (margin, set below) and AppBottomNav (`right-[var(--scroll-lock-gutter)]`). The
 *      bar is the page's own footer and reads as the bottom of the column above it, so it must end where
 *      that column ends. Being `fixed` is why it needs the value explicitly rather than inheriting the
 *      margin; it is not why it qualifies.
 *   The viewport — toasts, the install prompt, the modal scrim. These float over whatever is beneath
 *      them and have no relationship to the page's edges, so the gutter is not theirs to take. The scrim
 *      especially: the modal is what CAUSED the lock, and an overlay that shifted in response to its own
 *      side effect would be reacting to itself. It covers the whole viewport, unconditionally.
 *
 * `position: fixed` is NOT the test — all of the above are fixed. Applying the gutter to everything
 * fixed was the wrong rule, and it coupled the floating overlays to a page edge they should never track.
 *
 * The variable is always defined (`0px` at rest), so `var(--scroll-lock-gutter)` resolves to a length
 * rather than to nothing when no modal is open, and on overlay scrollbars (macOS trackpad, touch) it
 * stays `0px` because there is no gutter to give back.
 *
 * `scrollbar-gutter: stable` would reserve the space in CSS alone, but permanently shrinks the content
 * box while fixed elements keep the full viewport — the same misalignment as the third attempt, standing
 * rather than transient.
 *
 * Vertical scroll position is preserved for free: `overflow: hidden` on `body` keeps the scroll offset
 * intact, unlike the `position: fixed` body trick, which needs an explicit save/restore and would break
 * the fixed bottom nav besides (a fixed element cannot opt out of the visual viewport — see
 * AppBottomNav's frame trace).
 *
 * Restores the exact previous inline values rather than clearing them, so this composes with anything
 * else that may have set them and with a second lock opening over the first.
 */
export function useScrollLock(locked) {
  useEffect(() => {
    if (!locked) {
      return undefined;
    }
    const { body, documentElement } = document;
    const root = document.getElementById("root");
    // Read BEFORE locking: `innerWidth - clientWidth` is the scrollbar's width only while the scrollbar
    // is still there. Measured after hiding it, it is always 0 — silently the naive lock again.
    const scrollbarWidth = window.innerWidth - documentElement.clientWidth;
    const prevOverflow = body.style.overflow;
    const prevMarginRight = root?.style.marginRight;

    body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      documentElement.style.setProperty(SCROLLBAR_WIDTH_CSS_VAR, `${scrollbarWidth}px`);
      if (root) {
        // Add to the computed margin rather than overwrite it, so an existing margin survives.
        const baseMarginRight = Number.parseFloat(window.getComputedStyle(root).marginRight) || 0;
        root.style.marginRight = `${baseMarginRight + scrollbarWidth}px`;
      }
    }

    return () => {
      body.style.overflow = prevOverflow;
      documentElement.style.setProperty(SCROLLBAR_WIDTH_CSS_VAR, "0px");
      if (root) {
        root.style.marginRight = prevMarginRight ?? "";
      }
    };
  }, [locked]);
}
