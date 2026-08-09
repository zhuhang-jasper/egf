import { useLayoutEffect, useState } from "react";

/** Kept visible at the END of a truncated string. Profile names disambiguate there far more often than in the
 *  middle — "… Engineer L4" vs "… Engineer L5", "… (FE)" vs "… (BE)" — which is the whole reason this
 *  truncates in the middle rather than letting `text-overflow: ellipsis` cut the tail off. */
const TAIL_CHARS = 4;

/** The character the two halves are joined with. A single glyph rather than "..." so it costs one character's
 *  width instead of three at the size this runs at. */
const ELLIPSIS = "…";

/** Below this many characters there is nothing worth truncating — a `head…tail` of a very short string is
 *  longer than the string. Must exceed TAIL_CHARS + 1 or the head would be empty. */
const MIN_TRUNCATABLE = TAIL_CHARS + 3;

/**
 * Fit `text` onto ONE line inside `ref` by dropping characters from its MIDDLE, returning the string to
 * render. Returns `text` unchanged whenever it already fits, or whenever the element cannot be measured.
 *
 * `text-overflow: ellipsis` only truncates at the end, so keeping both ends means measuring and cutting.
 *
 * Measured on the REAL ELEMENT, not a probe: an out-of-flow probe inside a flex row reports "fits" for text
 * that overflows, and this caller is `flex-1` beside the track badge. Candidates are written into the element
 * and `scrollWidth` read back, so it is its own probe under the constraints it will render with.
 *
 * `active` is a dependency, not an optimisation (see useFitsOneLine): a hidden tab's descendants have no box,
 * so measuring then truncates against zero width.
 *
 * `ref` MUST POINT AT AN ELEMENT REACT DOES NOT RENDER CHILDREN INTO. The loop writes into `textContent`
 * behind React's back, so pointed at a node React also fills, React would restore the full string on its next
 * commit without re-running this. Callers render the result into a child and hand this an empty measuring
 * element (see ChartSection).
 */
export function useMiddleEllipsis(ref, text, active) {
  const [display, setDisplay] = useState(text);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) {
      return undefined;
    }

    const fit = () => {
      const full = String(text ?? "");

      // AN UNMEASURABLE ELEMENT IS NOT AN ELEMENT THAT NEEDS TRUNCATING. A hidden tab panel gives every
      // descendant a zero box, and `scrollWidth > clientWidth` is trivially false there, so measuring would
      // "prove" the text fits and then be wrong the moment the tab is shown. Bail and keep the last answer.
      if (el.offsetWidth === 0) {
        return;
      }

      if (full.length < MIN_TRUNCATABLE) {
        setDisplay(full);
        return;
      }

      // MEASURE THE FULL STRING FIRST, and take the common path out. Writing to `textContent` here rather than
      // trusting React's committed value is deliberate: this runs in a layout effect, so a previous run may
      // have left a TRUNCATED string in the DOM, and measuring that would happily conclude it still fits and
      // never restore the full name when the element grows.
      el.textContent = full;
      if (el.scrollWidth <= el.clientWidth) {
        setDisplay(full);
        return;
      }

      // BINARY SEARCH ON THE HEAD LENGTH, not a character-by-character walk. Each probe is a synchronous
      // layout flush (write text, read `scrollWidth`), so the cost is measured in flushes, not comparisons:
      // ~5-6 for a 40 character name instead of up to 40.
      //
      // `lo` is always a length known to FIT and `hi` one known not to, so the loop cannot return an
      // overflowing string — it converges on the largest head that fits, and 0 (tail only) is the floor.
      const tail = full.slice(-TAIL_CHARS);
      let lo = 0;
      let hi = full.length - TAIL_CHARS;

      while (lo < hi) {
        const mid = Math.ceil((lo + hi) / 2);
        el.textContent = full.slice(0, mid) + ELLIPSIS + tail;
        if (el.scrollWidth <= el.clientWidth) {
          lo = mid;
        } else {
          hi = mid - 1;
        }
      }

      setDisplay(full.slice(0, lo) + ELLIPSIS + tail);
    };

    fit();

    // Re-fit on width changes (viewport resize, the chart's own sizing passes settling) AND on font size
    // changes, which for this element move with the chart rather than with a breakpoint.
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, text, active]);

  return display;
}
