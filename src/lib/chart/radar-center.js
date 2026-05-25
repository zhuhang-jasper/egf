import { FE_UI } from "@/lib/constants";

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
  const labels = scale._pointLabels;
  const count = labels && labels.length;
  if (!count || !scale.ctx) {
    return;
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
    const size = radarMeasureLabel(ctx, fWeight, fSize, family, labels[i]);
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
  const reserve = u.radarLabelReservedPx;
  const maxR = Math.min(cx - area.left - reserve, area.right - cx - reserve, cy - area.top - reserve, area.bottom - cy - reserve);

  scale.xCenter = cx;
  scale.yCenter = cy;
  if (Number.isFinite(maxR) && maxR > 0) {
    scale.drawingArea = Math.min(scale.drawingArea, maxR);
  }
  rebuildRadarPointLabelItems(scale);
}

export function syncFontsForChart(chart) {
  const w = chart.width;
  if (!w) {
    return;
  }
  const cf = FE_UI.chartFonts;
  const ch = FE_UI.chart;
  const tickSize = Math.max(cf.tickMinPx, Math.round(w / cf.tickWidthDivisor));
  let labelSize = ch.pointLabelPx;
  if (ch.pointLabelScaleWithChart) {
    const ref = cf.pointLabelRefWidthPx || 380;
    labelSize = Math.round((ch.pointLabelPx * w) / ref);
    labelSize = Math.max(cf.pointLabelMinPx, labelSize);
    if (cf.pointLabelMaxPx != null) {
      labelSize = Math.min(cf.pointLabelMaxPx, labelSize);
    }
  }
  const rScale = chart.options.scales.r;
  const tickFont = rScale.ticks.font || {};
  const plFont = rScale.pointLabels.font || {};
  if (tickFont.size === tickSize && plFont.size === labelSize) {
    return;
  }
  rScale.ticks.font = { ...tickFont, size: tickSize };
  rScale.pointLabels.font = {
    ...plFont,
    size: labelSize,
    weight: ch.pointLabelWeight,
  };
  chart.update("none");
}
