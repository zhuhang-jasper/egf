import { getChartWidthUnit } from "@/chart/fonts";
import { getChartLayoutLabelsForChart, isHeroChart, isTheoryChart, resolveChartUi } from "@/chart/theory-profile";
import { getPillarOrder } from "@/constants";

/**
 * Per-pillar pixel nudges for the chart axis labels, applied after the radar's automatic
 * placement. Keyed by pillar id: `{ x, y }` shifts the label right/down.
 *
 * Tuned for the interactive tool chart. The theory career-track charts are sized differently, so
 * they have their own {@link THEORY_PILLAR_LABEL_NUDGE}.
 */
const PILLAR_LABEL_NUDGE = {
  coding: { x: -5, y: 0 },
  domainLogic: { x: -8, y: 15 },
  architecture: { x: 9, y: 15 },
  uiUx: { x: -1, y: 15 },
  ai: { x: 3, y: 15 },
  productSense: { x: -1, y: -7 },
  process: { x: 2, y: -7 },
};

/**
 * Nudges for the theory career-track charts (the small per-track profiles in CareerTracks, ~180px).
 * Kept at the older, more conservative values — adjust independently of the hero radar.
 */
const CAREER_TRACK_PILLAR_LABEL_NUDGE = {
  domainLogic: { x: -5, y: 10 },
  architecture: { x: 5, y: 10 },
  uiUx: { x: -2, y: 10 },
  ai: { x: 2, y: 10 },
  productSense: { x: -2, y: -7 },
  process: { x: 2, y: -7 },
};

/**
 * Nudges for the theory hero radar (the large empty chart at the top of the theory tab). Tuned
 * independently of {@link CAREER_TRACK_PILLAR_LABEL_NUDGE} since it renders much larger.
 */
const HERO_PILLAR_LABEL_NUDGE = {
  domainLogic: { x: -10, y: 20 },
  architecture: { x: 10, y: 20 },
  uiUx: { x: -3, y: 15 },
  ai: { x: 3, y: 15 },
  productSense: { x: -3, y: -10 },
  process: { x: 3, y: -10 },
};

function getPillarLabelNudge(nudgeMap, pillarId) {
  return nudgeMap[pillarId] ?? { x: 0, y: 0 };
}

function radarTickBackdropHalf(scale) {
  const tickOpts = scale.options.ticks;
  if (!tickOpts.display || !scale.options.display) {
    return 0;
  }
  const bp = tickOpts.backdropPadding || {};
  const padY = (Number(bp.top) || 0) + (Number(bp.bottom) || 0);
  const fs = (tickOpts.font && tickOpts.font.size) || 12;
  return (fs + padY) / 2;
}

function radarNormAngleRad(a) {
  const t = Math.PI * 2;
  a %= t;
  return a < 0 ? a + t : a;
}

function radarTextAlignForDeg(angle) {
  // Center the top/bottom axes (0° / 180°). A small tolerance guards against floating-point drift
  // that can leave an exactly-vertical axis (e.g. Ownership at the 8-pillar bottom) at 179°/181°.
  const ALIGN_TOL = 1;
  if (angle <= ALIGN_TOL || angle >= 360 - ALIGN_TOL || Math.abs(angle - 180) <= ALIGN_TOL) {
    return "center";
  }
  if (angle < 180) {
    return "left";
  }
  return "right";
}

function radarLeftForAlign(x, w, align) {
  if (align === "right") {
    return x - w;
  }
  if (align === "center") {
    return x - w / 2;
  }
  return x;
}

function radarYForDeg(y, h, angle) {
  if (angle === 90 || angle === 270) {
    return y - h / 2;
  }
  if (angle > 270 || angle < 90) {
    return y - h;
  }
  return y;
}

function radarMeasureLabel(ctx, fontWeight, fontSizePx, family, text) {
  ctx.save();
  ctx.font = `${fontWeight || "normal"} ${fontSizePx}px ${family || "system-ui, sans-serif"}`;
  const w = ctx.measureText(String(text)).width;
  ctx.restore();
  return { w, h: fontSizePx * 1.2 };
}

