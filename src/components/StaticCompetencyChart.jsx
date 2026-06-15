import { useMemo, useRef } from "react";

import { useStaticCompetencyChart } from "@/hooks/useStaticCompetencyChart";

import { cn } from "@/utils";

/**
 * Standalone radar chart for documentation — compact labels, no L ticks, plain pillar names.
 */
export function StaticCompetencyChart({
  levels,
  title = " ",
  trackVariant = "fe",
  className,
  hidePolygon = false,
  hidePointLabels = false,
  fillContainer = false,
  focusedPillars,
  maxHeightPx,
  "aria-label": ariaLabel,
}) {
  const canvasRef = useRef(null);
  const frameRef = useRef(null);

  const chartState = useMemo(
    () => ({
      levels,
      title,
      trackVariant,
      purpose: "theory",
      levelsPolygonHidden: hidePolygon,
      chartLevelTicksHidden: true,
      pointLabelsHidden: hidePointLabels,
      focusedPillars,
      maxHeightPx,
    }),
    [levels, title, trackVariant, hidePolygon, hidePointLabels, focusedPillars, maxHeightPx],
  );

  useStaticCompetencyChart(canvasRef, frameRef, chartState);

  return (
    <div
      ref={frameRef}
      className={cn(
        "relative mx-auto box-border aspect-square w-full max-w-[16rem] min-[470px]:max-w-none min-[470px]:min-h-[80px]",
        fillContainer && "h-full min-h-0 min-[470px]:min-h-0",
        className,
      )}
    >
      <div className="absolute inset-0 min-h-0 min-w-0">
        <canvas ref={canvasRef} aria-label={ariaLabel ?? title} />
      </div>
    </div>
  );
}
