import { useLayoutEffect, useMemo, useRef, useState } from "react";

import { Chart, Filler, LineElement, PointElement, RadarController, RadialLinearScale } from "chart.js";

import { BackToToolButton } from "@/components/BackToToolButton";
import { ExportPngControls } from "@/components/ExportPngControls";
import { Toaster } from "@/components/ui/Toaster";

import { SHARE_EXPORT_TOAST_KEY, useAppStore } from "@/store/useAppStore";

import { createClusterBackgroundPlugin } from "@/chart/plugins";
import { FE_UI, getEmojiChartLabels, PILLAR_ORDER, SITE_COPY } from "@/constants";
import { pillarLevelsToArray } from "@/constants/levels";
import { track } from "@/utils/analytics";
import { copyShareToClipboard, downloadSharePng } from "@/utils/export-image";

// Fixed design canvas — a 1200×630 landscape card (the canonical Open Graph / LinkedIn
// link-share aspect ratio). Renders at this exact pixel size (the page scrolls if the
// window is smaller) so the export is 1:1.
const CANVAS_W = 1200;
const CANVAS_H = 630;

// Fallback shape if the named profile isn't in localStorage yet (e.g. fresh browser) — a
// well-rounded-but-varied profile so the radar still reads as a rich asymmetric shape.
const FALLBACK_PROFILE = {
  coding: 3.5,
  domainLogic: 4,
  architecture: 3.5,
  ai: 2,
  uiUx: 4,
  productSense: 3,
  process: 4,
  communication: 3.5,
  ownership: 3.5,
};

// Per-pillar label nudges, cloned verbatim from the tool's FE chart (src/chart/radar-center.js
// → PILLAR_LABEL_NUDGE.fe), so the emoji spokes sit exactly where the tool chart places them.
const FE_PILLAR_LABEL_NUDGE = {
  coding: { x: 0, y: 3 },
  domainLogic: { x: -13, y: 20 },
  architecture: { x: 10, y: 20 },
  uiUx: { x: -10, y: 35 },
  ai: { x: 7, y: 35 },
  productSense: { x: -10, y: -20 },
  process: { x: 8, y: -20 },
  communication: { x: 5, y: 0 },
  ownership: { x: -5, y: 0 },
};

// Shift each radar point label by its FE nudge. Stock Chart.js lays the labels out in
// scale._pointLabelItems during fit; we offset them after, by pillar id, in fe-axis order.
const pillarLabelNudgePlugin = {
  id: "socialPillarLabelNudge",
  afterLayout(chart) {
    const scale = chart.scales?.r;
    const items = scale?._pointLabelItems;
    if (!items) {
      return;
    }
    items.forEach((item, i) => {
      const nudge = FE_PILLAR_LABEL_NUDGE[PILLAR_ORDER[i]];
      if (!nudge) {
        return;
      }
      item.x += nudge.x;
      item.y += nudge.y;
      if (item.left != null) {
        item.left += nudge.x;
        item.right += nudge.x;
        item.top += nudge.y;
        item.bottom += nudge.y;
      }
    });
  },
};

Chart.register(RadarController, RadialLinearScale, PointElement, LineElement, Filler);

/**
 * Self-contained radar for the social card. Unlike StaticCompetencyChart it does NOT
 * auto-measure/resize its frame — it fills its box exactly so it always renders large and
 * centred. Shows the pillar point labels (the card has no surrounding ring to label the
 * spokes) and the cluster background, but never a Chart.js legend.
 *
 * @param levels       per-pillar values in fe order
 * @param labels       point-label strings in fe order
 */
