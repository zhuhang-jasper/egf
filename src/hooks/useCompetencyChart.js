import { useCallback, useEffect, useRef } from "react";

import { useChartFrameFit } from "@/hooks/useChartFrameFit";

import { useAppStore } from "@/store/useAppStore";

import { applyChartFrameLayout } from "@/chart/fonts";
import { applyChartState, createCompetencyChart, refreshChart } from "@/chart/instance";
import { getRadarContentHeightPx } from "@/chart/radar-center";
import { getChartLayoutLabelsForChart, getDisplayLabelsForChart } from "@/chart/theory-profile";
import { FE_UI } from "@/constants";

function convergeContentHeight(frame, chart, w) {
  let prev = null;
  let applied = null;
  for (let pass = 0; pass < 3; pass++) {
    const h = getRadarContentHeightPx(chart);
    if (!h) {
      // Nothing measurable yet: keep whatever we last applied rather than reporting failure, so the
      // caller doesn't discard a good height from an earlier pass.
      return applied;
    }
    if (h === prev) {
      break;
    }
    prev = h;
    applied = h;
    applyChartFrameLayout(frame, w, h);
    chart.resize();
  }
  // Return the height actually APPLIED last, not `prev`. When the loop exits by exhausting its 3
  // passes (rather than converging), the final resize() has already been applied to the frame; the
  // caller re-applies whatever we return, so returning a stale earlier value would shrink the frame
  // back and leave the radar smaller than it measured. This only bit at narrow widths (~375px),
  // where the labels wrap more and the fit needs all 3 passes — wide layouts converge in 2 and hit
  // the `h === prev` break, where applied and prev are the same value.
  return applied;
}

/**
 * Converge the frame height to the radar's measured label span. Returns the height it applied.
 *
 * Exported for the off-screen export clone (utils/export-clone.js), which has to reproduce this fit exactly
 * or its radar geometry diverges from the on-screen one. Sharing the function is what keeps them identical.
 */
export function fitFrameToChart(frame, chart, w) {
  // There is a single pillar layout now (the FE/BE distinction is a cosmetic badge, not a different
  // axis set), so the chart labels are the same regardless of badge. Set them once, converge the
  // frame height once, then lock that height so display-toggle changes never shift the UI below.
  // Emoji-aware: the fit has to measure whichever labels are actually rendered.
  //
  // The *layout* labels substitute the longest label onto the last spoke as a width spacer, so they
  // must never survive past the fit — otherwise the last pillar paints under another pillar's name.
  // Restore the display labels on every exit path.
  chart.$radarLockedRadius = null;
  chart.data.labels = getChartLayoutLabelsForChart(chart);
  chart.update("none");
  try {
    const finalH = convergeContentHeight(frame, chart, w);
    if (!finalH) {
      return null;
    }

    // Height is the measured axis-label span (plus contentPadPx), with no width-ratio floor — the
    // same rule the theory hero radar uses, so the two charts render the same size radar at a given
    // width. The floor used to be max(measured, width * heightWidthRatio); at desktop that 289px
    // frame was SHORTER than the hero's measured span, and since Chart.js fits the radar into the
    // smaller dimension (the radius here is height-limited, not width-limited), it made the tool
    // chart's radar visibly smaller than the hero's. heightWidthRatio still seeds the
    // pre-measurement estimate in getChartFrameEstimatedHeightPx.
    applyChartFrameLayout(frame, w, finalH);
    chart.resize();
    return finalH;
  } finally {
    chart.data.labels = getDisplayLabelsForChart(chart);
    chart.update("none");
  }
}

/**
 * Store state → chart state. The chart's option is `plainLabels` ("strip the emoji"), which is the
 * negation of what the UI toggle stores, so map it here rather than at each call site.
 *
 * `pointLabelPxRange` puts the tool chart on the same axis-label ramp as the theory hero radar
 * (see FE_UI.chart.pointLabelPxRange) instead of the rounded pointLabelPx × width scaling.
 */
export function chartState() {
  const state = useAppStore.getState();
  return { ...state, plainLabels: state.pillarEmojiHidden === true, pointLabelPxRange: FE_UI.chart.pointLabelPxRange };
}

/**
 * Frame layout + Chart.js lifecycle for the interactive tool chart.
 *
 * Returns the frame's measured width alongside the chart, so the surrounding chrome (title size,
 * track badge, cluster legend) can scale with the chart off ONE ResizeObserver rather than adding a
 * second one to the same element.
 */
export function useCompetencyChart(canvasRef, frameRef) {
  const chartRef = useRef(null);

  const levels = useAppStore((s) => s.levels);
  const title = useAppStore((s) => s.title);
  const levelsPolygonHidden = useAppStore((s) => s.levelsPolygonHidden);
  const chartLevelTicksHidden = useAppStore((s) => s.chartLevelTicksHidden);
  const clusterLabelColors = useAppStore((s) => s.clusterLabelColors);
  const pillarEmojiHidden = useAppStore((s) => s.pillarEmojiHidden);

  const fit = useCallback((frame, width, cachedHeight) => {
    const chart = chartRef.current;
    if (cachedHeight != null) {
      // This width has already been converged for, and nothing that feeds the fit has changed since.
      // Re-apply the height and let the chart pick up the canvas size in one render. Applied even with
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
    refreshChart(chart, chartState());
    return fitFrameToChart(frame, chart, width);
  }, []);

  const { relayout, frameWidth } = useChartFrameFit(frameRef, fit);

  const relayoutRef = useRef(relayout);
  relayoutRef.current = relayout;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return undefined;
    }

    const chart = createCompetencyChart(canvas);
    chartRef.current = chart;
    applyChartState(chart, chartState());

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
    // No refit here — the frame height is locked to the taller track on init/resize,
    // so switching tracks (or toggling data/ticks/label colors) never shifts UI below the chart.
    applyChartState(chart, chartState());
  }, [levels, title, levelsPolygonHidden, chartLevelTicksHidden, clusterLabelColors]);

  // Dropping the emoji changes the spoke metrics (label widths, and thus wrapping), so the radar has
  // to be re-fitted to the frame — unlike the other display toggles, which leave the layout alone.
  // FORCED, because the frame width has not changed: this is exactly the case the fit memo would
  // otherwise serve from cache.
  useEffect(() => {
    if (chartRef.current) {
      relayout({ force: true });
    }
  }, [pillarEmojiHidden, relayout]);

  return { chartRef, relayout, frameWidth };
}