function rebuildRadarPointLabelItems(scale) {
  const count = scale._pointLabels?.length;
  if (!count || !scale.ctx) {
    return;
  }

  const layoutLabels = getChartLayoutLabelsForChart(scale.chart);
  const pillarOrder = getPillarOrder();
  // Each chart renders at a different size, so each has its own hand-tuned nudge map: the tool
  // chart, the theory hero radar, and the small career-track profiles.
  let nudgeMap = PILLAR_LABEL_NUDGE;
  if (isTheoryChart(scale.chart)) {
    nudgeMap = isHeroChart(scale.chart) ? HERO_PILLAR_LABEL_NUDGE : CAREER_TRACK_PILLAR_LABEL_NUDGE;
  }
  const plOpts = scale.options.pointLabels;
  const valueCount = count;
  const addAngle = plOpts.centerPointLabels ? Math.PI / valueCount : 0;
  const extra = radarTickBackdropHalf(scale);
  const items = [];
  const { ctx } = scale;

  for (let i = 0; i < valueCount; i++) {
    const opts = plOpts.setContext(scale.getPointLabelContext(i));
    const pad = opts.padding;
    const f = opts.font || {};
    const fSize = f.size || 12;
    const fWeight = f.weight || "normal";
    const { family } = f;
    const size = radarMeasureLabel(ctx, fWeight, fSize, family, layoutLabels[i] ?? "");
    const pos = scale.getPointPosition(i, scale.drawingArea + extra + pad, addAngle);
    let angleDeg = Math.round((radarNormAngleRad(pos.angle + Math.PI / 2) * 180) / Math.PI);
    angleDeg %= 360;
    if (angleDeg < 0) {
      angleDeg += 360;
    }
    const align = radarTextAlignForDeg(angleDeg);
    const nudge = getPillarLabelNudge(nudgeMap, pillarOrder[i]);
    const x = pos.x + nudge.x;
    const y = radarYForDeg(pos.y, size.h, angleDeg) + nudge.y;
    const left = radarLeftForAlign(x, size.w, align);
    items.push({
      visible: true,
      x,
      y,
      textAlign: align,
      left,
      top: y,
      right: left + size.w,
      bottom: y + size.h,
    });
  }
  scale._pointLabelItems = items;
}

function getPointLabelExtents(items) {
  let minY = Infinity;
  let maxY = -Infinity;
  for (const item of items ?? []) {
    if (!item?.visible) {
      continue;
    }
    minY = Math.min(minY, item.top);
    maxY = Math.max(maxY, item.bottom);
  }
  if (!Number.isFinite(minY) || !Number.isFinite(maxY)) {
    return null;
  }
  return { minY, maxY };
}

export function applyRadarCenterFit(scale) {
  const ui = resolveChartUi(scale.chart);
  const u = ui.chart;
  if (!u.radarCenterFix) {
    return;
  }
  const { chart } = scale;
  const area = chart.chartArea;
  if (!area || area.width < 2 || area.height < 2) {
    return;
  }

  const cx = area.left + area.width / 2;
  const cy = area.top + area.height / 2;
  const uWidth = getChartWidthUnit(chart.width);
  const { minPx, maxPx } = u.radarLabelReserved;
  // Not rounded — a stepped reserve resizes the radar radius by 1px at a width threshold, which the
  // frame-fit then amplifies into a visible jump. Fractional keeps the radius scaling continuous.
  const reserve = minPx + uWidth * (maxPx - minPx);
  const maxR = Math.min(cx - area.left - reserve, area.right - cx - reserve);

  scale.xCenter = cx;
  scale.yCenter = cy;
  let radius = scale.drawingArea;
  if (Number.isFinite(maxR) && maxR > 0) {
    radius = Math.min(radius, maxR);
  }
  // When a fixed radius is locked in (so FE & BE render identically sized regardless
  // of how Chart.js fits each track's labels), use it verbatim — it is already <= maxR.
  const locked = chart.$radarLockedRadius;
  if (Number.isFinite(locked) && locked > 0) {
    radius = locked;
  }
  scale.drawingArea = radius;
  rebuildRadarPointLabelItems(scale);

  const extents = getPointLabelExtents(scale._pointLabelItems);
  if (extents) {
    const span = extents.maxY - extents.minY;
    const centeredMinY = (chart.height - span) / 2;
    const shiftY = extents.minY - centeredMinY;
    if (Math.abs(shiftY) > 0.5) {
      scale.yCenter -= shiftY;
      rebuildRadarPointLabelItems(scale);
    }
  }
}

/** Tight canvas height: label span plus equal top/bottom pad (labels centered vertically in afterFit). */
export function getRadarContentHeightPx(chart) {
  const extents = getPointLabelExtents(chart.scales?.r?._pointLabelItems);
  if (!extents) {
    return null;
  }

  const ui = resolveChartUi(chart);
  const pad = ui.chartFrame.contentPadPx ?? 6;
  return Math.ceil(extents.maxY - extents.minY + pad * 2);
}

