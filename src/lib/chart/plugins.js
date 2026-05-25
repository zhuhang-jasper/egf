import { FE_UI } from "@/lib/constants";

const FE_TECH_ASTERISK = {
  color: FE_UI.datasetAi.stroke,
  indices: [0, 1, 2],
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

export function createHeptagonBackgroundPlugin(heptagonImg) {
  return {
    id: "heptagonBackground",
    beforeDraw(chart) {
      const scale = chart.scales.r;
      if (!scale || !heptagonImg.complete || heptagonImg.naturalWidth === 0) {return;}

      const { ctx } = chart;
      const x = scale.xCenter;
      const y = scale.yCenter;
      const r = scale.drawingArea;
      const side = 2 * r * FE_UI.heptagon.bgSize;

      const outer0 = scale.getPointPositionForValue(0, scale.max);
      const axis0Angle = Math.atan2(outer0.y - y, outer0.x - x);
      const rotation = axis0Angle + Math.PI / 2 + FE_UI.heptagon.rotationAdjust;
      const cx = x + FE_UI.heptagon.nudgeFracX * r;
      const cy = y + FE_UI.heptagon.nudgeFracY * r;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rotation);
      ctx.drawImage(heptagonImg, -side / 2, -side / 2, side, side);
      ctx.restore();
    },
  };
}

export function createTechnicalAsteriskPlugin() {
  return {
    id: "technicalAsteriskPointLabels",
    afterDraw(chart) {
      const scale = chart.scales.r;
      if (!scale || !scale._pointLabelItems || !scale._pointLabels) {return;}
      const {ctx} = chart;
      const pl = scale.options.pointLabels;
      for (const i of FE_TECH_ASTERISK.indices) {
        const item = scale._pointLabelItems[i];
        if (!item || !item.visible) {continue;}
        const text = scale._pointLabels[i];
        if (text == null || text === "") {continue;}
        const {texts} = FE_TECH_ASTERISK;
        const idxInList = FE_TECH_ASTERISK.indices.indexOf(i);
        let marker =
          Array.isArray(texts) && texts.length === FE_TECH_ASTERISK.indices.length && idxInList >= 0 ? texts[idxInList] : FE_TECH_ASTERISK.text;
        marker = marker != null ? String(marker) : "*";
        if (!marker) {continue;}
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
        if (align === "left") {starX = item.x + w + 1;}
        else if (align === "center") {starX = item.x + w / 2 + 1;}
        else if (align === "right") {starX = item.x + 1;}
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
