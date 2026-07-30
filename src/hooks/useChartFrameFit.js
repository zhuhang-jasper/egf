import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * The resize plumbing shared by the tool chart ({@link useCompetencyChart}) and every theory chart
 * ({@link useStaticCompetencyChart}): ONE rAF-coalesced ResizeObserver per chart frame, plus a memo
 * of the last successful fit.
 *
 * THE MEMO IS THE POINT. Both tab panels stay mounted and are toggled with `hidden`, so every tab
 * switch takes each chart's frame from a real width to 0 and back — and a ResizeObserver reports
 * BOTH transitions. Without a memo each switch re-ran the full converge loop for all nine charts on
 * the page, ~8 Chart.js renders apiece, which is the flash on the frame a switch commits. The fit is
 * a pure function of frame width (the label set, font size, label padding and layout padding are all
 * derived from it), so an unchanged width can reuse the height that width converged to last time and
 * spend a single `chart.resize()` instead.
 *
 * THE OBSERVER CALLBACK DEFERS TO A rAF for two reasons. Correctness: the fit mutates the frame's
 * height — the very box the observer watches — so running it synchronously inside the callback forms
 * an observe→resize→observe loop. The browser then drops the "undelivered" follow-up notifications,
 * and if the dropped pass was a transient collapse (a momentary 0-width mid drag-resize) the chart
 * is left at ~0 height and never recovers: the chart "disappears". Cost: one drag frame can deliver
 * several notifications, and the hop collapses them into one fit.
 *
 * There is deliberately NO `window.resize` listener. A frame that is width-flexible already gets a
 * ResizeObserver notification whenever the window resize changes its width, and everything the fit
 * derives comes from the chart's own width rather than the viewport's — so a listener could only
 * ever duplicate a pass the observer had already scheduled.
 *
 * @param frameRef ref to the chart's frame element (the box whose height the fit sets).
 * @param fit `(frame, width, cachedHeight) => number | null` — runs the converge loop and returns
 *   the height it applied, or null when nothing was measurable. `cachedHeight` is non-null when this
 *   width has been converged before, and is the caller's cue to take its fast path.
 */
export function useChartFrameFit(frameRef, fit) {
  const [frameWidth, setFrameWidth] = useState(0);

  const fitRef = useRef(fit);
  fitRef.current = fit;

  // Width → height of the last converge that produced a usable height.
  const memoRef = useRef({ width: null, height: null });

  const relayout = useCallback(
    ({ force = false } = {}) => {
      if (force) {
        // Invalidate BEFORE the width check, so a forced refit still lands on a hidden chart. It
        // cannot re-converge there (nothing is measurable at width 0), but dropping the memo means
        // the next pass — when the tab is shown again — converges instead of serving a stale height.
        memoRef.current = { width: null, height: null };
      }

      const frame = frameRef.current;
      const width = frame?.offsetWidth ?? 0;
      if (!width) {
        // Hidden (an inactive tab panel is `display: none`) or not laid out yet. An UNFORCED pass
        // deliberately leaves the memo alone: the width we come back at is all but always the width
        // we left, and keeping it is what makes the return trip free.
        return;
      }
      setFrameWidth(width);

      const memo = memoRef.current;
      const cachedHeight = memo.width === width ? memo.height : null;
      const height = fitRef.current(frame, width, cachedHeight);
      if (height) {
        memoRef.current = { width, height };
      } else if (cachedHeight == null) {
        // Nothing measurable — no chart yet, or a transient collapse. Drop the memo so the next pass
        // at this width converges for real rather than trusting a height we could not confirm.
        memoRef.current = { width: null, height: null };
      }
    },
    [frameRef],
  );

  const relayoutRef = useRef(relayout);
  relayoutRef.current = relayout;

  useLayoutEffect(() => {
    let rafId = null;
    const run = () => {
      if (rafId != null) {
        return;
      }
      rafId = requestAnimationFrame(() => {
        rafId = null;
        relayoutRef.current();
      });
    };

    relayoutRef.current();

    const ro = new ResizeObserver(run);
    if (frameRef.current) {
      ro.observe(frameRef.current);
    }
    return () => {
      if (rafId != null) {
        cancelAnimationFrame(rafId);
      }
      ro.disconnect();
    };
  }, [frameRef]);

  // Inter is bundled and loads asynchronously (see main.jsx), so on a cold load the first fit can land
  // against the fallback face — whose label metrics are not Inter's. The memo would then keep serving
  // that wrong height for the rest of the session, so force one refit when the faces settle.
  //
  // Gated on `status`, not just awaited: on a warm cache the fonts are already in by the time this
  // runs, the first fit will measure the real face, and forcing a second converge for all nine charts
  // would be pure waste. Only a load actually in flight buys the refit.
  useEffect(() => {
    if (typeof document === "undefined" || !document.fonts?.ready || document.fonts.status === "loaded") {
      return undefined;
    }
    let cancelled = false;
    document.fonts.ready.then(() => {
      if (!cancelled) {
        relayoutRef.current({ force: true });
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { relayout, frameWidth };
}
