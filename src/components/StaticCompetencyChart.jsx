import { useEffect, useMemo, useRef } from "react";

import { useStaticCompetencyChart } from "@/hooks/useStaticCompetencyChart";

import { cn } from "@/utils";

/**
 * Standalone radar chart for documentation — compact labels, no L ticks, plain pillar names.
 */
export function StaticCompetencyChart({
  levels,
  title = " ",
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
  // Fixed point-label size in px. When set, pins the label size regardless of chart width (so the
  // labels can track a fixed page font). Leave undefined to use the preset's own width ramp.
  pointLabelPx,
  // Point-label size range { minPx, maxPx, minWidthPx, maxWidthPx }, overriding the preset's own.
  // The label size ramps linearly from minPx→maxPx as the chart width goes minWidthPx→maxWidthPx
  // (clamped at the ends). Takes precedence over pointLabelPx — the hero radar sets this to borrow
  // the tool chart's ramp rather than the theory preset's smaller one.
  pointLabelPxRange,
  // Use the theory hero radar's label-nudge map instead of the career-track charts' map. Only the
  // large empty hero radar at the top of the theory tab sets this.
  heroLabelNudge = false,
  // Animate the radar points tweening from their old values to the new ones when only `levels`
  // changes (base geometry/labels stay put). Off by default — most charts swap data instantly.
  animateDataChanges = false,
  // Render pillar spokes as emoji only (no text), and drop the focus-dimming of non-key pillars along
  // with them. Takes precedence over plainLabels. The caller owns the decision — charts that share a
  // layout should share one source for it so they all swap at once (see CareerTracks).
  emojiOnlyLabels = false,
  // Called with the frame width this chart measured, whenever it changes. For chrome OUTSIDE the chart that
  // has to scale with it — the theory tab's framework title sits above the hero radar and sizes itself from
  // this, the same way the tool tab's chart title sizes itself from useCompetencyChart's `frameWidth`.
  //
  // It republishes the fit hook's existing measurement rather than exposing a ref to observe: the frame is
  // already under one ResizeObserver driving the fit, and a caller measuring the same box again would be a
  // second observer and a second layout read per frame for a number this one already has.
  onFrameWidthChange,
  "aria-label": ariaLabel,
}) {
  const canvasRef = useRef(null);
  const frameRef = useRef(null);

  const chartState = useMemo(
    () => ({
      levels,
      title,
      purpose,
      plainLabels,
      emojiOnlyLabels,
      pointLabelPx,
      pointLabelPxRange,
      levelsPolygonHidden: hidePolygon,
      chartLevelTicksHidden: !showLevelTicks,
      pointLabelsHidden: hidePointLabels,
      focusedPillars,
      clusterLabelColors,
      maxHeightPx,
      heroLabelNudge,
      animateDataChanges,
    }),
    [
      levels,
      title,
      purpose,
      plainLabels,
      emojiOnlyLabels,
      pointLabelPx,
      pointLabelPxRange,
      hidePolygon,
      hidePointLabels,
      showLevelTicks,
      focusedPillars,
      clusterLabelColors,
      maxHeightPx,
      heroLabelNudge,
      animateDataChanges,
    ],
  );

  const { frameWidth, canvasEpoch } = useStaticCompetencyChart(canvasRef, frameRef, chartState);

  // Effect rather than a call during render: this notifies a PARENT, and setting parent state while this
  // component is rendering is the "cannot update a component while rendering a different component" warning.
  // `frameWidth` only changes when the box is actually resized, so this settles immediately at each size.
  useEffect(() => {
    if (frameWidth) {
      onFrameWidthChange?.(frameWidth);
    }
  }, [frameWidth, onFrameWidthChange]);

  return (
    <div
      ref={frameRef}
      // The box whose inline `height` the fit writes (applyChartFrameLayout). Named so print CSS can
      // release that height without counting `> div` levels — see the foundational-grid and hero rules
      // in index.css, both of which have to undo a pinned screen height on paper.
      data-radar-frame
      style={maxWidthPx ? { maxWidth: `${maxWidthPx}px` } : undefined}
      className={cn(
        "relative mx-auto box-border aspect-square w-full xs:max-w-none xs:min-h-[80px]",
        !fullWidth && !maxWidthPx && "max-w-[16rem]",
        fillContainer && "h-full min-h-0 xs:min-h-0",
        className,
      )}
    >
      <div className="absolute inset-0 min-h-0 min-w-0">
        {/* `key` IS THE RECOVERY — see the same canvas in ChartSection.jsx. */}
        <canvas key={canvasEpoch} ref={canvasRef} data-radar-canvas aria-label={ariaLabel ?? title} />
      </div>
    </div>
  );
}
