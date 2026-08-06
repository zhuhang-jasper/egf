import { useLayoutEffect, useState } from "react";

/**
 * Whether the text in `ref` fits on a single line at the current width.
 *
 * Drives the app's "second sentence goes where it reads best" rule: if the first sentence fits on one line the
 * second starts a new one; if the first has to wrap, the second continues inline instead. Forcing a break in
 * the wrapped case is what produced an orphaned word on its own line with the next sentence stranded below it.
 *
 * NOT EXPRESSIBLE IN CSS, which is why this measures. The condition depends on whether the RENDERED text fits,
 * a fact only available after layout — a media query would instead have to hardcode "the width at which ~104
 * characters of `text-sm` fit", which is a number that goes stale silently the moment the copy or the type
 * scale changes. `scrollHeight` against a single line's height is the direct question.
 *
 * ONE CALLER TODAY: the Theory tagline. It lived in AppShellHeader while the tagline was in the app header,
 * moved to TheoryContent with it, and landed here when the install banner briefly wanted the same rule. The
 * banner dropped it again — inside a flex row the probe kept measuring a different width than the visible text
 * received, and the machinery was not worth it for two short sentences (see InstallPrompt) — so this is a
 * single-caller module that has simply already paid the cost of being extracted. Left here rather than folded
 * back in: it is self-contained, and the next caller will not have to rediscover the notes below.
 *
 * THE PROBE MUST BE IN THE SAME LAYOUT CONTEXT AS THE TEXT IT STANDS IN FOR, which is the trap the banner fell
 * into. An `absolute` probe is out of flow, so inside a flex item its width comes from the containing block
 * rather than from the flex negotiation the real text is subject to — it then reports "fits" for a sentence
 * that visibly wraps. Fine for the tagline, whose column is not a flex item competing with a button.
 *
 * `active` IS A DEPENDENCY, NOT AN OPTIMISATION, and it is what stops the answer flipping in front of the user
 * when a hidden box becomes visible. The ResizeObserver below cannot do that job alone: it fires after layout,
 * but the `setFits` it calls schedules a re-render for a LATER frame, so the wrong wrap paints once and
 * corrects. Re-running as a LAYOUT effect on the visibility change instead means the measurement happens in
 * the same commit that revealed the box — it is laid out, and a state update from a layout effect re-renders
 * synchronously BEFORE paint, so only the corrected wrap is ever displayed.
 *
 * That also covers the cases the guard inside `measure` cannot: a first mount that happened while hidden, a
 * width that changed while the box slept, and a cold load whose first measurement ran against the fallback
 * face before Inter arrived (the same staleness useChartFrameFit forces a refit for).
 *
 * Pass a tab's `isVisible` for a box inside a `hidden` panel; pass `true` for one that is always laid out.
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
      // AN UNRENDERED PROBE IS NOT A PROBE THAT FITS, and conflating the two caused a visible flip of the
      // whole tagline block on every entry to the Theory tab. An inactive TabPanel is `hidden`, i.e.
      // `display: none`, which gives every descendant no box at all — so `scrollHeight` reads 0, 0 passes the
      // test below, and the ResizeObserver (which fires on the collapse to zero) reset this to `true` every
      // time the tab was LEFT. Coming back, the tagline painted one-sentence-per-line, then measured and
      // snapped to inline.
      //
      // That was also a line-height change in the document on every switch, which the scroll-restore burst
      // then had to chase — so a remembered position visibly settled instead of just being there. See
      // useTabScrollMemory, whose re-assert loop exists for real late reflows like the radars' sizing passes,
      // not for one this could avoid creating.
      //
      // Bailing keeps the last good answer instead: the value is measured once while the box is laid out and
      // then survives every hide/show cycle untouched. `offsetWidth` rather than a `display` check because it
      // answers the question that actually matters — no width means there is no wrapping to decide.
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
