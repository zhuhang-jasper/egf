import { FE_UI, SITE_COPY } from "@/constants";
import { createExportClone } from "@/utils/export-clone";
import { ensureInterFontsLoaded } from "@/utils/export-image";

const UNSUPPORTED_COLOR_RE = /(?:oklch|oklab|lab\(|lch\(|color\()/i;

/** Ceiling on the slug's length inside a filename, so a long profile name can't produce an unwieldy one. */
const PROFILE_SLUG_MAX_LENGTH = 30;

/**
 * Normalize a user-typed profile name into a lower-kebab slug safe for a filename on any OS. NFKD folds
 * "Café" to "Cafe" rather than dropping the letter; everything outside a-z0-9 becomes a hyphen, which is what
 * keeps path separators and leading dots out. Returns "" when nothing is slug-able (e.g. "🎉").
 */
export function toProfileSlug(name) {
  return String(name ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, PROFILE_SLUG_MAX_LENGTH)
    .replace(/^-+|-+$/g, "");
}

/**
 * Today's date as `yyyy-mm-dd` in the user's LOCAL time zone. Not `toISOString().slice(0, 10)`, which is UTC
 * and lands a day out either side of midnight; the filename should say the day the export was made.
 */
function getLocalDateStamp() {
  const d = new Date();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

/**
 * The exported PNG's filename, filling `SITE_COPY.share.fileName`'s `{profileName}` and `{date}`.
 *
 * An unnamed profile falls back to `unnamedProfileSlug` so the segment reads as a known state rather than as
 * broken naming; blanking that fallback drops the segment and ONE neighbouring separator, the leading one by
 * preference. A template missing a placeholder is left as-is.
 */
export function buildChartFileName(profileName) {
  const slug = toProfileSlug(profileName) || toProfileSlug(SITE_COPY.share.unnamedProfileSlug);
  const withName = slug
    ? SITE_COPY.share.fileName.replace("{profileName}", slug)
    : SITE_COPY.share.fileName.replace(/(?:[-_]\{profileName\}|\{profileName\}[-_]?)/g, "");
  return withName.replace("{date}", getLocalDateStamp());
}

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

function getExportImagePaddingPx() {
  return Math.max(0, Number(FE_UI.chart.exportImagePaddingPx) || 12);
}

/**
 * Space between the content's lowest ink and the credit line's highest, in CSS px. Its own number, not a reuse of
 * the export's margin: this one separates two pieces of content, that one is the image's edge.
 */
function getAttributionGapPx() {
  return Math.max(0, Number(FE_UI.chart.exportImageAttributionGapPx) || 0);
}

/**
 * The credit line's type size in CSS px. Read straight from the constant, taking no chart width: the export
 * renders at one pinned width, so there is nothing for this to scale with. Shared by the band's height and the
 * line that fills it so the two cannot disagree. See exportImageAttributionFontPx for why it is authored.
 */
function getAttributionFontPx() {
  return Math.max(1, Number(FE_UI.chart.exportImageAttributionFontPx) || 9);
}

/** The credit's tracking, pinned so its measure and its paint cannot disagree. See the call sites for why. */
function setCreditLetterSpacing(ctx) {
  if ("letterSpacing" in ctx) {
    ctx.letterSpacing = "0px";
  }
}

/**
 * The credit line plus the ink metrics the foot of the export is laid out from. Null when the credit is switched
 * off (admin only — see FEATURE_CHART_ATTRIBUTION_SETTING) or empty, which is how callers learn there is no band.
 *
 * `actualBoundingBox*` rather than the em box, so the credit is bounded by its glyphs like the top of the export
 * is — the em box carries leading the string does not use.
 */
function measureAttribution(ctx, { hidden, scaleY }) {
  const text = SITE_COPY.share.imageAttribution;
  if (hidden || !text) {
    return null;
  }
  // FAMILY IS "Inter Variable", the name index.css actually declares. It read plain `Inter` for a long time —
  // a family that does not exist here, so canvas fell silently through to system-ui (SF Pro on macOS) and the
  // credit was the one piece of the export not set in Inter. Nothing looked broken, which is why it survived:
  // SF Pro at this size merely reads a little heavier and wider, and it made weight changes here look inert.
  //
  // Weight 500, matching the poster's footer and the app's, both of which inherit `font-medium` from body — every
  // credit line reads at one weight and one grey (see exportImageAttributionColor in styles/ui.js). Canvas text
  // rasterizes thinner than the DOM's (the reason the TITLE carries a weight delta), so this is the number to
  // retune if the credit reads faint in the PNG; the on-screen footers should not follow it.
  const font = `500 ${getAttributionFontPx() * scaleY}px "Inter Variable", system-ui, sans-serif`;
  ctx.save();
  ctx.font = font;
  // Both matter to the measure: `actualBoundingBox*` is relative to textBaseline, and renderExportDom leaves the
  // scratch context carrying a mirrored letterSpacing that the fresh output context will not have.
  ctx.textBaseline = "alphabetic";
  setCreditLetterSpacing(ctx);
  const m = ctx.measureText(text);
  ctx.restore();
  return { text, font, w: m.width, ascent: m.actualBoundingBoxAscent, descent: m.actualBoundingBoxDescent };
}

/**
 * Paints the credit line into the strip reserved at the foot of the export. Not mirrored from the DOM — it exists
 * only in the exported image. Drawn on the final canvas, since its baseline is measured from that canvas's foot
 * and the foot is not known until the row crop has settled the height.
 */
function renderAttribution(ctx, credit, { centerX, baselineY }) {
  ctx.fillStyle = FE_UI.chart.exportImageAttributionColor || "#94a3b8";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.font = credit.font;
  // Must match what measureAttribution measured at — see its note.
  setCreditLetterSpacing(ctx);
  ctx.fillText(credit.text, centerX, baselineY);
}

function getRelativeRect(el, rootRect, scaleX, scaleY, offsetX = 0, offsetY = 0) {
  const rect = el.getBoundingClientRect();
  return {
    x: (rect.left - rootRect.left + offsetX) * scaleX,
    y: (rect.top - rootRect.top + offsetY) * scaleY,
    w: rect.width * scaleX,
    h: rect.height * scaleY,
  };
}

/** The canvas font shorthand mirroring an element's computed type. `weightOverride`: see getCanvasWeight. */
function buildFont(cs, scaleY, weightOverride = null) {
  const size = Number.parseFloat(cs.fontSize) || 14;
  const weight = weightOverride ?? cs.fontWeight ?? "400";
  const family = cs.fontFamily || "system-ui, sans-serif";
  return `${weight} ${size * scaleY}px ${family}`;
}

/**
 * The title's font stack: the opsz-pinned face (declared in index.css) ahead of whatever the DOM computed, since
 * `font-optical-sizing: auto` has no canvas equivalent. Only the title is big enough for it to show. The DOM's own
 * stack stays behind as the fallback for glyphs the latin-only pinned face lacks.
 */
function buildTitleFontFamily(cs) {
  return `"Inter Display Canvas", ${cs.fontFamily || "system-ui, sans-serif"}`;
}

/**
 * The element's own weight, stepped by the named delta to compensate for canvas not honouring
 * `-webkit-font-smoothing`. Only the title and badge have one — see the constants in styles/ui for the reasoning
 * and the platform caveat.
 */
function getCanvasWeight(cs, deltaKey) {
  const domWeight = Number.parseFloat(cs.fontWeight) || 400;
  const delta = Number(FE_UI.chart[deltaKey]) || 0;
  return Math.max(1, Math.min(1000, domWeight + delta));
}

/**
 * Baseline y that centres a string's CAP BAND on the vertical middle of the box it is drawn in.
 *
 * `middle` would centre on the em box, whose midpoint sits below the cap band, painting the text low against the
 * badge beside it.
 *
 * Measured from the font via a reference capital, NOT from the string's own ink: reading the drawn text's
 * `actualBoundingBox*` moved the title by half a descender depending on whether the profile name happened to
 * contain one. Requires the final font already set on the context.
 */
function capCenteredBaselineY(ctx, boxTop, boxH) {
  const capHeight = ctx.measureText("H").actualBoundingBoxAscent;
  return boxTop + boxH / 2 + capHeight / 2;
}

/**
 * Mirror an element's tracking onto the context, in device px — canvas has `letterSpacing` but inherits nothing
 * from CSS, so without this the export comes out wider than the screen. Set BEFORE any measureText, since advances
 * are what the fit and the cap-band centring read back. No-op where unsupported.
 */
function applyLetterSpacing(ctx, cs, scaleY) {
  if (!("letterSpacing" in ctx)) {
    return;
  }
  const tracking = Number.parseFloat(cs.letterSpacing);
  ctx.letterSpacing = Number.isFinite(tracking) ? `${tracking * scaleY}px` : "0px";
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

/**
 * An element's own text, ignoring element children — the direct text nodes only. `textContent` flattens the
 * whole subtree, so it cannot tell painted text from an off-screen measuring span or hidden label.
 */
function getOwnText(el) {
  let out = "";
  for (const node of el.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      out += node.nodeValue;
    }
  }
  return out.trim();
}

function renderExportDom(ctx, exportRoot, scaleX, scaleY, padX, padY) {
  const rootRect = exportRoot.getBoundingClientRect();

  const title = exportRoot.querySelector("#competency-chart-heading");
  if (title && !isVisuallyHidden(title)) {
    // NOT `title.textContent`, WHICH DOUBLES THE TITLE: the heading also holds useMiddleEllipsis's measuring
    // <span>, whose last-tested candidate string stays in the DOM. Reading only the heading's OWN text nodes
    // takes what is painted and skips any element child, which is that span's whole category.
    const text = getOwnText(title);
    if (text) {
      const cs = window.getComputedStyle(title);
      const { x, y, w, h } = getRelativeRect(title, rootRect, scaleX, scaleY, padX, padY);
      ctx.fillStyle = sanitizeColorForHtml2Canvas(cs.color);
      const baseSize = Number.parseFloat(cs.fontSize) || 14;
      const weight = getCanvasWeight(cs, "exportImageTitleWeightDelta");
      const family = buildTitleFontFamily(cs);
      // Scale font down if text overflows the element's measured width. Tracking is set before the measure,
      // because negative tracking is part of what the string's width IS.
      let fontSize = baseSize * scaleY;
      let spacingScale = scaleY;
      ctx.font = `${weight} ${fontSize}px ${family}`;
      applyLetterSpacing(ctx, cs, spacingScale);
      const measured = ctx.measureText(text).width;
      if (measured > w && measured > 0) {
        const shrunk = Math.max(8, fontSize * (w / measured));
        spacingScale *= shrunk / fontSize;
        fontSize = shrunk;
        ctx.font = `${weight} ${fontSize}px ${family}`;
        // Tracking is proportional to type size, so the shrink has to reach it too or the letters spread.
        applyLetterSpacing(ctx, cs, spacingScale);
      }
      ctx.textAlign = cs.textAlign === "center" ? "center" : "left";
      ctx.textBaseline = "alphabetic";
      ctx.fillText(text, ctx.textAlign === "center" ? x + w / 2 : x, capCenteredBaselineY(ctx, y, h));
    }
  }

  const legendCard = exportRoot.querySelector("[data-chart-export='chart-legend-card']");
  if (legendCard instanceof HTMLElement && !isVisuallyHidden(legendCard)) {
    const cs = window.getComputedStyle(legendCard);
    const { x, y, w, h } = getRelativeRect(legendCard, rootRect, scaleX, scaleY, padX, padY);
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
  }

  const legend = exportRoot.querySelector("[data-chart-export='cluster-legend']");
  if (legend instanceof HTMLElement && !isVisuallyHidden(legend)) {
    for (const item of legend.querySelectorAll("[data-chart-export='cluster-legend-item']")) {
      if (!(item instanceof HTMLElement)) {
        continue;
      }
      const swatch = item.querySelector("[data-chart-export='cluster-legend-swatch']");
      const label = item.querySelector("[data-chart-export='cluster-legend-label']");
      if (swatch instanceof HTMLElement) {
        const scs = window.getComputedStyle(swatch);
        const sr = getRelativeRect(swatch, rootRect, scaleX, scaleY, padX, padY);
        const borderW = (Number.parseFloat(scs.borderTopWidth) || 1) * scaleX;
        ctx.fillStyle = sanitizeColorForHtml2Canvas(scs.backgroundColor);
        ctx.fillRect(sr.x, sr.y, sr.w, sr.h);
        if (borderW > 0) {
          ctx.strokeStyle = sanitizeColorForHtml2Canvas(scs.borderTopColor);
          ctx.lineWidth = borderW;
          ctx.strokeRect(sr.x + borderW / 2, sr.y + borderW / 2, sr.w - borderW, sr.h - borderW);
        }
      }
      if (label instanceof HTMLElement) {
        const text = label.textContent?.trim();
        if (text) {
          const lcs = window.getComputedStyle(label);
          const lr = getRelativeRect(label, rootRect, scaleX, scaleY, padX, padY);
          ctx.fillStyle = sanitizeColorForHtml2Canvas(lcs.color);
          ctx.font = buildFont(lcs, scaleY);
          applyLetterSpacing(ctx, lcs, scaleY);
          ctx.textAlign = "left";
          ctx.textBaseline = "middle";
          ctx.fillText(text, lr.x, lr.y + lr.h / 2);
        }
      }
    }
  }

  const trackBadge = exportRoot.querySelector("[data-chart-export='track-badge']");
  if (trackBadge instanceof HTMLElement && !isVisuallyHidden(trackBadge)) {
    const text = trackBadge.textContent?.trim();
    if (text) {
      const cs = window.getComputedStyle(trackBadge);
      const { x, y, w, h } = getRelativeRect(trackBadge, rootRect, scaleX, scaleY, padX, padY);
      const radius = (Number.parseFloat(cs.borderRadius) || 6) * scaleX;
      drawRoundedRect(ctx, x, y, w, h, radius, sanitizeColorForHtml2Canvas(cs.backgroundColor), null, 0);
      ctx.fillStyle = sanitizeColorForHtml2Canvas(cs.color);
      ctx.font = buildFont(cs, scaleY, getCanvasWeight(cs, "exportImageBadgeWeightDelta"));
      applyLetterSpacing(ctx, cs, scaleY);
      ctx.textAlign = "center";
      // Cap-band centred through the same helper as the title, so the pill and the letters beside it cannot be
      // centred by two different rules. "FE"/"BE" carry no descender, so this label alone was never the problem.
      ctx.textBaseline = "alphabetic";
      ctx.fillText(text, x + w / 2, capCenteredBaselineY(ctx, y, h));
    }
  }

  const scoresGrid = exportRoot.querySelector("[data-chart-export='chart-scores']");
  if (scoresGrid) {
    for (const card of scoresGrid.querySelectorAll("[data-chart-export='chart-score-card']")) {
      if (!(card instanceof HTMLElement)) {
        continue;
      }
      const cs = window.getComputedStyle(card);
      const { x, y, w, h } = getRelativeRect(card, rootRect, scaleX, scaleY, padX, padY);
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
        // Hover tooltips are visually hidden (opacity-0) and sit outside the card — never paint them.
        if (span.getAttribute("role") === "tooltip") {
          continue;
        }
        const text = span.textContent?.trim();
        if (!text) {
          continue;
        }
        const scs = window.getComputedStyle(span);
        const sr = getRelativeRect(span, rootRect, scaleX, scaleY, padX, padY);
        ctx.fillStyle = sanitizeColorForHtml2Canvas(scs.color);
        ctx.font = buildFont(scs, scaleY);
        applyLetterSpacing(ctx, scs, scaleY);
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(text, sr.x + sr.w / 2, sr.y + sr.h / 2);
      }
    }
  }
}

/**
 * Rasterize the chart export DOM (title, legend, badge, scores) plus the radar into a single high-res PNG and
 * return it as a Blob. Shared by the clipboard-copy and share paths. Null if nothing is ready to capture.
 *
 * `canvas` and `chart` are the LIVE ones and are read only as a readiness signal — the pixels come from the
 * off-screen clone, which builds its own. See docs/DECISIONS.md#export-renders-from-an-off-screen-clone.
 */
export async function renderChartImageBlob({ exportRoot, canvas, chart, attributionHidden = false, uhd = false }) {
  if (!exportRoot || !canvas || !chart) {
    return null;
  }

  // Both layers of this export use Inter — the DOM overlay (title/legend/scores, drawn via
  // ctx.fillText below) and the Chart.js canvas labels. Canvas text silently falls back to a
  // default font for any glyph not yet loaded, so make sure Inter is ready before we rasterize.
  await ensureInterFontsLoaded();

  const padPx = getExportImagePaddingPx();
  const layoutW = Math.max(120, Math.round(Number(FE_UI.chart.exportImageLayoutWidthPx) || 526));

  // No fallback to pinning the live element: a failed clone skips the export rather than reintroducing the
  // flash it exists to remove.
  const clone = createExportClone(exportRoot, layoutW);
  if (!clone) {
    return null;
  }

  try {
    clone.fit();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    return await rasterizeChart({
      exportRoot: clone.root,
      canvas: clone.canvas,
      chart: clone.chart,
      attributionHidden,
      uhd,
      padPx,
    });
  } finally {
    clone.dispose();
  }
}

/** One pixel of the white ground. All four channels are 0xff, so the platform's byte order does not matter. */
const WHITE_PIXEL = 0xffffffff;

function rowHasInk(px, rowStart, width) {
  for (let x = 0; x < width; x++) {
    if (px[rowStart + x] !== WHITE_PIXEL) {
      return true;
    }
  }
  return false;
}

/**
 * First and last painted row on a white-filled canvas, or null if nothing was painted. The export's top and bottom
 * margins are measured from this rather than the layout box, since on this axis the gap between the two is pure
 * leading. Anti-aliased edges count as ink, which is right.
 *
 * ONLY THE ROWS — cropping the columns too is wrong however even it looks; see the note in rasterizeChart.
 */
function getInkRowBounds(ctx, width, height) {
  const px = new Uint32Array(ctx.getImageData(0, 0, width, height).data.buffer);

  // In from each end, so only the blank margins are ever scanned — never the tall painted middle.
  let top = -1;
  for (let y = 0; y < height && top < 0; y++) {
    if (rowHasInk(px, y * width, width)) {
      top = y;
    }
  }
  if (top < 0) {
    return null;
  }
  let bottom = top;
  for (let y = height - 1; y > top; y--) {
    if (rowHasInk(px, y * width, width)) {
      bottom = y;
      break;
    }
  }

  return { y: top, h: bottom - top + 1 };
}

/**
 * The capture itself, split out so `renderChartImageBlob` owns only the pinned-width window around it. Assumes
 * `exportRoot` is already pinned to the export WIDTH; the height is this function's own to settle.
 */
async function rasterizeChart({ exportRoot, canvas, chart, attributionHidden, uhd, padPx }) {
  const scaleMax = Math.max(1, Number(FE_UI.chart.exportImageCssScaleMax) || 12);
  const requestedScale = uhd ? Number(FE_UI.chart.exportImageCssScaleUhd) || 5 : Number(FE_UI.chart.exportImageCssScale) || 3;
  const cssScale = Math.max(0.25, Math.min(scaleMax, requestedScale));

  const hadDpr = Object.hasOwn(chart.options, "devicePixelRatio");
  const prevDpr = chart.options.devicePixelRatio;

  try {
    // THE RESIZE COMES FIRST; every measurement below is read from the layout it settles at. `chart.resize()`
    // re-fits the frame height via onResize, so measuring above it sizes the canvas from a layout the export
    // never draws. See docs/DECISIONS.md#export-geometry-is-measured-after-the-dpr-resize.
    chart.options.devicePixelRatio = Math.max(cssScale, window.devicePixelRatio || 1);
    chart.resize();
    chart.update("none");
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

    if (canvas.width < 2 || canvas.height < 2) {
      return null;
    }

    const contentW = Math.max(1, Math.round(exportRoot.offsetWidth));
    const contentH = Math.max(1, Math.round(exportRoot.offsetHeight));

    // PASS ONE — the content alone, on a white ground, offset by `padPx` on every side. Horizontally that offset
    // IS the finished margin, since the columns are never cropped; vertically it is only slack, and pass two
    // replaces it with a margin measured off the ink.
    const cssW = contentW + padPx * 2;
    const cssH = contentH + padPx * 2;
    const scratchW = Math.max(120, Math.round(cssW * cssScale));
    const scratchH = Math.max(2, Math.round(cssH * cssScale));
    const pxPerCssX = scratchW / cssW;
    const pxPerCssY = scratchH / cssH;

    const scratch = document.createElement("canvas");
    scratch.width = scratchW;
    scratch.height = scratchH;
    const sctx = scratch.getContext("2d");
    sctx.fillStyle = "#ffffff";
    sctx.fillRect(0, 0, scratchW, scratchH);
    renderExportDom(sctx, exportRoot, pxPerCssX, pxPerCssY, padPx, padPx);

    const rootRect = exportRoot.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    const slotX = Math.round((canvasRect.left - rootRect.left + padPx) * pxPerCssX);
    const slotY = Math.round((canvasRect.top - rootRect.top + padPx) * pxPerCssY);
    const slotW = Math.max(1, Math.round(canvasRect.width * pxPerCssX));
    const slotH = Math.max(1, Math.round(canvasRect.height * pxPerCssY));

    const ratioDiff = Math.abs(slotW / canvas.width - 1) + Math.abs(slotH / canvas.height - 1);
    sctx.imageSmoothingEnabled = ratioDiff > 0.04;
    sctx.imageSmoothingQuality = "high";
    sctx.drawImage(canvas, 0, 0, canvas.width, canvas.height, slotX, slotY, slotW, slotH);

    // PASS TWO — crop the ROWS to the ink, then pad, making `padPx` the literal top and bottom margin.
    //
    // THE COLUMNS ARE DELIBERATELY NOT CROPPED, however much more even it would make the margins look: the layout
    // box is the frame the blocks align to, so cropping to ink lets a display toggle or a short profile name
    // redefine the image's width. The right edge reads looser than the left as a result, and closing that is the
    // radar's job, not the padding's. See docs/DECISIONS.md#export-margins-crop-the-rows-not-the-columns.
    const ink = getInkRowBounds(sctx, scratchW, scratchH);
    if (!ink) {
      return null;
    }

    const credit = measureAttribution(sctx, { hidden: attributionHidden, scaleY: pxPerCssY });
    const padX = Math.round(padPx * pxPerCssX);
    const padY = Math.round(padPx * pxPerCssY);
    // THE BLOCK, IN ORDER: the content's ink, the gap, the credit's ink — and only then `padY`/`padX` around the
    // whole of it. So the band carries NO padding of its own; the white below the credit is the margin itself.
    // Zero without a credit, which leaves the foot the plain `padY`, same as the head.
    const bandPx = credit ? Math.round(getAttributionGapPx() * pxPerCssY) + Math.ceil(credit.ascent + credit.descent) : 0;

    // The scratch is already the layout box plus its two horizontal margins, so it IS the export width. The
    // `max` only stops a reworded credit wider than the box from being clipped, in which case the box centres
    // inside the wider canvas rather than sitting at `padX`.
    const exportW = Math.max(2, scratchW, Math.ceil(credit?.w ?? 0) + padX * 2);
    const exportH = Math.max(2, ink.h + bandPx + padY * 2);

    const out = document.createElement("canvas");
    out.width = exportW;
    out.height = exportH;
    const octx = out.getContext("2d");
    octx.fillStyle = "#ffffff";
    octx.fillRect(0, 0, exportW, exportH);
    // A 1:1 blit — same source and destination size, so nothing is resampled and no pixel is softened. Full
    // width, vertically offset only.
    octx.drawImage(scratch, 0, ink.y, scratchW, ink.h, Math.round((exportW - scratchW) / 2), padY, scratchW, ink.h);
    if (credit) {
      // Baseline placed so the DESCENDERS land `padY` above the foot, matching the other three edges.
      renderAttribution(octx, credit, { centerX: exportW / 2, baselineY: exportH - padY - credit.descent });
    }

    return await new Promise((resolve, reject) => {
      out.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png", 1);
    });
  } finally {
    // Only the dpr is undone here. The pinned width — and the resize/font resync that unwinding it needs — is
    // owned by renderChartImageBlob's own finally, which runs after this one.
    if (hadDpr) {
      chart.options.devicePixelRatio = prevDpr;
    } else {
      delete chart.options.devicePixelRatio;
    }
  }
}

/**
 * @param profileName Used only by the download fallback, to name the file. The clipboard path never sees
 *   it — a pasted image has no filename.
 */
export async function copyChartAsImageToClipboard({ exportRoot, canvas, chart, profileName, attributionHidden, uhd }) {
  if (!exportRoot || !canvas || !chart) {
    return { ok: false, method: null };
  }

  const blob = await renderChartImageBlob({ exportRoot, canvas, chart, attributionHidden, uhd });
  if (!blob) {
    return { ok: false, method: null };
  }

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
  a.download = buildChartFileName(profileName);
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return { ok: true, method: "download" };
}

/**
 * The canonical tool link the share message points to: app origin + base path + `?tab=tool`, so the
 * recipient always lands on the Tool tab regardless of the sharer's current tab/query params.
 */
function getToolShareLink() {
  if (typeof window === "undefined") {
    return "";
  }
  const base = import.meta.env.BASE_URL || "/";
  return `${window.location.origin}${base}${SITE_COPY.share.toolLinkQuery}`;
}

/** The share-sheet message body. Accepts an explicit link override; otherwise uses the tool link. */
function buildShareMessage(linkOverride) {
  const link = linkOverride || getToolShareLink();
  return SITE_COPY.share.messageTemplate.replace("{link}", link);
}

/**
 * Share the chart PNG plus a message containing the tool link via the Web Share API, falling back to a
 * clipboard copy where file sharing is unsupported so the button never dead-ends.
 *
 * @param {string} [url] Optional link override embedded in the message; defaults to the tool link.
 * @param {string} [profileName] Profile name, slugged into the attachment filename.
 * @returns {{ ok: boolean, method: "share" | "share-fallback-clipboard" | "share-fallback-download" | null }}
 */
export async function shareChartAsImage({ exportRoot, canvas, chart, url, profileName, attributionHidden, uhd }) {
  if (!exportRoot || !canvas || !chart) {
    return { ok: false, method: null };
  }

  const blob = await renderChartImageBlob({ exportRoot, canvas, chart, attributionHidden, uhd });
  if (!blob) {
    return { ok: false, method: null };
  }

  // Named once and reused by all three paths (share attachment, clipboard fallback's download, the final
  // download) so the file arrives under the same name however the share resolves.
  const fileName = buildChartFileName(profileName);
  const shareTitle = SITE_COPY.share.title;
  const shareText = buildShareMessage(url);

  try {
    if (typeof File === "function" && typeof navigator.share === "function") {
      const file = new File([blob], fileName, { type: "image/png" });
      // No separate `url` field: the link is already in the message text, so passing it
      // again would duplicate the link in apps like WhatsApp/Telegram. We share an image,
      // not a rich link preview, so the url field buys us nothing here.
      const data = { files: [file], title: shareTitle, text: shareText };
      // canShare gates on the files payload specifically; if it passes, share() can take files.
      if (typeof navigator.canShare !== "function" || navigator.canShare({ files: [file] })) {
        await navigator.share(data);
        return { ok: true, method: "share" };
      }
    }
  } catch (e) {
    // AbortError = user dismissed the share sheet; treat as a no-op, not a failure.
    if (e?.name === "AbortError") {
      return { ok: true, method: "share" };
    }
    console.warn(e);
  }

  // Fallback: no Web Share (or it failed) — copy the image so the user can paste it manually.
  try {
    if (navigator.clipboard && typeof ClipboardItem !== "undefined" && typeof navigator.clipboard.write === "function") {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      return { ok: true, method: "share-fallback-clipboard" };
    }
  } catch (e) {
    console.warn(e);
  }

  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
  return { ok: true, method: "share-fallback-download" };
}

/**
 * Share the Theory tab: its deep link, plus the pre-rendered pillar poster from `public/` as an attachment.
 *
 * The link is the payload and the image only an enhancement, so the no-files path shares TEXT rather than
 * copying to the clipboard as {@link shareChartAsImage} does, and the fetch is deliberately non-fatal.
 *
 * @param {string} url The theory link to embed in the message.
 * @returns {{ ok: boolean, method: "share" | "share-text" | null }}
 */
export async function shareTheoryLink(url) {
  if (typeof navigator === "undefined" || typeof navigator.share !== "function") {
    return { ok: false, method: null };
  }

  const shareTitle = SITE_COPY.share.title;
  const shareText = SITE_COPY.share.theoryMessageTemplate.replace("{link}", url);
  // No separate `url` field, for the same reason as the chart share: the link is already in the text,
  // and passing both duplicates it in apps like WhatsApp/Telegram.
  const textOnly = { title: shareTitle, text: shareText };

  let file = null;
  try {
    const base = import.meta.env.BASE_URL || "/";
    const res = await fetch(`${base}${SITE_COPY.share.theoryImagePath}`);
    if (res.ok && typeof File === "function") {
      const blob = await res.blob();
      const candidate = new File([blob], SITE_COPY.share.theoryImageFileName, { type: blob.type || "image/png" });
      // canShare gates on the files payload specifically; if it passes, share() can take files.
      if (typeof navigator.canShare !== "function" || navigator.canShare({ files: [candidate] })) {
        file = candidate;
      }
    }
  } catch (e) {
    // Asset missing/offline — fall through to the text-only share.
    console.warn(e);
  }

  try {
    await navigator.share(file ? { ...textOnly, files: [file] } : textOnly);
    return { ok: true, method: file ? "share" : "share-text" };
  } catch (e) {
    // AbortError = user dismissed the share sheet; a no-op, not a failure.
    if (e?.name === "AbortError") {
      return { ok: true, method: file ? "share" : "share-text" };
    }
    // A file payload can still be rejected at share() time even after canShare passed. The link is the
    // point of this share, so retry without the image rather than reporting a failure.
    if (file) {
      try {
        await navigator.share(textOnly);
        return { ok: true, method: "share-text" };
      } catch (retryErr) {
        if (retryErr?.name === "AbortError") {
          return { ok: true, method: "share-text" };
        }
        console.warn(retryErr);
      }
    }
    return { ok: false, method: null };
  }
}
