import { getChartWidthUnit } from "@/chart/fonts";
import { getChartLayoutLabelsForChart, isTheoryChart, resolveChartUi } from "@/chart/theory-profile";
import { getPillarOrder } from "@/constants";

/**
 * Per-track, per-pillar pixel nudges for the chart axis labels, applied after the radar's automatic
 * placement. Keyed by track variant, then pillar id: `{ x, y }` shifts the label right/down.
 * Empty by default — populate to relieve crowding on specific axes.
 *
 * Tuned for the interactive tool chart. The theory career-track charts are sized differently, so
 * they have their own {@link THEORY_PILLAR_LABEL_NUDGE}.
 */
const PILLAR_LABEL_NUDGE = {
  fe: {
    coding: { x: -5, y: 0 },
    domainLogic: { x: -8, y: 15 },
    architecture: { x: 9, y: 15 },
    uiUx: { x: -1, y: 15 },
    ai: { x: 3, y: 15 },
    productSense: { x: -1, y: -7 },
    process: { x: 2, y: -7 },
  },
  be: {
    coding: { x: -5, y: 0 },
    domainLogic: { x: -5, y: 10 },
    architecture: { x: 6, y: 10 },
    ai: { x: 2, y: 0 },
    communication: { x: -5, y: -10 },
    process: { x: 6, y: -10 },
    ownership: { x: -5, y: 0 },
  },
};

/**
 * Nudges for the theory career-track charts. Cloned from {@link PILLAR_LABEL_NUDGE} as a starting
 * point — adjust independently since the theory charts render at a different size.
 */
const THEORY_PILLAR_LABEL_NUDGE = {
  fe: {
    domainLogic: { x: -5, y: 10 },
    architecture: { x: 5, y: 10 },
    uiUx: { x: -2, y: 10 },
    ai: { x: 2, y: 10 },
    productSense: { x: -2, y: -7 },
    process: { x: 2, y: -7 },
  },
};

function getPillarLabelNudge(nudgeMap, trackVariant, pillarId) {
  return nudgeMap[trackVariant]?.[pillarId] ?? { x: 0, y: 0 };
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

  const trackVariant = scale.chart?.options?.plugins?.clusterBackground?.trackVariant ?? "fe";
  const layoutLabels = getChartLayoutLabelsForChart(scale.chart, trackVariant);
  const pillarOrder = getPillarOrder(trackVariant);
  // Tool and theory charts render at different sizes, so each has its own hand-tuned nudge map.
  const nudgeMap = isTheoryChart(scale.chart) ? THEORY_PILLAR_LABEL_NUDGE : PILLAR_LABEL_NUDGE;
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
    const nudge = getPillarLabelNudge(nudgeMap, trackVariant, pillarOrder[i]);
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
  const reserve = Math.round(minPx + uWidth * (maxPx - minPx));
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
  return Math.round(minPx + u * (maxPx - minPx));
}

function getChartLayoutPaddingForUi(chartWidthPx, ui) {
  const u = getChartWidthUnit(chartWidthPx);
  const { minPx, maxPx } = ui.chart.layoutPaddingHorizontal;
  const horizontal = Math.round(minPx + u * (maxPx - minPx));
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
  const labelSize = getChartPointLabelSizePxForUi(w, ui);
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
