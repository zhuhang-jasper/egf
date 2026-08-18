import { FE_UI } from "@/constants";

/** 0 at {@link FE_UI.page.chartMinWidthPx}, 1 at chartMaxWidthPx — frame widths, not page widths. */
export function getChartWidthUnit(chartWidthPx) {
  const { chartMinWidthPx, chartMaxWidthPx } = FE_UI.page;
  if (chartMaxWidthPx <= chartMinWidthPx) {
    return 1;
  }
  return Math.max(0, Math.min(1, (chartWidthPx - chartMinWidthPx) / (chartMaxWidthPx - chartMinWidthPx)));
}

/** Linear interpolation across chart width between a range's two authored endpoints, clamped outside them. */
function interpolateRange(chartWidthPx, { minPx, maxPx, minWidthPx, maxWidthPx }) {
  if (maxWidthPx <= minWidthPx) {
    return maxPx;
  }
  const t = Math.max(0, Math.min(1, (chartWidthPx - minWidthPx) / (maxWidthPx - minWidthPx)));
  return minPx + t * (maxPx - minPx);
}

/**
 * Track badge + cluster legend — AUTHORED INTEGER RUNGS, not a curve. See {@link FE_UI.chart.secondaryLabelRungs}
 * for why both properties matter: integers stop the badge's glyphs creeping, and authoring the boundaries stops
 * `Math.round` placing them at whatever width the value happens to cross `.5`.
 */
export function getChartSecondaryLabelSizePx(chartWidthPx) {
  const { secondaryLabelRungs: rungs, secondaryLabelMinPx } = FE_UI.chart;
  for (const rung of rungs) {
    // `fromChartWidthPx` absent = the top rung, which everything at or above the previous boundary falls into.
    if (rung.fromChartWidthPx == null || chartWidthPx >= rung.fromChartWidthPx) {
      return rung.px;
    }
  }
  return secondaryLabelMinPx ?? rungs.at(-1).px;
}

/* No badge-height helper here on purpose: rounding a ratio of the fractional getChartTitleSizePx made the md
   pill's height step as the chart resized. It sizes from `em` padding now — see components/TrackBadge.jsx. */

export function getPointLabelPaddingPx(chartWidthPx) {
  const u = getChartWidthUnit(chartWidthPx);
  const { minPx, maxPx } = FE_UI.chart.pointLabelPaddingRange ?? { minPx: 5, maxPx: 12 };
  return Math.round(minPx + u * (maxPx - minPx));
}

export function getChartLayoutPadding(chartWidthPx) {
  const u = getChartWidthUnit(chartWidthPx);
  const { minPx, maxPx } = FE_UI.chart.layoutPaddingHorizontal;
  const horizontal = Math.round(minPx + u * (maxPx - minPx));
  return { top: 0, right: horizontal, bottom: 0, left: horizontal };
}

export function getRadarLabelReservedPx(chartWidthPx) {
  const u = getChartWidthUnit(chartWidthPx);
  const { minPx, maxPx } = FE_UI.chart.radarLabelReserved;
  return Math.round(minPx + u * (maxPx - minPx));
}

/**
 * Legend swatch edge — a ratio of the label rung it sits beside, rounded to whole px.
 *
 * Rounded because the label is: a fractional square next to integer text lands its edges off the device-pixel
 * grid, and at this size (12-14px) that reads as a soft border on one side. Since the label now comes from a
 * rung table there are only a few distinct values, so this rounds a handful of times rather than continuously —
 * the ratio wobble that made an earlier rounded version drift (1.17-1.23 instead of 1.2) came from rounding an
 * already-rounded CURVE at every width, which no longer happens.
 */
export function getClusterLegendSwatchPx(chartWidthPx) {
  return Math.round(getChartSecondaryLabelSizePx(chartWidthPx) * FE_UI.chart.legendSwatchLabelMultiplier);
}

/**
 * Chart title — {@link FE_UI.chart.titleRange}'s two authored endpoints, interpolated, ROUNDED to whole px.
 * Both the tool's chart title and the theory tab's framework title set the result straight onto `font-size`.
 *
 * ROUNDED, and it was fractional until the title row exposed why it cannot be. The row reserves
 * `titleSizePx * 1.25` as its `minHeight` so the badge holds still when the profile name is toggled off, and
 * `leading-tight` gives the rendered <h2> the same 1.25 — so the two must agree EXACTLY. A fractional size makes
 * both fractional, and then `items-center` has a sub-pixel to split, which is the 1px badge shift
 * (docs/DECISIONS.md#badge-ink-centring). Flooring the row instead was tried and was worse: it made the row
 * SHORTER than the line box, so mounting the title grew the row and everything below it moved.
 *
 * An integer size makes `x * 1.25` land on x.0 or x.5 — close enough that no sub-pixel remains — while the row
 * and the line box stay identical by construction. The title steps 1px at a time across the range, which at
 * 14-18px is not perceptible; the badge and legend step too, by design (getChartSecondaryLabelSizePx).
 *
 * At `chartMaxWidthPx` this returns `titleRange.maxPx` exactly, which is the export's title size and so what
 * `opsz` must match (index.css). Keep `titleRange`'s endpoints whole so that stays exact.
 */
export function getChartTitleSizePx(chartWidthPx) {
  return Math.round(interpolateRange(chartWidthPx, FE_UI.chart.titleRange));
}

/** Initial frame height before label bounds are measured from the live chart. */
export function getChartFrameEstimatedHeightPx(chartWidthPx) {
  const ratio = FE_UI.chartFrame.heightWidthRatio;
  const minH = FE_UI.chartFrame.minChartHeightPx ?? 120;
  return Math.round(Math.max(minH, chartWidthPx * ratio));
}

export function applyChartFrameLayout(frameEl, chartWidthPx, contentHeightPx = null) {
  const minH = FE_UI.chartFrame.minChartHeightPx ?? 120;
  const innerH = Math.round(Math.max(minH, contentHeightPx ?? getChartFrameEstimatedHeightPx(chartWidthPx)));

  frameEl.style.margin = "0 auto";
  frameEl.style.aspectRatio = "unset";
  frameEl.style.height = `${innerH}px`;
}
