import { useCallback, useEffect } from "react";

import { FE_UI } from "@/lib/constants";

export function useChartFrameMargins(frameRef, legendRef) {
  const sync = useCallback(() => {
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
  }, [frameRef, legendRef]);

  useEffect(() => {
    sync();
    const ro = new ResizeObserver(() => sync());
    if (frameRef.current) {
      ro.observe(frameRef.current);
    }
    window.addEventListener("resize", sync);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", sync);
    };
  }, [sync, frameRef]);

  return sync;
}
