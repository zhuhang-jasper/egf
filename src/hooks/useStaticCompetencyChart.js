import { useCallback, useEffect, useLayoutEffect, useRef } from "react";

import { applyChartFrameLayout, getChartFrameEstimatedHeightPx } from "@/chart/fonts";
import { applyChartState, createCompetencyChart, refreshChart } from "@/chart/instance";
import { getRadarContentHeightPx } from "@/chart/radar-center";

function fitFrameToChart(frameRef, chart, maxHeightPx) {
  const frame = frameRef.current;
  if (!frame?.offsetWidth || !chart) {
    return;
  }

  const w = frame.offsetWidth;

  let prevContentH = null;
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
    applyChartFrameLayout(frame, w, contentH);
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

    applyChartFrameLayout(frame, frame.offsetWidth, null);
    if (!chart) {
      return;
    }

    refreshChart(chart, chartStateRef.current);
    fitFrameToChart(frameRef, chart, chartStateRef.current.maxHeightPx);
  }, [frameRef]);

  const relayoutRef = useRef(relayout);
  relayoutRef.current = relayout;

  useLayoutEffect(() => {
    // Run the relayout (which calls chart.resize(), mutating the frame the ResizeObserver watches)
    // on a rAF tick OUTSIDE the observer callback. Doing it synchronously inside the callback forms
    // an observe→resize→observe loop; the browser then drops the "undelivered" follow-up
    // notifications, and if the dropped pass was a transient collapse (a momentary 0-width during a
    // drag-resize) the chart is left at ~0 height and never recovers — the chart "disappears".
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
    run();
    const ro = new ResizeObserver(run);
    if (frameRef.current) {
      ro.observe(frameRef.current);
    }
    window.addEventListener("resize", run);
    return () => {
      if (rafId != null) {
        cancelAnimationFrame(rafId);
      }
      ro.disconnect();
      window.removeEventListener("resize", run);
    };
  }, [frameRef]);

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

  return { chartRef, relayout };
}
