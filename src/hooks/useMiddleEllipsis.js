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
 * NOT EXPRESSIBLE IN CSS. `text-overflow: ellipsis` only ever truncates at the end, so keeping both ends
 * visible means measuring the rendered text and cutting it ourselves. Everything awkward here follows from
 * that: the answer depends on the laid-out width and the resolved font, neither of which is known until after
 * layout, and both of which change under us.
 *
 * MEASURED ON THE REAL ELEMENT, NOT A PROBE. See the note in useFitsOneLine: an out-of-flow probe inside a
 * flex row takes its width from the containing block rather than from the flex negotiation the visible text is
 * subject to, and then reports "fits" for text that visibly overflows. Its one caller sits in a column where
 * that is safe; THIS one is `flex-1` beside the track badge (see ChartSection), which is precisely the case
 * that broke the install banner. So the fitting runs by writing candidates into the element itself and reading
 * `scrollWidth` back — the element is its own probe, under the exact constraints it will be rendered with.
 *
 * `active` IS A DEPENDENCY, NOT AN OPTIMISATION, for the same reason it is one there: the tool tab is
 * `display: none` while Theory is open, every descendant has no box, and a measurement taken then would
 * truncate against a width of zero. The zero-width guard below bails instead of recording that, so the last
 * good answer survives the hide/show cycle — and re-running as a LAYOUT effect when the tab is revealed means
 * the correction lands in the same commit, before paint, rather than flashing the wrong string for a frame.
 *
 * `ref` MUST POINT AT AN ELEMENT REACT DOES NOT RENDER CHILDREN INTO. The fitting loop writes candidate
 * strings straight into `textContent` and reads `scrollWidth` back, which is a lie React does not know about:
 * pointed at a node React also fills, the two would each believe they own the text, and React would restore
 * the full string on its next commit without re-running this. The caller therefore renders the RESULT into a
 * child and hands this an empty measuring element — see ChartSection, where the <h2> holds a measuring span
 * plus the visible text.
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