function SocialRadar({ levels, labels }) {
  const canvasRef = useRef(null);
  useLayoutEffect(() => {
    const d = FE_UI.dataset;
    const ch = FE_UI.chart;
    const chart = new Chart(canvasRef.current, {
      type: "radar",
      data: {
        labels,
        datasets: [
          {
            data: levels,
            backgroundColor: d.fill,
            borderColor: d.stroke,
            borderWidth: 3,
            pointRadius: 3,
            pointBackgroundColor: d.pointFill,
            pointBorderColor: d.pointStroke,
            pointBorderWidth: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        backgroundColor: "transparent",
        layout: { padding: 0 },
        plugins: {
          legend: { display: false },
          tooltip: { enabled: false },
          clusterBackground: {},
        },
        scales: {
          r: {
            min: 0,
            max: 5,
            ticks: { display: false, stepSize: 1 },
            pointLabels: {
              display: true,
              padding: 20,
              font: { size: 50, weight: "bold" },
              color: ch.pointLabelColor,
            },
            angleLines: { color: ch.gridColor },
            grid: { circular: false, color: ch.gridColor },
          },
        },
      },
      plugins: [createClusterBackgroundPlugin(), pillarLabelNudgePlugin],
    });
    return () => chart.destroy();
  }, [levels, labels]);
  return <canvas ref={canvasRef} aria-label="competency radar chart" />;
}

/**
 * Visual fit-scale for the preview only — fits the viewport WIDTH (the page scrolls
 * vertically). The card renders at its true CANVAS_W×CANVAS_H pixels and is scaled with a
 * CSS transform; the export path (renderShareBlob) strips that transform before capture, so
 * the preview scales to width while the export stays a pixel-exact 1200×630.
 */
function useFitScale() {
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const compute = () => {
      const padX = 32; // matches the outer p-4 (16px × 2 sides)
      setScale(Math.min(1, Math.max(0.1, (document.documentElement.clientWidth - padX) / CANVAS_W)));
    };
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, []);
  return scale;
}

// The card's PNG export runs through the shared share-image pipeline (font embedding, the
// off-screen clone, canvas mirroring, snapdom capture) — see src/utils/export-image.js.
const SOCIAL_FILENAME = "9-pillar-engineer-growth-framework-social.png";
const copySocialToClipboard = (node) => copyShareToClipboard(node, CANVAS_W, CANVAS_H, "social image");
const downloadSocialPng = (node) => downloadSharePng(node, CANVAS_W, CANVAS_H, SOCIAL_FILENAME, "social image");

/** Load the featured sample shape once. */
function useFeaturedLevels() {
  return useMemo(() => {
    const pillarLevels = FALLBACK_PROFILE;
    return {
      levels: pillarLevelsToArray(pillarLevels),
      labels: getEmojiChartLabels(),
    };
  }, []);
}

export default function SocialPage() {
  const cardRef = useRef(null);
  const showToast = useAppStore((s) => s.showToast);
  // Which action (if any) is running. The outcome is a toast, not a button label — see ExportPngControls.
  const [busy, setBusy] = useState(null); // null | "copy" | "download"
  const scale = useFitScale();
  const { levels, labels } = useFeaturedLevels();

  const runExport = async (action, fn) => {
    if (!cardRef.current || busy) {
      return;
    }
    setBusy(action);
    try {
      await fn(cardRef.current);
      track("social_exported", { action });
      // Copy is confirmed, download is not — see the note on PosterPage's runExport for why.
      if (action === "copy") {
        showToast("Social image copied to clipboard", { variant: "success", key: SHARE_EXPORT_TOAST_KEY });
      }
    } catch (err) {
      console.error(`Social PNG ${action} failed:`, err);
      showToast(action === "copy" ? "Couldn't copy the image" : "Couldn't save the image", {
        variant: "error",
        key: SHARE_EXPORT_TOAST_KEY,
      });
    } finally {
      setBusy(null);
    }
  };

  const handleCopy = () => runExport("copy", copySocialToClipboard);
  const handleDownload = () => runExport("download", downloadSocialPng);

  return (
    /* `min-h-dvh` for the same reason as PosterPage's stage — see the note there. Without it this box stops at
       the canvas and the app's `bg-slate-100` body shows through below. */
    <div className="flex min-h-dvh w-full flex-col items-center overflow-x-hidden overflow-y-auto bg-black p-4">
      {/* Top chrome row: back link left, export controls right. Same arrangement as PosterPage's (minus its
          settings menu) — see the matching note there for why the row lives here and why the size label is not
          in it but pinned to the card's top-right edge below. */}
      <div className="mb-2 flex w-full items-center justify-between gap-3">
        <BackToToolButton />
        <ExportPngControls onCopy={handleCopy} onDownload={handleDownload} busy={Boolean(busy)} />
      </div>
      {/* `relative` + `mt-6` carry the size label pinned above this box's top-right corner — see PosterPage. */}
      <div className="relative mt-6 shrink-0" style={{ width: CANVAS_W * scale, height: CANVAS_H * scale }}>
        <span className="pointer-events-none absolute right-0 bottom-full select-none pb-1 text-sm font-semibold tabular-nums text-white">
          {CANVAS_W} × {CANVAS_H}
        </span>
        <article
          ref={cardRef}
          className="relative flex flex-col overflow-hidden bg-white px-12 py-9 shadow-2xl"
          style={{ width: CANVAS_W, height: CANVAS_H, transform: `scale(${scale})`, transformOrigin: "top left" }}
        >
          <div className="flex h-full items-center gap-0">
            {/* Left: header lifted from the poster masthead, scaled up to fill the card height. */}
            <header className="flex h-full w-[560px] shrink-0 flex-col justify-center gap-6">
              <div className="flex items-stretch gap-6">
                <span className="text-[250px] font-extrabold leading-[0.8] tracking-tighter text-slate-900">9</span>
                <div className="flex min-w-0 flex-1 flex-col justify-center">
                  <h1 className="whitespace-nowrap text-[64px] font-extrabold leading-[1.05] tracking-tight text-slate-900">
                    Pillar Engineer
                    <br />
                    Growth
                    <br />
                    Framework
                  </h1>
                </div>
              </div>

              {/* <p className="ml-6 text-[24px] font-bold uppercase tracking-[0.22em] text-slate-500">The Engineer Growth Framework</p> */}
              <p className="ml-6 text-[42px] text-left text-slate-900 leading-14">{SITE_COPY.tagline}</p>

              {/*<span className="text-[26px] font-bold text-slate-900">{SITE_COPY.byline}</span> */}
            </header>

            {/* Right: the featured profile's radar — labelled spokes, no legend.
                Fixed at ~70% of the 630px card height, vertically centred. */}
            <div className="flex flex-1 items-center justify-center">
              <div className="relative h-[520px] w-full -ml-5" style={{ transform: "scale(1.0)" }}>
                <SocialRadar levels={levels} labels={labels} />
              </div>
            </div>
          </div>
        </article>
      </div>
      {/* Mounted per route, for the same reason as PosterPage's — see the note there. */}
      <Toaster bareBottom />
    </div>
  );
}
