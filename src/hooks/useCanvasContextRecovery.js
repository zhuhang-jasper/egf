import { useEffect, useRef, useState } from "react";

import { track } from "@/utils/analytics";

/**
 * How long after a resume to wait before giving up on the browser's own restore and rebuilding the
 * canvas.
 *
 * DELIBERATELY GENEROUS, and not tuned against anything — nobody has measured how long Chrome actually
 * takes to deliver `contextrestored` on a real device, which is what the `recovered_by` field in the
 * events below exists to find out. Erring long is the cheap direction: the user is already looking at a
 * broken chart, so the extra wait costs nothing, while erring short rebuilds canvases the browser was
 * about to restore by itself. Tighten it once the analytics say what the real restore latency is.
 */
const RESTORE_GRACE_MS = 1000;

/** The live 2D context, or null. Re-getting it is free — a canvas hands back the same object. */
function contextOf(canvas) {
  try {
    return canvas?.getContext?.("2d") ?? null;
  } catch {
    return null;
  }
}

/**
 * Whether the canvas's 2D context is currently lost. `isContextLost` is Chrome 117+ / Safari 17+; where
 * it is missing this reports false, and the event-based tracking inside the hook covers that case.
 *
 * Exported for the fit loops, which must not measure through a dead context: `measureText` returns
 * zeros there, so the converge loop would collapse the frame to nothing.
 */
export function isCanvasContextLost(canvas) {
  return contextOf(canvas)?.isContextLost?.() === true;
}

/**
 * Recovery for a canvas whose 2D backing store the browser threw away while the app sat in the
 * background — the Android PWA / mobile Chrome failure where the chart comes back as a broken-image
 * glyph or an empty box.
 *
 * WHY A REPAINT IS NOT ENOUGH. Chrome does not merely clear the bitmap, it LOSES THE CONTEXT: the
 * canvas enters a broken state (that glyph is the spec'd rendering for it) and every subsequent draw
 * call is a no-op. Issuing `chart.update()` at that point paints into a dead context and nothing
 * appears, which is why the force-refit in {@link useChartFrameFit} could not fix this on its own.
 * The browser restores the context on its own schedule and fires `contextrestored` with a BLANK
 * bitmap; Chart.js does not listen for that, so the chart stays empty even after the context is
 * healthy again. Those two states are the broken glyph and the empty box respectively.
 *
 * So: repaint when the restore actually lands, and if it never does, replace the canvas element —
 * a fresh element is the only guaranteed way back from a context the UA declined to restore.
 *
 * @param canvasRef ref to the `<canvas>`.
 * @param repaint called after a restore; should force a full redraw.
 * @param label which chart this is, for the analytics events. Memory pressure hits every canvas on the
 *   page at once, so without it a single incident is ~11 indistinguishable hits.
 * @returns `canvasEpoch` — bump-on-recovery counter. The caller MUST use it as the `<canvas>`'s
 *   `key` and include it in the deps of whatever creates the chart, or the remount never happens.
 */
export function useCanvasContextRecovery(canvasRef, repaint, label) {
  const [canvasEpoch, setCanvasEpoch] = useState(0);

  const repaintRef = useRef(repaint);
  repaintRef.current = repaint;

  // Through a ref, not the dep array: `label` is only ever read inside an event handler, and listing it
  // would tear down and re-attach every listener whenever a caller passed a fresh string.
  const labelRef = useRef(label);
  labelRef.current = label;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return undefined;
    }

    // Tracks loss for browsers that fire the events but predate `isContextLost()`. The two checks are
    // OR'd below so either signal alone is enough.
    let lost = false;
    let graceId = null;
    // Which epoch `contextlost` last fired for, so the rebuild can report whether it was told about the
    // loss or only probed it. -1 is "never fired".
    let lostAtEpoch = -1;

    const stillLost = () => {
      const ctx = contextOf(canvasRef.current);
      return ctx?.isContextLost?.() === true || lost;
    };

    // Give the browser its grace period, then rebuild if it did not restore. Deliberately re-armable
    // from either trigger below, because neither one alone catches every loss: a loss can land before
    // the resume check reads it, or after.
    const scheduleRecheck = () => {
      if (graceId != null || !stillLost()) {
        return;
      }
      graceId = setTimeout(() => {
        graceId = null;
        // A rebuild is only worth doing while the page is on screen — a canvas built for a hidden tab
        // is a candidate to be discarded again before anyone sees it. `onResume` re-arms this.
        if (document.visibilityState === "visible" && stillLost()) {
          // The old element keeps its dead context; the new one gets a fresh backing store, and the
          // chart is rebuilt onto it.
          //
          // `detected_by` separates a loss we were TOLD about from one we only inferred: "event" means
          // `contextlost` fired, "probe" means it never did and `isContextLost()` was the only signal.
          // If the field only ever reads "probe" on your device, the event-based half of this hook is
          // not firing there and the diagnosis behind it needs revisiting.
          track("canvas_context_rebuilt", {
            chart: labelRef.current,
            epoch: canvasEpoch,
            detected_by: lostAtEpoch === canvasEpoch ? "event" : "probe",
            grace_ms: RESTORE_GRACE_MS,
          });
          setCanvasEpoch((n) => n + 1);
        }
      }, RESTORE_GRACE_MS);
    };

    // NEVER `preventDefault()` HERE. Canceling `contextlost` is the page telling the UA "I will handle
    // restoration myself", and the UA then never restores — which would turn the case this hook exists
    // to fix into a permanent one.
    const onLost = () => {
      lost = true;
      lostAtEpoch = canvasEpoch;
      track("canvas_context_lost", { chart: labelRef.current, epoch: canvasEpoch });
      scheduleRecheck();
    };

    const onRestored = () => {
      lost = false;
      // `recovered_by` is the question this instrumentation exists to answer: "browser" means the UA
      // restored on its own and the repaint was all that was needed, so the rebuild path below is dead
      // weight. Only a run with no `browser` restores justifies keeping it.
      track("canvas_context_restored", { chart: labelRef.current, epoch: canvasEpoch, recovered_by: "browser" });
      repaintRef.current();
    };

    // `pageshow` alongside `visibilitychange` for the reason given in Toaster.jsx and
    // useChartFrameFit.js: iOS does not reliably deliver the latter on restore from a frozen state.
    const onResume = () => {
      if (document.visibilityState === "visible") {
        scheduleRecheck();
      }
    };

    canvas.addEventListener("contextlost", onLost);
    canvas.addEventListener("contextrestored", onRestored);
    document.addEventListener("visibilitychange", onResume);
    window.addEventListener("pageshow", onResume);

    // A loss that predates these listeners — the remount we are recovering into, or a chart mounted
    // after the app was already back in the foreground — still needs the check run once.
    onResume();

    return () => {
      if (graceId != null) {
        clearTimeout(graceId);
      }
      canvas.removeEventListener("contextlost", onLost);
      canvas.removeEventListener("contextrestored", onRestored);
      document.removeEventListener("visibilitychange", onResume);
      window.removeEventListener("pageshow", onResume);
    };
  }, [canvasRef, canvasEpoch]);

  return canvasEpoch;
}
