import { getChartWidthUnit } from "@/chart/fonts";
import { getChartLayoutLabelsForChart, isHeroChart, isTheoryChart, resolveChartUi } from "@/chart/theory-profile";
import { FE_UI, getPillarOrder } from "@/constants";

/**
 * Per-pillar pixel nudges for the chart axis labels, applied after the radar's automatic placement.
 * Keyed by pillar id: `{ x, y }` shifts the label right/down. Values at the FULL-SIZE chart (526px) — the
 * far endpoint of a ramp whose near end is {@link PILLAR_LABEL_NUDGE_MIN}; tune against the desktop chart.
 */
const PILLAR_LABEL_NUDGE = {
  // coding: { x: -5, y: 0 },
  domainLogic: { x: -10, y: 17 },
  architecture: { x: 10, y: 17 },
  uiUx: { x: -2, y: 15 },
  ai: { x: 2, y: 15 },
  productSense: { x: -2, y: -10 },
  process: { x: 2, y: -10 },
};

/**
 * Nudges for the theory career-track charts (the small per-track profiles in CareerTracks, ~180px).
 * Kept at the older, more conservative values — adjust independently of the hero radar.
 */
const CAREER_TRACK_PILLAR_LABEL_NUDGE = {
  domainLogic: { x: -7, y: 10 },
  architecture: { x: 7, y: 10 },
  uiUx: { x: -2, y: 10 },
  ai: { x: 2, y: 10 },
  productSense: { x: -4, y: -7 },
  process: { x: 4, y: -7 },
};

/**
 * The theory hero radar renders at essentially the same size as the tool chart, so it shares that
 * chart's nudges rather than carrying a near-duplicate map that has to be kept in sync. (The small
 * career-track profiles still need their own — see {@link CAREER_TRACK_PILLAR_LABEL_NUDGE}.)
 */
const HERO_PILLAR_LABEL_NUDGE = PILLAR_LABEL_NUDGE;

/**
 * Nudges at the NARROW end of the ramp (302px), interpolated against {@link PILLAR_LABEL_NUDGE}'s 526px
 * values. Two hand-tuned endpoints, not one endpoint and a ratio — see
 * docs/DECISIONS.md#cluster-nudge-ramp-is-two-endpoints-not-a-ratio before collapsing this back to one.
 */
const PILLAR_LABEL_NUDGE_MIN = {
  domainLogic: { x: -7, y: 13 },
  architecture: { x: 7, y: 13 },
  uiUx: { x: -2, y: 15 },
  ai: { x: 2, y: 15 },
  productSense: { x: -2, y: -5 },
  process: { x: 2, y: -5 },
};

const ZERO_NUDGE = { x: 0, y: 0 };

/**
 * A pillar's nudge at this chart width: linear between `PILLAR_LABEL_NUDGE_MIN` and the map's own tuned
 * value, on the same `getChartWidthUnit` ramp the label size runs off. `preScaled` maps (career-track
 * profiles, already tuned at their own small size) pass through verbatim.
 */
function getPillarLabelNudge(nudgeMap, pillarId, widthUnit, preScaled) {
  const far = nudgeMap[pillarId];
  if (!far) {
    return ZERO_NUDGE;
  }
  if (preScaled) {
    return far;
  }
  const near = PILLAR_LABEL_NUDGE_MIN[pillarId] ?? ZERO_NUDGE;
  return {
    x: near.x + widthUnit * (far.x - near.x),
    y: near.y + widthUnit * (far.y - near.y),
  };
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
  // chart, the theory hero radar (both interpolated by width), and the pre-scaled career-track profiles.
  let nudgeMap = PILLAR_LABEL_NUDGE;
  let nudgePreScaled = false;
  if (isTheoryChart(scale.chart)) {
    const hero = isHeroChart(scale.chart);
    nudgeMap = hero ? HERO_PILLAR_LABEL_NUDGE : CAREER_TRACK_PILLAR_LABEL_NUDGE;
    nudgePreScaled = !hero;
  }
  const nudgeWidthUnit = getChartWidthUnit(scale.chart?.width ?? 0);
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
    const nudge = getPillarLabelNudge(nudgeMap, pillarOrder[i], nudgeWidthUnit, nudgePreScaled);
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
  // The hero radar takes the tool chart's pad rather than its own preset's: it is sized to match the
  // tool chart, and pad is added twice (top + bottom), so the theory preset's larger value left the
  // hero's frame 4px taller. The small career-track charts keep the theory preset's pad — they clamp
  // at maxHeightPx, so changing it there risks shrinking their radars.
  const pad = (isHeroChart(chart) ? FE_UI.chartFrame.contentPadPx : ui.chartFrame.contentPadPx) ?? 6;
  return Math.ceil(extents.maxY - extents.minY + pad * 2);
}

/**
 * Linearly interpolate a point-label size across chart width for a `pointLabelPxRange`, clamping outside the
 * width bounds. This is how EVERY radar sizes its axis labels.
 *
 * Intentionally NOT rounded: an integer size reaches its max through the intermediate integers, and each
 * crossing is a visible 1px pop as the chart scales. Canvas renders fractional sizes fine.
 */
function getPointLabelSizePxFromRange(chartWidthPx, range) {
  const { minPx, maxPx, minWidthPx, maxWidthPx } = range;
  if (maxWidthPx <= minWidthPx) {
    return maxPx;
  }
  const t = Math.max(0, Math.min(1, (chartWidthPx - minWidthPx) / (maxWidthPx - minWidthPx)));
  return minPx + t * (maxPx - minPx);
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
  // Label-size precedence, most specific first: a per-chart range (how the theory hero borrows the tool
  // chart's ramp), then a per-chart fixed px, then the preset's own range. All three are fractional, and
  // there is deliberately no stepped fallback: the preset ramp is the floor and both presets define one.
  let labelSize;
  if (cc?.pointLabelPxRange) {
    labelSize = getPointLabelSizePxFromRange(w, cc.pointLabelPxRange);
  } else if (cc?.pointLabelPx != null) {
    labelSize = cc.pointLabelPx;
  } else {
    labelSize = getPointLabelSizePxFromRange(w, ch.pointLabelPxRange);
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
