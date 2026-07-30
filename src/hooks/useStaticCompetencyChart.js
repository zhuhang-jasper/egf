import { useCallback, useEffect, useRef } from "react";

import { useChartFrameFit } from "@/hooks/useChartFrameFit";

import { applyChartFrameLayout, getChartFrameEstimatedHeightPx } from "@/chart/fonts";
import { applyChartState, createCompetencyChart, refreshChart } from "@/chart/instance";
import { getRadarContentHeightPx } from "@/chart/radar-center";
import { getChartLayoutLabelsForChart, getDisplayLabelsForChart, isHeroChart } from "@/chart/theory-profile";

/** Converge the frame height to the radar's measured label span. Returns the height it applied. */
function measureAndFit(frame, chart, w, maxHeightPx) {
  let prevContentH = null;
  let applied = null;
  for (let pass = 0; pass < 3; pass++) {
    // If the label extents can't be measured (e.g. the center-fit early-returned on a transient
    // tiny chart area, leaving stale/empty label items), keep the width-based estimate instead of
    // bailing — bailing here can leave the frame at a collapsed height and hide the chart.
    let contentH = getRadarContentHeightPx(chart) ?? getChartFrameEstimatedHeightPx(w);
    if (maxHeightPx) {
      contentH = Math.min(contentH, maxHeightPx);
    }
    if (contentH === prevContentH) {
      break;
    }
    prevContentH = contentH;
    applied = contentH;
    applyChartFrameLayout(frame, w, contentH);
    chart.resize();
  }
  return applied;
}

function fitFrameToChart(frame, chart, w, maxHeightPx) {
  // The hero radar measures against the LAYOUT labels, the same as the tool chart's fit
  // (useCompetencyChart): they substitute the longest pillar name onto the last spoke as a width
  // spacer, which makes the measured label span — and hence the frame height and radar radius —
  // larger than the displayed labels alone would give. Measuring displayed labels here instead made
  // the hero settle shorter than the tool chart at the same width, so the two came out different
  // sizes.
  //
  // Scoped to the hero: the small career-track charts pass a hard maxHeightPx (180), so the taller
  // layout-label span would push them into that clamp and shrink their radars instead.
  if (!isHeroChart(chart)) {
    return measureAndFit(frame, chart, w, maxHeightPx);
  }

  // The spacer must never survive the fit, or the last pillar paints under another pillar's name —
  // restore the display labels on every exit path.
  chart.data.labels = getChartLayoutLabelsForChart(chart);
  chart.update("none");
  try {
    return measureAndFit(frame, chart, w, maxHeightPx);
  } finally {
    chart.data.labels = getDisplayLabelsForChart(chart);
    chart.update("none");
  }
}

/**
 * Chart.js lifecycle for static (prop-driven) radar charts — no Zustand store.
 *
 * The resize/fit plumbing (and the fit memo that makes a tab switch cheap) lives in
 * {@link useChartFrameFit}; this hook supplies the converge loop and the chart's own lifecycle.
 */
export function useStaticCompetencyChart(canvasRef, frameRef, chartState) {
  const chartRef = useRef(null);
  const chartStateRef = useRef(chartState);
  chartStateRef.current = chartState;

  const fit = useCallback((frame, width, cachedHeight) => {
    const chart = chartRef.current;
    if (cachedHeight != null) {
      // Already converged for this width, and nothing feeding the fit has changed since — re-apply
      // the known height and let the chart take the canvas size in a single render. Applied even with
      // no chart in hand, so the frame never falls back to the pre-measurement estimate once we know
      // the real height.
      applyChartFrameLayout(frame, width, cachedHeight);
      chart?.resize();
      return cachedHeight;
    }

    applyChartFrameLayout(frame, width, null);
    if (!chart) {
      return null;
    }
    refreshChart(chart, chartStateRef.current);
    return fitFrameToChart(frame, chart, width, chartStateRef.current.maxHeightPx);
  }, []);

  const { relayout, frameWidth } = useChartFrameFit(frameRef, fit);

  const relayoutRef = useRef(relayout);
  relayoutRef.current = relayout;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return undefined;
    }

    const chart = createCompetencyChart(canvas, { purpose: chartStateRef.current.purpose ?? "theory" });
    chartRef.current = chart;
    applyChartState(chart, chartStateRef.current);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (chartRef.current !== chart) {
          return;
        }
        relayoutRef.current();
      });
    });

    return () => {
      chart.destroy();
      chartRef.current = null;
    };
  }, [canvasRef]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) {
      return;
    }
    applyChartState(chart, chartState);
  }, [chartState]);

  // A change to WHAT THE SPOKES MEASURE has to re-converge the frame, and the fit memo cannot see it:
  // the memo is keyed on frame width, and none of these change the width.
  //
  // The live case is the emoji↔text swap. It used to be derived from `chart.width`, so a width the memo
  // had a height for implied the label set that produced it. It is now a viewport media query (see
  // CareerTracks), and the frame width either side of that breakpoint can round to the SAME integer px —
  // so without this, crossing it would serve the cached height for the other label set and leave the
  // radar mis-fitted in its frame.
  const geometryKey = [
    chartState.emojiOnlyLabels,
    chartState.plainLabels,
    chartState.pointLabelsHidden,
    chartState.chartLevelTicksHidden,
    chartState.pointLabelPx,
    chartState.maxHeightPx,
  ].join("|");

  // Skips its own first run: the chart's creation effect already schedules the initial fit, and forcing
  // one here as well would spend a second converge per chart on mount.
  const geometrySettledRef = useRef(false);
  useEffect(() => {
    if (!geometrySettledRef.current) {
      geometrySettledRef.current = true;
      return;
    }
    if (chartRef.current) {
      relayout({ force: true });
    }
  }, [geometryKey, relayout]);

  return { chartRef, relayout, frameWidth };
}
