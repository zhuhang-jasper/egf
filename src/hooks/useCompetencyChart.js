import { useCallback, useEffect, useLayoutEffect, useRef } from "react";

import { applyChartFrameLayout } from "@/lib/chart/fonts";
import { applyChartState, createCompetencyChart, refreshChart } from "@/lib/chart/instance";
import { getRadarContentHeightPx } from "@/lib/chart/radar-center";

import { useAppStore } from "@/store/useAppStore";

function fitFrameToChart(frameRef, chart) {
  const frame = frameRef.current;
  if (!frame?.offsetWidth || !chart) {
    return;
  }

  const w = frame.offsetWidth;

  let prevContentH = null;
  for (let pass = 0; pass < 3; pass++) {
    const contentH = getRadarContentHeightPx(chart);
    if (!contentH) {
      return;
    }
    if (contentH === prevContentH) {
      break;
    }
    prevContentH = contentH;
    applyChartFrameLayout(frame, w, contentH);
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
    applyChartState(chart, useAppStore.getState());
  }, [levels, title, trackVariant, levelsPolygonHidden, chartLevelTicksHidden]);

  return { chartRef, relayout };
}
