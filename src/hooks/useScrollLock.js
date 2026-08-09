import { useEffect } from "react";

/** Width the scrollbar occupied, exposed to CSS while a modal holds the scroll lock. `0px` otherwise. */
const SCROLLBAR_WIDTH_CSS_VAR = "--scroll-lock-gutter";

/**
 * Locks body scrolling while `locked` is true, WITHOUT the page behind shifting sideways.
 *
 * The scrollbar's width is published as a CSS variable, and consumers are decided by whether they belong to
 * the PAGE or the VIEWPORT. `position: fixed` is not the test, and the compensation cannot go on `body`.
 * See docs/DECISIONS.md#scroll-lock-gutter before changing any of it.
 *
 * The variable is always defined (`0px` at rest) so `var()` resolves to a length. Previous inline values are
 * restored rather than cleared, so this composes with a second lock opening over the first.
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
