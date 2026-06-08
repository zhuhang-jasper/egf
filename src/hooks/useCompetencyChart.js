import { useCallback, useEffect, useLayoutEffect, useRef } from "react";

import { getChartFrameMarginBottomPx, getChartFrameMarginTopPx } from "@/lib/chart/fonts";
import { applyChartState, createCompetencyChart, refreshChart } from "@/lib/chart/instance";
import { FE_UI } from "@/lib/constants";

import { useAppStore } from "@/store/useAppStore";

function syncFrameMargins(frameRef) {
  const frame = frameRef.current;
  if (!frame) {
    return;
  }

  const w = frame.offsetWidth;
  const top = getChartFrameMarginTopPx(w);
  const bot = getChartFrameMarginBottomPx(w);

  const marginTop = Math.round(top);
  const marginBottom = Math.round(bot);
  const shrink = (top < 0 ? -top : 0) + (bot < 0 ? -bot : 0);
  const minH = FE_UI.chartFrame.minChartHeightPx ?? 120;
  const innerH = Math.round(Math.max(minH, w - shrink));

  frame.style.margin = `${marginTop}px auto ${marginBottom}px`;
  frame.style.aspectRatio = "unset";
  frame.style.height = `${innerH}px`;
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

  const relayout = useCallback(() => {
    syncFrameMargins(frameRef);
    refreshChart(chartRef.current, useAppStore.getState());
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
  }, [levels, title, trackVariant, levelsPolygonHidden]);

  return { chartRef, relayout };
}
