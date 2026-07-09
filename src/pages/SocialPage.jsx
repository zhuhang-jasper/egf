import { useLayoutEffect, useMemo, useRef, useState } from "react";

import { Chart, Filler, LineElement, PointElement, RadarController, RadialLinearScale } from "chart.js";

import { BackToToolButton } from "@/components/BackToToolButton";

import { createClusterBackgroundPlugin } from "@/chart/plugins";
import { FE_UI, getPillarLabel, getPillarOrder, SITE_COPY } from "@/constants";
import { pillarLevelsToArray } from "@/constants/levels";
import { track } from "@/utils/analytics";
import { copyShareToClipboard, downloadSharePng } from "@/utils/export-image";
import { loadProfilesFromStorage } from "@/utils/storage";

// Fixed design canvas — a 1200×630 landscape card (the canonical Open Graph / LinkedIn
// link-share aspect ratio). Renders at this exact pixel size (the page scrolls if the
// window is smaller) so the export is 1:1.
const CANVAS_W = 1200;
const CANVAS_H = 630;

// The saved profile to feature on the card. Matched case-insensitively by title.
const FEATURED_PROFILE_TITLE = "Jasper Loo";

/** Keep only the leading emoji from a "🤲 Coding (Hands)" label → "🤲" for an icon-only spoke. */
function shortPillarLabel(label) {
  const m = label.match(/^(?<lead>\S+)/u);
  return m ? m.groups.lead : label;
}

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
const FE_PILLAR_ORDER = getPillarOrder("fe");

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
      const nudge = FE_PILLAR_LABEL_NUDGE[FE_PILLAR_ORDER[i]];
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
          clusterBackground: { trackVariant: "fe" },
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

/** Load the featured saved profile (by title) once, falling back to a sample shape. */
function useFeaturedLevels() {
  return useMemo(() => {
    const wanted = FEATURED_PROFILE_TITLE.trim().toLowerCase();
    const profiles = loadProfilesFromStorage();
    const found = profiles.find(
      (p) =>
        String(p.title ?? "")
          .trim()
          .toLowerCase() === wanted,
    );
    const pillarLevels = FALLBACK_PROFILE;
    const trackVariant = found?.trackVariant ?? "fe";
    return {
      levels: pillarLevelsToArray(pillarLevels, trackVariant),
      labels: getPillarOrder(trackVariant).map((id) => shortPillarLabel(getPillarLabel(id))),
    };
  }, []);
}

export default function SocialPage() {
  const cardRef = useRef(null);
  const [busy, setBusy] = useState(null); // null | "copy" | "download"
  const [copyState, setCopyState] = useState("idle"); // idle | done | error
  const [downloadState, setDownloadState] = useState("idle");
  const [errMsg, setErrMsg] = useState("");
  const scale = useFitScale();
  const { levels, labels } = useFeaturedLevels();

  const runExport = async (action, fn, setState) => {
    if (!cardRef.current || busy) {
      return;
    }
    setBusy(action);
    setErrMsg("");
    try {
      await fn(cardRef.current);
      track("social_exported", { action });
      setState("done");
      setTimeout(() => setState("idle"), 2000);
    } catch (err) {
      console.error(`Social PNG ${action} failed:`, err);
      setErrMsg(String(err?.message || err));
      setState("error");
      setTimeout(() => setState("idle"), 4000);
    } finally {
      setBusy(null);
    }
  };

  const handleCopy = () => runExport("copy", copySocialToClipboard, setCopyState);
  const handleDownload = () => runExport("download", downloadSocialPng, setDownloadState);

  const copyLabel = busy === "copy" ? "Copying…" : { idle: "⧉ Copy PNG", done: "✓ Copied", error: "Copy failed" }[copyState];
  const downloadLabel = busy === "download" ? "Saving…" : { idle: "↓ Download", done: "✓ Saved", error: "Save failed" }[downloadState];

  return (
    <div className="flex w-full flex-col items-center overflow-x-hidden overflow-y-auto bg-black p-4">
      <BackToToolButton />
      <div className="shrink-0" style={{ width: CANVAS_W * scale, height: CANVAS_H * scale }}>
        <article
          ref={cardRef}
          className="relative flex flex-col overflow-hidden bg-white px-12 py-9 shadow-2xl"
          style={{ width: CANVAS_W, height: CANVAS_H, transform: `scale(${scale})`, transformOrigin: "top left" }}
        >
          {/* Floating export controls — inside the card (scale with it), excluded from the PNG. */}
          <div className="absolute top-4 right-4 z-10 flex flex-col items-end gap-1" data-export-ignore>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleCopy}
                disabled={Boolean(busy)}
                className="cursor-pointer rounded-lg bg-slate-400/60 px-4 py-2 text-[18px] font-semibold text-white hover:bg-slate-400 disabled:cursor-wait disabled:opacity-60"
              >
                {copyLabel}
              </button>
              <button
                type="button"
                onClick={handleDownload}
                disabled={Boolean(busy)}
                className="cursor-pointer rounded-lg bg-slate-400/60 px-4 py-2 text-[18px] font-semibold text-white hover:bg-slate-400 disabled:cursor-wait disabled:opacity-60"
              >
                {downloadLabel}
              </button>
            </div>
            {(copyState === "error" || downloadState === "error") && errMsg ? (
              <span className="max-w-[320px] rounded-md bg-red-600 px-2 py-1 text-right text-[13px] font-medium text-white">{errMsg}</span>
            ) : null}
          </div>

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
    </div>
  );
}
