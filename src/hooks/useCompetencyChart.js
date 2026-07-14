import { useCallback, useEffect, useLayoutEffect, useRef } from "react";

import { useAppStore } from "@/store/useAppStore";

import { applyChartFrameLayout } from "@/chart/fonts";
import { applyChartState, createCompetencyChart, refreshChart } from "@/chart/instance";
import { getRadarContentHeightPx } from "@/chart/radar-center";
import { FE_UI, getChartLabels } from "@/constants";

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

function fitFrameToChart(frameRef, chart) {
  const frame = frameRef.current;
  if (!frame?.offsetWidth || !chart) {
    return;
  }

  const w = frame.offsetWidth;

  // There is a single pillar layout now (the FE/BE distinction is a cosmetic badge, not a different
  // axis set), so the chart labels are the same regardless of badge. Set them once, converge the
  // frame height once, then lock that height so display-toggle changes never shift the UI below.
  chart.$radarLockedRadius = null;
  chart.data.labels = getChartLabels();
  chart.update("none");
  const rawH = convergeContentHeight(frame, chart);
  if (!rawH) {
    return;
  }

  const minRatioH = Math.round(w * (FE_UI.chartFrame.heightWidthRatio ?? 0));
  const finalH = Math.max(rawH, minRatioH);
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
  }, [levels, title, levelsPolygonHidden, chartLevelTicksHidden]);

  return { chartRef, relayout };
}
