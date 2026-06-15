import { useCallback, useEffect, useLayoutEffect, useRef } from "react";

import { applyChartFrameLayout } from "@/lib/chart/fonts";
import { applyChartState, createCompetencyChart, refreshChart } from "@/lib/chart/instance";
import { getRadarContentHeightPx } from "@/lib/chart/radar-center";
import { getChartLabels } from "@/lib/constants";

import { useAppStore } from "@/store/useAppStore";

function convergeContentHeight(frame, chart) {
  const w = frame.offsetWidth;
  let prev = null;
  for (let pass = 0; pass < 3; pass++) {
    const h = getRadarContentHeightPx(chart);
    if (!h) {
      return null;
    }
    if (h === prev) {
      break;
    }
    prev = h;
    applyChartFrameLayout(frame, w, h);
    chart.resize();
  }
  return prev;
}

function setChartLabelsFor(chart, variant) {
  chart.data.labels = getChartLabels(variant);
  chart.update("none");
}

function fitFrameToChart(frameRef, chart) {
  const frame = frameRef.current;
  if (!frame?.offsetWidth || !chart) {
    return;
  }

  const w = frame.offsetWidth;
  const savedLabels = chart.data.labels;

  // 1. Anchor on FE: it has no bottom-center label, so it converges deterministically
  //    to the width-limited radius (maxR) with a stable frame height.
  chart.$radarLockedRadius = null;
  setChartLabelsFor(chart, "fe");
  if (!convergeContentHeight(frame, chart)) {
    chart.data.labels = savedLabels;
    chart.update("none");
    return;
  }
  const feR = chart.scales?.r?.drawingArea ?? null;

  // 2. At FE's stable frame height, read BE's radius WITHOUT re-fitting the frame.
  //    BE's bottom-center label makes Chart.js reserve more vertical room, so its
  //    radius is smaller. (Re-converging BE here is unstable — it has no unique fit.)
  setChartLabelsFor(chart, "be");
  const beR = chart.scales?.r?.drawingArea ?? null;

  // 3. Lock both tracks to the smaller (BE) radius so FE and BE render identically sized.
  const lockedR = Math.min(feR ?? Infinity, beR ?? Infinity);
  chart.$radarLockedRadius = Number.isFinite(lockedR) ? lockedR : null;

  // 4. With the radius locked (now stable), fit the frame to the taller track's
  //    content and lock that height so switching tracks never shifts the UI below.
  setChartLabelsFor(chart, "be");
  const beH = convergeContentHeight(frame, chart);
  setChartLabelsFor(chart, "fe");
  const feH = convergeContentHeight(frame, chart);

  chart.data.labels = savedLabels;
  chart.update("none");

  const finalH = Math.max(beH ?? 0, feH ?? 0);
  if (finalH > 0) {
    applyChartFrameLayout(frame, w, finalH);
    chart.resize();
  }
}

/**
 * Frame margins (layout) + Chart.js lifecycle (effect after paint).
 */
export function useCompetencyChart(canvasRef, frameRef) {
  const chartRef = useRef(null);

  const levels = useAppStore((s) => s.levels);
  const title = useAppStore((s) => s.title);
  const trackVariant = useAppStore((s) => s.trackVariant);
  const levelsPolygonHidden = useAppStore((s) => s.levelsPolygonHidden);
  const chartLevelTicksHidden = useAppStore((s) => s.chartLevelTicksHidden);

  const relayout = useCallback(() => {
    const chart = chartRef.current;
    const frame = frameRef.current;
    if (!frame?.offsetWidth) {
      return;
    }

    applyChartFrameLayout(frame, frame.offsetWidth, null);
    if (!chart) {
      return;
    }

    refreshChart(chart, useAppStore.getState());
    fitFrameToChart(frameRef, chart);
  }, [frameRef]);

  const relayoutRef = useRef(relayout);
  relayoutRef.current = relayout;

  useLayoutEffect(() => {
    const run = () => relayoutRef.current();
    run();
    const ro = new ResizeObserver(run);
    if (frameRef.current) {
      ro.observe(frameRef.current);
    }
    window.addEventListener("resize", run);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", run);
    };
  }, [frameRef]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return undefined;
    }

    const chart = createCompetencyChart(canvas);
    chartRef.current = chart;
    applyChartState(chart, useAppStore.getState());

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
    // so switching tracks (or toggling data/ticks) never shifts UI below the chart.
    applyChartState(chart, useAppStore.getState());
  }, [levels, title, trackVariant, levelsPolygonHidden, chartLevelTicksHidden]);

  return { chartRef, relayout };
}
