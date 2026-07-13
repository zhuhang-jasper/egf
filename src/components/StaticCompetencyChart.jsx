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
  // Drop the mobile max-width cap so the chart fills its container's width; height is then driven
  // purely by maxHeightPx. Without this the chart is capped at 16rem wide on mobile.
  fullWidth = false,
  // Explicit max-width (px) for the frame at all breakpoints. Use to hold the chart at one size so
  // it stops growing with the viewport; below this width it still shrinks with the page naturally.
  // Overrides the default 16rem mobile cap and the fullWidth uncapping.
  maxWidthPx,
  focusedPillars,
  maxHeightPx,
  // Which chart preset to render. "theory" (default) = compact labels, plain pillar names, no L
  // ticks. "tool" = emoji pillar labels and the tool chart's hand-tuned label nudges.
  purpose = "theory",
  // Override the preset's default label style: false forces emoji pillar labels on the theory
  // preset. Leave undefined to keep the preset default (theory = plain, tool = emoji).
  plainLabels,
  // Multiplier applied to the preset's computed point-label size, for a single chart that needs
  // larger labels than its preset (e.g. the theory hero radar). Leave undefined for 1×.
  pointLabelScale,
  // Fixed point-label size in px. When set, pins the label size regardless of chart width (so the
  // labels can track a fixed page font). Overrides pointLabelScale. Leave undefined for width-scaled.
  pointLabelPx,
  "aria-label": ariaLabel,
}) {
  const canvasRef = useRef(null);
  const frameRef = useRef(null);

  const chartState = useMemo(
    () => ({
      levels,
      title,
      trackVariant,
      purpose,
      plainLabels,
      pointLabelScale,
      pointLabelPx,
      levelsPolygonHidden: hidePolygon,
      chartLevelTicksHidden: true,
      pointLabelsHidden: hidePointLabels,
      focusedPillars,
      maxHeightPx,
    }),
    [levels, title, trackVariant, purpose, plainLabels, pointLabelScale, pointLabelPx, hidePolygon, hidePointLabels, focusedPillars, maxHeightPx],
  );

  useStaticCompetencyChart(canvasRef, frameRef, chartState);

  return (
    <div
      ref={frameRef}
      style={maxWidthPx ? { maxWidth: `${maxWidthPx}px` } : undefined}
      className={cn(
        "relative mx-auto box-border aspect-square w-full min-[470px]:max-w-none min-[470px]:min-h-[80px]",
        !fullWidth && !maxWidthPx && "max-w-[16rem]",
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
