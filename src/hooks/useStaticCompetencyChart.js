import { useCallback, useEffect, useLayoutEffect, useRef } from "react";

import { applyChartFrameLayout } from "@/lib/chart/fonts";
import { applyChartState, createCompetencyChart, refreshChart } from "@/lib/chart/instance";
import { getRadarContentHeightPx } from "@/lib/chart/radar-center";

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
    applyChartFrameLayout(frame, w, contentH, { minimalChrome: true });
    chart.resize();
  }
}

/**
 * Chart.js lifecycle for static (prop-driven) radar charts — no Zustand store.
 */
export function useStaticCompetencyChart(canvasRef, frameRef, chartState) {
  const chartRef = useRef(null);
  const chartStateRef = useRef(chartState);
  chartStateRef.current = chartState;

  const relayout = useCallback(() => {
    const chart = chartRef.current;
    const frame = frameRef.current;
    if (!frame?.offsetWidth) {
      return;
    }

    applyChartFrameLayout(frame, frame.offsetWidth, null, { minimalChrome: true });
    if (!chart) {
      return;
    }

    refreshChart(chart, chartStateRef.current);
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

    const chart = createCompetencyChart(canvas, { purpose: chartStateRef.current.purpose ?? "about" });
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

  return { chartRef, relayout };
}
