import { syncFontsForChart } from "@/chart/radar-center";
import { FE_UI, SITE_COPY } from "@/constants";
import { ensureInterFontsLoaded } from "@/utils/export-image";

const UNSUPPORTED_COLOR_RE = /(?:oklch|oklab|lab\(|lch\(|color\()/i;

/** Ceiling on the slug's length inside a filename, so a long profile name can't produce an unwieldy one. */
const PROFILE_SLUG_MAX_LENGTH = 30;

/**
 * Normalize a user-typed profile name into a lower-kebab slug safe for a filename on any OS.
 *
 * NFKD + stripping combining marks folds "Café" to "Cafe" rather than dropping the letter, as a bare a-z
 * filter would. Everything outside a-z0-9 becomes a hyphen, which is what keeps path separators and leading
 * dots out. Returns "" for a name with nothing slug-able (e.g. "🎉"); see {@link buildChartFileName}.
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
 * Today's date as `yyyy-mm-dd` in the user's LOCAL time zone.
 *
 * NOT `toISOString().slice(0, 10)`, which is UTC: for a user in UTC+8 exporting at 01:00, that returns
 * yesterday's date, and for UTC-5 exporting at 20:00 it returns tomorrow's. The filename should say the
 * day the person actually made the export, so this reads the local calendar fields and pads them.
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
 * An unnamed profile falls back to `unnamedProfileSlug`, keeping the segment occupied so the name reads as
 * a known state rather than as broken naming. Setting that fallback blank drops the segment instead, which
 * swallows ONE neighbouring separator, the leading one by preference: taking both consumes the hyphen the
 * next segment needs. A template missing a placeholder is left as-is, so `site.js` can simplify the
 * filename without touching this code.
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
  return Math.max(0, Number(FE_UI.chart.exportImagePaddingPx) || 8);
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

function renderExportDom(ctx, exportRoot, scaleX, scaleY, padX, padY) {
  const rootRect = exportRoot.getBoundingClientRect();

  const title = exportRoot.querySelector("#competency-chart-heading");
  if (title && !isVisuallyHidden(title)) {
    const text = title.textContent?.trim();
    if (text) {
      const cs = window.getComputedStyle(title);
      const { x, y, w, h } = getRelativeRect(title, rootRect, scaleX, scaleY, padX, padY);
      ctx.fillStyle = sanitizeColorForHtml2Canvas(cs.color);
      const baseSize = Number.parseFloat(cs.fontSize) || 14;
      const weight = cs.fontWeight || "400";
      const family = cs.fontFamily || "system-ui, sans-serif";
      // Scale font down if text overflows the element's measured width.
      let fontSize = baseSize * scaleY;
      ctx.font = `${weight} ${fontSize}px ${family}`;
      const measured = ctx.measureText(text).width;
      if (measured > w && measured > 0) {
        fontSize = Math.max(8, fontSize * (w / measured));
        ctx.font = `${weight} ${fontSize}px ${family}`;
      }
      ctx.textAlign = cs.textAlign === "center" ? "center" : "left";
      ctx.textBaseline = "middle";
      ctx.fillText(text, ctx.textAlign === "center" ? x + w / 2 : x, y + h / 2);
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
      ctx.font = buildFont(cs, scaleY);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text, x + w / 2, y + h / 2);
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
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(text, sr.x + sr.w / 2, sr.y + sr.h / 2);
      }
    }
  }
}

/**
 * Rasterize the chart export DOM (title, legend, badge, scores) plus the live radar canvas into a
 * single high-res PNG and return it as a Blob. Shared by the clipboard-copy and share paths.
 * Returns null if the refs aren't ready or the canvas hasn't drawn yet.
 */
export async function renderChartImageBlob({ exportRoot, canvas, chart }) {
  if (!exportRoot || !canvas || !chart) {
    return null;
  }

  // Both layers of this export use Inter — the DOM overlay (title/legend/scores, drawn via
  // ctx.fillText below) and the Chart.js canvas labels. Canvas text silently falls back to a
  // default font for any glyph not yet loaded, so make sure Inter is ready before we rasterize.
  await ensureInterFontsLoaded();

  const padPx = getExportImagePaddingPx();
  const contentW = Math.max(1, Math.round(exportRoot.offsetWidth));
  const contentH = Math.max(1, Math.round(exportRoot.offsetHeight));
  const cssW = contentW + padPx * 2;
  const cssH = contentH + padPx * 2;
  const scaleMax = Math.max(1, Number(FE_UI.chart.exportImageCssScaleMax) || 12);
  const cssScale = Math.max(0.25, Math.min(scaleMax, Number(FE_UI.chart.exportImageCssScale) || 8));
  const exportW = Math.max(120, Math.round(cssW * cssScale));
  const exportH = Math.max(2, Math.round(cssH * cssScale));
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
      return null;
    }

    const out = document.createElement("canvas");
    out.width = exportW;
    out.height = exportH;
    const octx = out.getContext("2d");
    octx.fillStyle = "#ffffff";
    octx.fillRect(0, 0, exportW, exportH);
    renderExportDom(octx, exportRoot, pxPerCssX, pxPerCssY, padPx, padPx);

    const rootRect = exportRoot.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    const slotX = Math.round((canvasRect.left - rootRect.left + padPx) * pxPerCssX);
    const slotY = Math.round((canvasRect.top - rootRect.top + padPx) * pxPerCssY);
    const slotW = Math.max(1, Math.round(canvasRect.width * pxPerCssX));
    const slotH = Math.max(1, Math.round(canvasRect.height * pxPerCssY));

    const ratioDiff = Math.abs(slotW / canvas.width - 1) + Math.abs(slotH / canvas.height - 1);
    octx.imageSmoothingEnabled = ratioDiff > 0.04;
    octx.imageSmoothingQuality = "high";
    octx.drawImage(canvas, 0, 0, canvas.width, canvas.height, slotX, slotY, slotW, slotH);

    return await new Promise((resolve, reject) => {
      out.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png", 1);
    });
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

/**
 * @param profileName Used only by the download fallback, to name the file. The clipboard path never sees
 *   it — a pasted image has no filename.
 */
export async function copyChartAsImageToClipboard({ exportRoot, canvas, chart, profileName }) {
  if (!exportRoot || !canvas || !chart) {
    return { ok: false, method: null };
  }

  const blob = await renderChartImageBlob({ exportRoot, canvas, chart });
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
 * Share the chart PNG (plus a message containing the tool link) via the Web Share API, opening the
 * native OS share sheet so the user can pick a target app (WhatsApp, LinkedIn, Messages, AirDrop…).
 *
 * Falls back to a clipboard copy where file sharing is unsupported, so the button never dead-ends.
 *
 * @param {string} [url] Optional link override embedded in the message; defaults to the tool link.
 * @param {string} [profileName] Profile name, slugged into the attachment filename.
 * @returns {{ ok: boolean, method: "share" | "share-fallback-clipboard" | "share-fallback-download" | null }}
 */
export async function shareChartAsImage({ exportRoot, canvas, chart, url, profileName }) {
  if (!exportRoot || !canvas || !chart) {
    return { ok: false, method: null };
  }

  const blob = await renderChartImageBlob({ exportRoot, canvas, chart });
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
 * Share the Theory tab: its deep link, plus the pre-rendered pillar poster from `public/` as an
 * attached image so the share lands with a visual instead of a bare URL.
 *
 * The link is the payload and the image is an enhancement, so the no-files path shares TEXT rather than
 * falling back to a clipboard copy the way {@link shareChartAsImage} does: that function's image is
 * generated on the spot and would be lost, whereas this one is a static asset. The fetch is deliberately
 * non-fatal for the same reason.
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
