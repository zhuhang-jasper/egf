import { useCallback, useEffect, useLayoutEffect, useRef } from "react";

import { applyChartState, createCompetencyChart, refreshChart } from "@/lib/chart/instance";
import { FE_UI } from "@/lib/constants";

import { useAppStore } from "@/store/useAppStore";

function syncFrameMargins(frameRef, legendRef) {
  const frame = frameRef.current;
  if (!frame) {
    return;
  }

  const p = FE_UI.page;
  const cf = FE_UI.chartFrame;
  const w = frame.offsetWidth;
  const w0 = p.minWidthPx;
  const w1 = p.maxWidthPx;
  const u = w1 > w0 ? Math.max(0, Math.min(1, (w - w0) / (w1 - w0))) : 1;
  const top = cf.marginTopMinPx + u * (cf.marginTopMaxPx - cf.marginTopMinPx);
  const bot = cf.marginBottomMinPx + u * (cf.marginBottomMaxPx - cf.marginBottomMinPx);

  let legendH = 0;
  const legend = legendRef?.current;
  if (legend) {
    const cs = getComputedStyle(legend);
    legendH = legend.offsetHeight + (parseFloat(cs.marginTop) || 0) + (parseFloat(cs.marginBottom) || 0);
  }

  const marginTop = Math.round(top - legendH);
  const marginBottom = Math.round(bot);
  const shrink = (top < 0 ? -top : 0) + (bot < 0 ? -bot : 0);
  const minH = cf.minChartHeightPx ?? 120;
  const innerH = Math.round(Math.max(minH, w - shrink));

  frame.style.margin = `${marginTop}px auto ${marginBottom}px`;
  frame.style.aspectRatio = "unset";
  frame.style.height = `${innerH}px`;
}

/**
 * Frame margins (layout) + Chart.js lifecycle (effect after paint).
 * Returns chart ref and a layout sync helper for legend image onLoad.
 */
export function useCompetencyChart(canvasRef, frameRef, legendRef) {
  const chartRef = useRef(null);

  const levels = useAppStore((s) => s.levels);
  const title = useAppStore((s) => s.title);
  const trackVariant = useAppStore((s) => s.trackVariant);
  const levelsPolygonHidden = useAppStore((s) => s.levelsPolygonHidden);

  const relayout = useCallback(() => {
    syncFrameMargins(frameRef, legendRef);
    refreshChart(chartRef.current, useAppStore.getState());
  }, [frameRef, legendRef]);

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
