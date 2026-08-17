import { CLUSTERS, FE_UI, getPillarGroupOrder, getPillarOrder } from "@/constants";

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
      const pillarOrder = getPillarOrder();
      for (const group of getPillarGroupOrder()) {
        const cluster = CLUSTERS[group.id];
        // `chartBg` — the cluster weight that exists FOR this, and the same value ClusterLegend paints its
        // swatch with, so the key and the chart it explains are literally the same colour.
        //
        // Neither neighbour works here, and both were tried: `drawClusterWedge` fills at FULL OPACITY (there
        // is no alpha anywhere in this plugin), so the saturated `color` painted three mid-tone blocks that
        // fought the data polygon, while the pale `surfaceBg` disappeared under it and left the chart looking
        // like it had no clusters at all. A wedge is a large area behind live data: it needs less saturation
        // than a bezel and more than a card.
        if (!cluster?.chartBg) {
          continue;
        }
        const indices = sortClusterArc(
          group.pillars.map((pillarId) => pillarOrder.indexOf(pillarId)),
          count,
        );
        drawClusterWedge(ctx, scale, indices, cluster.chartBg, count);
      }
      drawRadarPolygonBorder(ctx, scale, count);
      ctx.restore();
    },
  };
}
