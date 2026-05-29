import { CLUSTERS, FE_UI, getAiPillarIndices, PILLAR_GROUP_ORDER, PILLAR_ORDER } from "@/lib/constants";

/** Clockwise arc order for a cluster's pillar indices on the radar (handles wrap-around). */
function sortClusterArc(indices, total) {
  const sorted = [...new Set(indices)].filter((i) => i >= 0 && i < total).sort((a, b) => a - b);
  if (sorted.length <= 1) {
    return sorted;
  }

  let maxGap = -1;
  let gapAfter = -1;
  for (let j = 0; j < sorted.length; j++) {
    const cur = sorted[j];
    const next = sorted[(j + 1) % sorted.length];
    const gap = j < sorted.length - 1 ? next - cur : total - cur + sorted[0];
    if (gap > maxGap) {
      maxGap = gap;
      gapAfter = j;
    }
  }
  const start = (gapAfter + 1) % sorted.length;
  const arc = [];
  for (let k = 0; k < sorted.length; k++) {
    arc.push(sorted[(start + k) % sorted.length]);
  }
  return arc;
}

/** Midpoint on the outer polygon edge between two adjacent pillar axes (stays inside the n-gon). */
function getOuterEdgeMidpoint(scale, fromIndex, toIndex, value) {
  const ptFrom = scale.getPointPositionForValue(fromIndex, value);
  const ptTo = scale.getPointPositionForValue(toIndex, value);
  return { x: (ptFrom.x + ptTo.x) / 2, y: (ptFrom.y + ptTo.y) / 2 };
}

