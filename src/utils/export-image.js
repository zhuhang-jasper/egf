/**
 * Shared PNG-export pipeline for the fixed-canvas share pages (PosterPage, SocialPage).
 *
 * Both pages render a pixel-exact <article> at a fixed CANVAS_W×CANVAS_H size, visually scaled
 * with a CSS transform, and rasterize it to a PNG via snapdom. The capture logic is identical
 * apart from the canvas size and the download filename, so it lives here once instead of being
 * copy-pasted per page.
 *
 * snapdom (unlike html2canvas) natively understands Tailwind v4's oklch()/oklab() colours and
 * clones + inlines styles internally, so there's no colour conversion to maintain.
 */

// The bundled Inter weights/styles the share pages use. snapdom only rasterizes glyphs that are
// loaded at capture time, so we explicitly request these before capturing (see renderShareBlob).
const FONT_SPECS = ['700 26px "Inter Variable"', '800 26px "Inter Variable"', 'italic 700 20px "Inter Variable"'];

// Non-Latin subsets the share pages never render — excluded from the embed so exported PNGs
// don't carry Cyrillic/Greek/Vietnamese woff2 payloads.
const NON_LATIN_SUBSETS = ["cyrillic", "cyrillic-ext", "greek", "greek-ext", "vietnamese"];

/**
 * Ensure the bundled Inter webfont is actually rasterizable before an image export runs. Both
 * capture paths — snapdom (poster/social) and the Canvas 2D chart export — draw only the glyphs
 * loaded at the moment of capture, so if the font hasn't finished loading (fresh page,
 * font-display:swap, a weight/style not yet triggered on screen) the export silently falls back
 * to system-ui / a canvas default — the device-inconsistency we bundled Inter to avoid. We
 * explicitly request every weight/style the exports use, then await fonts.ready. Shared by the
 * chart export in copy-chart-image.js too.
 */
export async function ensureInterFontsLoaded() {
  if (!document.fonts?.load) {
    return;
  }
  try {
    await Promise.all(FONT_SPECS.map((s) => document.fonts.load(s)));
    await document.fonts.ready;
  } catch {
    // Best-effort: if a load rejects, fall through — capture uses whatever is available.
  }
}

/**
 * Rasterize a fixed-canvas share <article> to a high-res PNG via snapdom.
 *
 * To avoid the visible "jump" that mutating the live node would cause (the preview is shrunk by a
 * `transform: scale()`, and capturing it at full size means temporarily un-scaling on screen), we
 * deep-clone the article into a detached container parked off-screen at its true size, mirror the
 * live chart <canvas> pixels into the clone, capture the clone, then discard it. The on-screen
 * preview is never touched, so the user sees no flicker.
 *
 * @param node     the live share <article> element
 * @param width    fixed canvas width in px (the article's true, un-scaled width)
 * @param height   fixed canvas height in px
 * @returns {Promise<Blob>} the PNG blob (2× the canvas size)
 */
export async function renderShareBlob(node, width, height) {
  const { snapdom } = await import("@zumer/snapdom");

  await ensureInterFontsLoaded();

  const holder = document.createElement("div");
  holder.style.cssText = `position:fixed;left:-100000px;top:0;width:${width}px;height:${height}px;overflow:visible;background:#ffffff;z-index:-1;pointer-events:none;`;

  const clone = node.cloneNode(true);
  clone.style.transform = "none";
  clone.style.transformOrigin = "top left";
  clone.style.margin = "0";

  holder.appendChild(clone);
  document.body.appendChild(holder);

  try {
    // A cloned <canvas> is blank until something draws into it, and snapdom won't re-run our
    // Chart.js code — so copy the live chart pixels across to the clone's canvases.
    const liveCanvases = node.querySelectorAll("canvas");
    const cloneCanvases = clone.querySelectorAll("canvas");
    cloneCanvases.forEach((c, i) => {
      const src = liveCanvases[i];
      if (!src) {
        return;
      }
      c.width = src.width;
      c.height = src.height;
      c.getContext("2d")?.drawImage(src, 0, 0);
    });

    return await snapdom.toBlob(clone, {
      type: "png",
      scale: 2, // 2× export, crisp for LinkedIn / link cards
      dpr: 1, // snapdom multiplies by devicePixelRatio by default — pin it so exports are screen-independent
      backgroundColor: "#ffffff",
      // Inline the bundled Inter @font-face into the capture. Off by default, so without this
      // snapdom rasterizes the OS fallback (SF/Roboto) and the export drifts per device — the
      // exact bug this font work fixes. Skip the non-Latin subsets the share pages never use.
      embedFonts: true,
      excludeFonts: { subsets: NON_LATIN_SUBSETS },
      exclude: ["[data-export-ignore]"], // the floating copy/download buttons — never in the capture
      excludeMode: "remove",
    });
  } finally {
    holder.remove();
  }
}

/**
 * Copy a share PNG to the clipboard. Passes a Promise<Blob> to ClipboardItem (rather than an
 * already-resolved blob): this is the spec'd way to copy async-generated content — the browser
 * holds the clipboard-write permission across the awaited render, instead of the gesture window
 * expiring while we rasterize. Safari requires this form; Chrome/Firefox accept it too.
 *
 * @param node   the live share <article>
 * @param width  fixed canvas width in px
 * @param height fixed canvas height in px
 * @param label  human-readable noun for the error message (e.g. "poster", "social image")
 */
export async function copyShareToClipboard(node, width, height, label) {
  if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) {
    throw new Error("Clipboard image write is not supported in this browser");
  }
  const blobPromise = renderShareBlob(node, width, height).then((blob) => {
    if (!blob) {
      throw new Error(`Failed to render ${label} image`);
    }
    return blob;
  });
  await navigator.clipboard.write([new ClipboardItem({ "image/png": blobPromise })]);
}

/**
 * Render a share <article> and trigger a PNG file download.
 *
 * @param node     the live share <article>
 * @param width    fixed canvas width in px
 * @param height   fixed canvas height in px
 * @param filename downloaded file name (e.g. "…-poster.png")
 * @param label    human-readable noun for the error message
 */
export async function downloadSharePng(node, width, height, filename, label) {
  const blob = await renderShareBlob(node, width, height);
  if (!blob) {
    throw new Error(`Failed to render ${label} image`);
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Delay revoke — revoking synchronously after click() cancels the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
