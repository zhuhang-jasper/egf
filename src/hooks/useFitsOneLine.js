import { useLayoutEffect, useState } from "react";

/**
 * Whether the text in `ref` fits on one line at the current width, so the sentence after it can start a new
 * line only when that will not orphan a word. Measured rather than done in CSS, because a media query would
 * hardcode a width that goes stale when the copy or type scale changes.
 *
 * The probe must sit in the SAME LAYOUT CONTEXT as the text it stands in for: an `absolute` probe inside a
 * flex item takes its width from the containing block rather than the flex negotiation, and reports "fits"
 * for a sentence that visibly wraps.
 *
 * `active` is a dependency, not an optimisation: the observer's `setFits` re-renders on a later frame, so
 * the wrong wrap paints once and corrects, while a layout effect keyed on visibility lands before paint.
 * Pass a tab's `isVisible` for a box inside a `hidden` panel, or `true` for one always laid out.
 */
export function useFitsOneLine(ref, active) {
  const [fits, setFits] = useState(true);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) {
      return undefined;
    }

    // Compare the rendered height against one line's worth. Line height comes from the computed style
    // rather than a constant so it tracks a responsive `text-xs sm:text-sm` step without being told.
    const measure = () => {
      // An unrendered probe is not a probe that fits. A `hidden` TabPanel gives descendants no box, so
      // `scrollHeight` reads 0, which passes the test below, and the observer (firing on the collapse to zero)
      // reset this to `true` every time the tab was left. Bailing keeps the last good answer instead, so it
      // survives hide/show cycles untouched. `offsetWidth` rather than a `display` check, since no width means
      // there is no wrapping to decide.
      if (el.offsetWidth === 0) {
        return;
      }
      const lineHeight = Number.parseFloat(getComputedStyle(el).lineHeight);
      if (!Number.isFinite(lineHeight) || lineHeight <= 0) {
        return;
      }
      // 1.5 lines as the threshold: comfortably above rounding noise on a single line, comfortably below two.
      setFits(el.scrollHeight < lineHeight * 1.5);
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
    // `active`: re-measure before paint whenever the box is revealed — see the docblock. The observer stays
    // for genuine in-place resizes (rotate, window drag), where a frame's lag is not perceptible.
  }, [ref, active]);

  return fits;
}