function drawClusterWedge(ctx, scale, indices, color, total) {
  if (indices.length === 0) {
    return;
  }
  const { xCenter: cx, yCenter: cy, max } = scale;
  const [first] = indices;
  const last = indices.at(-1);
  const prev = (first - 1 + total) % total;
  const next = (last + 1) % total;

  ctx.beginPath();
  ctx.moveTo(cx, cy);
  const startPt = getOuterEdgeMidpoint(scale, prev, first, max);
  ctx.lineTo(startPt.x, startPt.y);
  const firstPt = scale.getPointPositionForValue(first, max);
  ctx.lineTo(firstPt.x, firstPt.y);
  for (let k = 1; k < indices.length; k++) {
    const pt = scale.getPointPositionForValue(indices[k], max);
    ctx.lineTo(pt.x, pt.y);
  }
  const endPt = getOuterEdgeMidpoint(scale, last, next, max);
  ctx.lineTo(endPt.x, endPt.y);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function drawRadarPolygonBorder(ctx, scale, count) {
  const ch = FE_UI.chart;
  ctx.beginPath();
  for (let i = 0; i < count; i++) {
    const pt = scale.getPointPositionForValue(i, scale.max);
    if (i === 0) {
      ctx.moveTo(pt.x, pt.y);
    } else {
      ctx.lineTo(pt.x, pt.y);
    }
  }
  ctx.closePath();
  ctx.strokeStyle = ch.clusterBorderColor;
  ctx.lineWidth = ch.clusterBorderWidth;
  ctx.stroke();
}

export function createClusterBackgroundPlugin() {
  return {
    id: "clusterBackground",
    beforeDraw(chart) {
      const scale = chart.scales.r;
      if (!scale) {
        return;
      }

      const count = chart.data.labels?.length ?? 0;
      if (count < 3) {
        return;
      }

      const { ctx } = chart;
      ctx.save();
      for (const group of PILLAR_GROUP_ORDER) {
        const cluster = CLUSTERS[group.id];
        if (!cluster?.color) {
          continue;
        }
        const indices = sortClusterArc(
          group.pillars.map((pillarId) => PILLAR_ORDER.indexOf(pillarId)),
          count,
        );
        drawClusterWedge(ctx, scale, indices, cluster.color, count);
      }
      drawRadarPolygonBorder(ctx, scale, count);
      ctx.restore();
    },
  };
}

const FE_TECH_ASTERISK = {
  color: FE_UI.datasetAi.stroke,
  indices: getAiPillarIndices(),
  text: "AI",
  texts: null,
  offsetXPx: 8,
  offsetYPx: 5,
  boxBorderWidthPx: 1.5,
  boxPaddingPx: 4,
  boxRadiusPx: 4,
  boxFill: null,
  sizeOffsetPx: -6,
};

export function createTechnicalAsteriskPlugin() {
  return {
    id: "technicalAsteriskPointLabels",
    afterDraw(chart) {
      const scale = chart.scales.r;
      if (!scale || !scale._pointLabelItems || !scale._pointLabels) {
        return;
      }
      const { ctx } = chart;
      const pl = scale.options.pointLabels;
      for (const i of FE_TECH_ASTERISK.indices) {
        const item = scale._pointLabelItems[i];
        if (!item || !item.visible) {
          continue;
        }
        const text = scale._pointLabels[i];
        if (text == null || text === "") {
          continue;
        }
        const { texts } = FE_TECH_ASTERISK;
        const idxInList = FE_TECH_ASTERISK.indices.indexOf(i);
        let marker =
          Array.isArray(texts) && texts.length === FE_TECH_ASTERISK.indices.length && idxInList >= 0 ? texts[idxInList] : FE_TECH_ASTERISK.text;
        marker = marker != null ? String(marker) : "*";
        if (!marker) {
          continue;
        }
        const optsAtIndex = pl.setContext(scale.getPointLabelContext(i));
        const f = optsAtIndex.font || {};
        const labelFontSize = Number(f.size) || 12;
        const starFontSize = Math.max(1, Math.round(labelFontSize + (Number(FE_TECH_ASTERISK.sizeOffsetPx) || 0)));
        const weight = f.weight || "bold";
        const family = f.family || "system-ui, sans-serif";
        const lineHeight = f.lineHeight != null && Number.isFinite(Number(f.lineHeight)) ? Number(f.lineHeight) : labelFontSize * 1.2;
        ctx.save();
        ctx.font = `${weight} ${labelFontSize}px ${family}`;
        ctx.textBaseline = "middle";
        const w = ctx.measureText(String(text)).width;
        ctx.font = `${weight} ${starFontSize}px ${family}`;
        const c = FE_TECH_ASTERISK.color;
        ctx.fillStyle = c;
        const align = item.textAlign;
        let starX = item.x;
        if (align === "left") {
          starX = item.x + w + 1;
        } else if (align === "center") {
          starX = item.x + w / 2 + 1;
        } else if (align === "right") {
          starX = item.x + 1;
        }
        ctx.textAlign = "left";
        const starY = item.y + lineHeight / 2 + (Number(FE_TECH_ASTERISK.offsetYPx) || 0);
        const ox = Number(FE_TECH_ASTERISK.offsetXPx) || 0;
        const mx = starX + ox;
        const bw = Number(FE_TECH_ASTERISK.boxBorderWidthPx);
        const metrics = ctx.measureText(marker);
        const tw = metrics.width;
        const ascent = metrics.actualBoundingBoxAscent != null ? metrics.actualBoundingBoxAscent : starFontSize * 0.72;
        const descent = metrics.actualBoundingBoxDescent != null ? metrics.actualBoundingBoxDescent : starFontSize * 0.28;
        const pad = Number(FE_TECH_ASTERISK.boxPaddingPx) || 4;
        const br = Math.max(0, Number(FE_TECH_ASTERISK.boxRadiusPx) || 0);
        if (Number.isFinite(bw) && bw > 0) {
          const boxLeft = mx - pad;
          const boxTop = starY - ascent - pad;
          const boxW = tw + 2 * pad;
          const boxH = ascent + descent + 2 * pad;
          ctx.beginPath();
          if (br > 0 && typeof ctx.roundRect === "function") {
            ctx.roundRect(boxLeft, boxTop, boxW, boxH, br);
          } else {
            ctx.rect(boxLeft, boxTop, boxW, boxH);
          }
          const fill = FE_TECH_ASTERISK.boxFill;
          if (fill) {
            ctx.fillStyle = fill;
            ctx.fill();
          }
          ctx.strokeStyle = c;
          ctx.lineWidth = bw;
          ctx.stroke();
        }
        ctx.fillStyle = c;
        ctx.fillText(marker, mx, starY);
        ctx.restore();
      }
    },
  };
}
