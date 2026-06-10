import {
  getChartLayoutPadding,
  getChartPointLabelSizePx,
  getPointLabelPaddingPx,
  getRadarLabelReservedPx,
} from "@/lib/chart/fonts";
import { FE_UI, getChartLayoutLabels } from "@/lib/constants";

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
  if (angle === 0 || angle === 180) {
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
  const layoutLabels = getChartLayoutLabels(trackVariant);
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
    const y = radarYForDeg(pos.y, size.h, angleDeg);
    const left = radarLeftForAlign(pos.x, size.w, align);
    items.push({
      visible: true,
      x: pos.x,
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
  const u = FE_UI.chart;
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
  const reserve = getRadarLabelReservedPx(chart.width);
  const maxR = Math.min(cx - area.left - reserve, area.right - cx - reserve, cy - area.top - reserve, area.bottom - cy - reserve);

  scale.xCenter = cx;
  scale.yCenter = cy;
  if (Number.isFinite(maxR) && maxR > 0) {
    scale.drawingArea = Math.min(scale.drawingArea, maxR);
  }
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

  const pad = FE_UI.chartFrame.contentPadPx ?? 6;
  return Math.ceil(extents.maxY - extents.minY + pad * 2);
}

export function syncFontsForChart(chart) {
  const w = chart.width;
  if (!w) {
    return;
  }
  const cf = FE_UI.chartFonts;
  const ch = FE_UI.chart;
  const tickSize = Math.max(cf.tickMinPx, Math.round(w / cf.tickWidthDivisor));
  const labelSize = getChartPointLabelSizePx(w);
  const labelPadding = getPointLabelPaddingPx(w);
  const padding = getChartLayoutPadding(w);
  const rScale = chart.options.scales.r;
  const tickFont = rScale.ticks.font || {};
  const plFont = rScale.pointLabels.font || {};
  const plOpts = rScale.pointLabels;
  const layoutPad = chart.options.layout.padding;
  const paddingUnchanged =
    layoutPad?.top === padding.top &&
    layoutPad?.right === padding.right &&
    layoutPad?.bottom === padding.bottom &&
    layoutPad?.left === padding.left;
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