/**
 * Linearly interpolate a point-label size (px) across chart width for a per-chart
 * `pointLabelPxRange = { minPx, maxPx, minWidthPx, maxWidthPx }`. Below minWidthPx the size is
 * minPx, above maxWidthPx it is maxPx, and it ramps linearly between — so the labels scale with the
 * chart the same way its overall size does. Used by the theory hero radar.
 *
 * The result is intentionally NOT rounded: an integer font size can only reach the max via the
 * intermediate integers (12→13→14), and each crossing is a visible 1px pop as the chart scales.
 * Returning a fractional px (canvas renders these fine) makes the label track the chart continuously.
 */
function getPointLabelSizePxFromRange(chartWidthPx, range) {
  const { minPx, maxPx, minWidthPx, maxWidthPx } = range;
  if (maxWidthPx <= minWidthPx) {
    return maxPx;
  }
  const t = Math.max(0, Math.min(1, (chartWidthPx - minWidthPx) / (maxWidthPx - minWidthPx)));
  return minPx + t * (maxPx - minPx);
}

function getChartPointLabelSizePxForUi(chartWidthPx, ui) {
  const cf = ui.chartFonts;
  const ch = ui.chart;
  let labelSize = ch.pointLabelPx;
  if (ch.pointLabelScaleWithChart) {
    const ref = cf.pointLabelRefWidthPx || 380;
    labelSize = Math.round((ch.pointLabelPx * chartWidthPx) / ref);
    labelSize = Math.max(cf.pointLabelMinPx, labelSize);
    if (cf.pointLabelMaxPx != null) {
      labelSize = Math.min(cf.pointLabelMaxPx, labelSize);
    }
  }
  return labelSize;
}

function getPointLabelPaddingPxForUi(chartWidthPx, ui) {
  const u = getChartWidthUnit(chartWidthPx);
  const { minPx, maxPx } = ui.chart.pointLabelPaddingRange ?? { minPx: 5, maxPx: 12 };
  // Not rounded: label padding offsets each label's position outward, and the frame height is fit to
  // the resulting label span. A rounded (stepped) padding makes labels jump 1px outward at a width
  // threshold, which pops the whole frame bigger — keep it fractional so the chart scales smoothly.
  return minPx + u * (maxPx - minPx);
}

function getChartLayoutPaddingForUi(chartWidthPx, ui) {
  const u = getChartWidthUnit(chartWidthPx);
  const { minPx, maxPx } = ui.chart.layoutPaddingHorizontal;
  // Not rounded — this padding narrows the drawing area (hence the radius, hence the label span the
  // frame is fit to). A stepped value pops the chart size at a width threshold; fractional is smooth.
  const horizontal = minPx + u * (maxPx - minPx);
  return { top: 0, right: horizontal, bottom: 0, left: horizontal };
}

export function syncFontsForChart(chart) {
  const w = chart.width;
  if (!w) {
    return;
  }
  const ui = resolveChartUi(chart);
  const cf = ui.chartFonts;
  const ch = ui.chart;
  const tickSize = Math.max(cf.tickMinPx, Math.round(w / cf.tickWidthDivisor));
  const cc = chart?.options?.plugins?.competencyChart;
  // Label-size precedence, most specific first:
  //   1. pointLabelPxRange — linearly interpolate minPx→maxPx across chart width (theory hero radar,
  //      so its labels scale fluidly with the chart between two chosen sizes).
  //   2. pointLabelPx — a fixed px that pins the label regardless of chart width.
  //   3. preset width-scaling (× optional pointLabelScale) — every other chart.
  let labelSize;
  if (cc?.pointLabelPxRange) {
    labelSize = getPointLabelSizePxFromRange(w, cc.pointLabelPxRange);
  } else if (cc?.pointLabelPx != null) {
    labelSize = cc.pointLabelPx;
  } else {
    labelSize = Math.round(getChartPointLabelSizePxForUi(w, ui) * (cc?.pointLabelScale ?? 1));
  }
  const labelPadding = getPointLabelPaddingPxForUi(w, ui);
  const padding = getChartLayoutPaddingForUi(w, ui);
  const rScale = chart.options.scales.r;
  const tickFont = rScale.ticks.font || {};
  const plFont = rScale.pointLabels.font || {};
  const plOpts = rScale.pointLabels;
  const layoutPad = chart.options.layout.padding;
  const paddingUnchanged =
    layoutPad?.top === padding.top && layoutPad?.right === padding.right && layoutPad?.bottom === padding.bottom && layoutPad?.left === padding.left;
  if (tickFont.size === tickSize && plFont.size === labelSize && plOpts.padding === labelPadding && paddingUnchanged) {
    return;
  }
  chart.options.layout.padding = padding;
  rScale.ticks.font = { ...tickFont, size: tickSize };
  rScale.pointLabels.padding = labelPadding;
  rScale.pointLabels.font = {
    ...plFont,
    size: labelSize,
    weight: ch.pointLabelWeight,
  };
  chart.update("none");
}
