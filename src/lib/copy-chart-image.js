import { syncFontsForChart } from "@/lib/chart/radar-center";
import { FE_UI } from "@/lib/constants";

const UNSUPPORTED_COLOR_RE = /(?:oklch|oklab|lab\(|lch\(|color\()/i;

function sanitizeColorForHtml2Canvas(value) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed || trimmed === "transparent") {
    return trimmed;
  }
  if (!UNSUPPORTED_COLOR_RE.test(trimmed)) {
    return trimmed;
  }

  try {
    const probe = document.createElement("canvas");
    probe.width = 1;
    probe.height = 1;
    const ctx = probe.getContext("2d");
    if (!ctx) {
      return "#000000";
    }
    ctx.fillStyle = "#000000";
    ctx.fillStyle = trimmed;
    return ctx.fillStyle;
  } catch {
    return "#000000";
  }
}

function getRelativeRect(el, rootRect, scaleX, scaleY) {
  const rect = el.getBoundingClientRect();
  return {
    x: (rect.left - rootRect.left) * scaleX,
    y: (rect.top - rootRect.top) * scaleY,
    w: rect.width * scaleX,
    h: rect.height * scaleY,
  };
}

function buildFont(cs, scaleY) {
  const size = Number.parseFloat(cs.fontSize) || 14;
  const weight = cs.fontWeight || "400";
  const family = cs.fontFamily || "system-ui, sans-serif";
  return `${weight} ${size * scaleY}px ${family}`;
}

function drawRoundedRect(ctx, x, y, w, h, radius, fill, stroke, lineWidth) {
  const r = Math.max(0, Math.min(radius, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke && lineWidth > 0) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}

function isVisuallyHidden(el) {
  const cs = window.getComputedStyle(el);
  if (cs.display === "none" || cs.visibility === "hidden") {
    return true;
  }
  if (el.classList.contains("sr-only")) {
    return true;
  }
  const w = Number.parseFloat(cs.width);
  const h = Number.parseFloat(cs.height);
  return cs.position === "absolute" && w <= 1 && h <= 1;
}

function renderExportDom(ctx, exportRoot, scaleX, scaleY) {
  const rootRect = exportRoot.getBoundingClientRect();

  const title = exportRoot.querySelector("#competency-chart-heading");
  if (title && !isVisuallyHidden(title)) {
    const text = title.textContent?.trim();
    if (text) {
      const cs = window.getComputedStyle(title);
      const { x, y, w, h } = getRelativeRect(title, rootRect, scaleX, scaleY);
      ctx.fillStyle = sanitizeColorForHtml2Canvas(cs.color);
      ctx.font = buildFont(cs, scaleY);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text, x + w / 2, y + h / 2);
    }
  }

  const legendImg = exportRoot.querySelector("img");
  if (legendImg?.complete && legendImg.naturalWidth > 0) {
    const { x, y, w, h } = getRelativeRect(legendImg, rootRect, scaleX, scaleY);
    ctx.drawImage(legendImg, x, y, w, h);
  }

  const averagesGrid = exportRoot.querySelector("[aria-label]");
  if (averagesGrid) {
    for (const card of averagesGrid.children) {
      if (!(card instanceof HTMLElement)) {
        continue;
      }
      const cs = window.getComputedStyle(card);
      const { x, y, w, h } = getRelativeRect(card, rootRect, scaleX, scaleY);
      const radius = (Number.parseFloat(cs.borderTopLeftRadius) || 8) * scaleX;
      const lineWidth = (Number.parseFloat(cs.borderTopWidth) || 1) * scaleX;
      drawRoundedRect(
        ctx,
        x,
        y,
        w,
        h,
        radius,
        sanitizeColorForHtml2Canvas(cs.backgroundColor),
        sanitizeColorForHtml2Canvas(cs.borderTopColor),
        lineWidth,
      );

      for (const span of card.querySelectorAll("span")) {
        const text = span.textContent?.trim();
        if (!text) {
          continue;
        }
        const scs = window.getComputedStyle(span);
        const sr = getRelativeRect(span, rootRect, scaleX, scaleY);
        ctx.fillStyle = sanitizeColorForHtml2Canvas(scs.color);
        ctx.font = buildFont(scs, scaleY);
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(text, sr.x + sr.w / 2, sr.y + sr.h / 2);
      }
    }
  }
}

function getChartExportableCaptureHeight(el) {
  const root = el.getBoundingClientRect();
  let maxBottom = root.top;
  for (const child of el.children) {
    maxBottom = Math.max(maxBottom, child.getBoundingClientRect().bottom);
  }
  const fromKids = Math.ceil(maxBottom - root.top);
  return Math.max(1, Math.min(el.offsetHeight, fromKids));
}

export async function copyChartAsImageToClipboard({ exportRoot, canvas, chart, titleText }) {
  if (!exportRoot || !canvas || !chart) {
    return { ok: false, method: null };
  }

  const cssW = Math.max(1, Math.round(exportRoot.getBoundingClientRect().width));
  const cssH = Math.max(1, getChartExportableCaptureHeight(exportRoot));
  const scaleMax = Math.max(1, Number(FE_UI.chart.exportImageCssScaleMax) || 12);
  const cssScale = Math.max(0.25, Math.min(scaleMax, Number(FE_UI.chart.exportImageCssScale) || 8));
  const exportW = Math.max(120, Math.round(cssW * cssScale));
  const exportH = Math.max(2, Math.round((exportW * cssH) / cssW));
  const pxPerCssX = exportW / cssW;
  const pxPerCssY = exportH / cssH;

  const hadDpr = Object.hasOwn(chart.options, "devicePixelRatio");
  const prevDpr = chart.options.devicePixelRatio;

  try {
    chart.options.devicePixelRatio = Math.max(cssScale, window.devicePixelRatio || 1);
    chart.resize();
    chart.update("none");
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

    if (canvas.width < 2 || canvas.height < 2) {
      return { ok: false, method: null };
    }

    const out = document.createElement("canvas");
    out.width = exportW;
    out.height = exportH;
    const octx = out.getContext("2d");
    octx.fillStyle = "#ffffff";
    octx.fillRect(0, 0, exportW, exportH);
    renderExportDom(octx, exportRoot, pxPerCssX, pxPerCssY);

    const rootRect = exportRoot.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    const slotX = Math.round((canvasRect.left - rootRect.left) * pxPerCssX);
    const slotY = Math.round((canvasRect.top - rootRect.top) * pxPerCssY);
    const slotW = Math.max(1, Math.round(canvasRect.width * pxPerCssX));
    const slotH = Math.max(1, Math.round(canvasRect.height * pxPerCssY));

    const ratioDiff = Math.abs(slotW / canvas.width - 1) + Math.abs(slotH / canvas.height - 1);
    octx.imageSmoothingEnabled = ratioDiff > 0.04;
    octx.imageSmoothingQuality = "high";
    octx.drawImage(canvas, 0, 0, canvas.width, canvas.height, slotX, slotY, slotW, slotH);

    const blob = await new Promise((resolve, reject) => {
      out.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png", 1);
    });

    try {
      if (navigator.clipboard && typeof ClipboardItem !== "undefined" && typeof navigator.clipboard.write === "function") {
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        return { ok: true, method: "clipboard" };
      }
    } catch (e) {
      console.warn(e);
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(titleText || "chart").replace(/[^\w-]+/g, "-").slice(0, 48)}-growth.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return { ok: true, method: "download" };
  } finally {
    if (hadDpr) {
      chart.options.devicePixelRatio = prevDpr;
    } else {
      delete chart.options.devicePixelRatio;
    }
    chart.resize();
    chart.update("none");
    requestAnimationFrame(() => syncFontsForChart(chart));
  }
}
