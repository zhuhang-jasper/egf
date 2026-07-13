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
  // Show the L1–L5 radial tick labels. Off by default (the theory doc charts render without them);
  // the hero radar turns this on so the empty chart still reads as a 5-level scale.
  showLevelTicks = false,
  fillContainer = false,
  // Drop the mobile max-width cap so the chart fills its container's width; height is then driven
  // purely by maxHeightPx. Without this the chart is capped at 16rem wide on mobile.
  fullWidth = false,
  // Explicit max-width (px) for the frame at all breakpoints. Use to hold the chart at one size so
  // it stops growing with the viewport; below this width it still shrinks with the page naturally.
  // Overrides the default 16rem mobile cap and the fullWidth uncapping.
  maxWidthPx,
  focusedPillars,
  // Color each pillar axis label by its cluster (the poster's pillar-name palette,
  // CLUSTERS[cluster].textColor) instead of the flat preset color.
  clusterLabelColors = false,
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
  // Point-label size range { minPx, maxPx, minWidthPx, maxWidthPx }. When set, the label size ramps
  // linearly from minPx→maxPx as the chart width goes minWidthPx→maxWidthPx (clamped at the ends),
  // so labels scale fluidly with the chart. Takes precedence over pointLabelPx/pointLabelScale.
  pointLabelPxRange,
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
      pointLabelPxRange,
      levelsPolygonHidden: hidePolygon,
      chartLevelTicksHidden: !showLevelTicks,
      pointLabelsHidden: hidePointLabels,
      focusedPillars,
      clusterLabelColors,
      maxHeightPx,
    }),
    [
      levels,
      title,
      trackVariant,
      purpose,
      plainLabels,
      pointLabelScale,
      pointLabelPx,
      pointLabelPxRange,
      hidePolygon,
      hidePointLabels,
      showLevelTicks,
      focusedPillars,
      clusterLabelColors,
      maxHeightPx,
    ],
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
