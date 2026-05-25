import html2canvas from "html2canvas";

import { syncFontsForChart } from "@/lib/chart/radar-center";
import { FE_UI } from "@/lib/constants";

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
  if (!exportRoot || !canvas || !chart) {return { ok: false, method: null };}
  if (typeof html2canvas !== "function") {
    throw new Error("html2canvas not loaded");
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

    if (canvas.width < 2 || canvas.height < 2) {return { ok: false, method: null };}

    const snap = await html2canvas(exportRoot, {
      x: 0,
      y: 0,
      width: cssW,
      height: cssH,
      scale: pxPerCssX,
      backgroundColor: "#ffffff",
      useCORS: true,
      logging: false,
      ignoreElements: (el) => el === canvas,
    });

    const rootRect = exportRoot.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    const slotX = Math.round((canvasRect.left - rootRect.left) * pxPerCssX);
    const slotY = Math.round((canvasRect.top - rootRect.top) * pxPerCssY);
    const slotW = Math.max(1, Math.round(canvasRect.width * pxPerCssX));
    const slotH = Math.max(1, Math.round(canvasRect.height * pxPerCssY));

    const out = document.createElement("canvas");
    out.width = exportW;
    out.height = exportH;
    const octx = out.getContext("2d");
    octx.fillStyle = "#ffffff";
    octx.fillRect(0, 0, exportW, exportH);
    octx.drawImage(snap, 0, 0, snap.width, snap.height, 0, 0, exportW, exportH);

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
    if (hadDpr) {chart.options.devicePixelRatio = prevDpr;}
    else {delete chart.options.devicePixelRatio;}
    chart.resize();
    chart.update("none");
    requestAnimationFrame(() => syncFontsForChart(chart));
  }
}
