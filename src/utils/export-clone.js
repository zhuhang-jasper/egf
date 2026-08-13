import { chartState, fitFrameToChart } from "@/hooks/useCompetencyChart";

import {
  applyChartFrameLayout,
  getChartSecondaryLabelSizePx,
  getChartTitleSizePx,
  getClusterLegendSwatchPx,
  getTrackBadgeMdHeightPx,
} from "@/chart/fonts";
import { applyChartState, createCompetencyChart } from "@/chart/instance";

/**
 * Off-screen twin of the chart export DOM, laid out at the export width with its own Chart.js instance, so the
 * export never resizes the visible chart. See docs/DECISIONS.md#export-renders-from-an-off-screen-clone.
 */

/** Off-screen, NOT `display:none`/`visibility:hidden` — the radar has to paint for its pixels to be copied. */
const HOST_OFFSET_PX = -10000;

function createHost(widthPx) {
  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.dataset.egfExportHost = "";
  Object.assign(host.style, {
    position: "fixed",
    top: "0px",
    left: `${HOST_OFFSET_PX}px`,
    width: `${widthPx}px`,
    pointerEvents: "none",
    zIndex: "-1",
    background: "#ffffff",
  });
  return host;
}

/**
 * Re-derive the chrome's width-scaled inline sizes for the clone's width.
 *
 * The title, badge and legend size themselves in JS from the frame width React last measured, and write the
 * result as INLINE STYLES. `cloneNode` copies those literally, so an export taken on a phone kept phone-sized
 * type around a 526px radar. Nothing re-renders the clone — it is detached from React — so the values are
 * recomputed here, through the same `fonts.js` helpers the components call.
 */
function rescaleChromeForWidth(root, widthPx) {
  const labelPx = getChartSecondaryLabelSizePx(widthPx);

  const titleRow = root.querySelector("[data-chart-title-row]");
  if (titleRow instanceof HTMLElement) {
    // The row carries the size; the <h2> inherits it, and `1.25em` resolves the row's min-height against it.
    titleRow.style.fontSize = `${getChartTitleSizePx(widthPx)}px`;
    titleRow.style.minHeight = `max(1.25em, ${getTrackBadgeMdHeightPx(widthPx)}px)`;
  }

  const badge = root.querySelector("[data-chart-export='track-badge']");
  if (badge instanceof HTMLElement && badge.style.fontSize) {
    // Only the `md` badge scales — `sm` sets no fontSize, which is what this guard tests.
    const padX = Math.round(labelPx * 0.85);
    badge.style.fontSize = `${labelPx}px`;
    badge.style.paddingLeft = `${padX}px`;
    badge.style.paddingRight = `${padX}px`;
    badge.style.borderRadius = `${Math.min(6, Math.max(4, Math.round(labelPx * 0.42)))}px`;
    // Same 0.86 of the title size as the on-screen `matchHeightPx` — keep the two in step.
    badge.style.height = `${Math.round(getChartTitleSizePx(widthPx) * 0.86)}px`;
  }

  const swatchPx = getClusterLegendSwatchPx(widthPx);
  for (const swatch of root.querySelectorAll("[data-chart-export='cluster-legend-swatch']")) {
    Object.assign(swatch.style, { width: `${swatchPx}px`, height: `${swatchPx}px` });
  }
  for (const label of root.querySelectorAll("[data-chart-export='cluster-legend-label']")) {
    label.style.fontSize = `${labelPx}px`;
  }
}

/**
 * Build the off-screen twin and return the pieces `renderChartImageBlob` rasterizes, plus its `dispose`.
 * Null when there is no root, or the clone has no canvas/frame to drive.
 *
 * A CLONED <canvas> IS BLANK — canvas pixels are not part of the DOM — so this builds a real second chart from
 * `createCompetencyChart`, the same factory the live one uses, handed the same store state.
 */
export function createExportClone(exportRoot, widthPx) {
  if (!exportRoot) {
    return null;
  }

  const host = createHost(widthPx);
  const root = exportRoot.cloneNode(true);
  // The live element is `w-full` in a narrower column; the clone must not inherit a cap below the export width.
  Object.assign(root.style, { width: `${widthPx}px`, maxWidth: "none" });

  host.append(root);
  document.body.append(host);

  const canvas = root.querySelector("[data-radar-canvas]");
  // Marked attribute, not a parent walk, which would silently fit the wrong box if the markup gains a wrapper.
  const frame = root.querySelector("[data-chart-frame]");
  if (!canvas || !frame) {
    host.remove();
    return null;
  }

  // Cloned from an element carrying `id`, which would duplicate it while the host is attached.
  canvas.removeAttribute("id");

  // THE FRAME'S width, not the host's: the frame sits inside the root's padding, and it is what the on-screen
  // fit measures (see useChartFrameFit). Read once, after the host is attached, so the chrome and the radar
  // are scaled from the same number.
  const frameWidthPx = Math.max(1, Math.round(frame.offsetWidth));
  rescaleChromeForWidth(root, frameWidthPx);

  // DROP THE INHERITED FRAME HEIGHT. `applyChartFrameLayout` writes it as an inline px value and `cloneNode`
  // copies it, so the clone started life at the VIEWPORT's height. The converge loop then measured label
  // extents inside that inherited box and settled near it, and since the radar is height-limited (see
  // fitFrameToChart), a phone exported a small radar ringed by white at the correct 526px width. Clearing it
  // makes the fit start from the width-derived estimate, exactly as a fresh mount does.
  applyChartFrameLayout(frame, frameWidthPx, null);

  const chart = createCompetencyChart(canvas);
  // `chartState()` rather than rebuilding the mapping here: it is the same store→chart translation the live
  // chart uses, so a field added there reaches the export without anyone remembering to add it twice.
  // `animateDataChanges` off explicitly — this chart is rasterized within a few frames of being built.
  applyChartState(chart, { ...chartState(), animateDataChanges: false });

  return {
    root,
    canvas,
    chart,
    /** Runs the same converge the on-screen chart uses, so the cloned radar fits its frame identically. */
    fit() {
      fitFrameToChart(frame, chart, frameWidthPx);
    },
    dispose() {
      chart.destroy();
      host.remove();
    },
  };
}
