import { useLayoutEffect, useRef, useState } from "react";

import { Chart, Filler, LineElement, PointElement, RadarController, RadialLinearScale } from "chart.js";

import { createClusterBackgroundPlugin } from "@/chart/plugins";
import { CLUSTERS, FE_UI, getPillarLabel, getPillarOrder, SITE_COPY } from "@/constants";
import { CAREER_TRACK_PROFILES, PILLAR_CLUSTER_GROUPS } from "@/constants/theory-data";

// Fixed design canvas — a 2:3 poster portrait (1080×1620). Wider than a phone-screen
// 9:16 so it reads well in the LinkedIn feed, but long enough for large, poster-scale
// type across the header, radar, pillars, and tracks bands. The canvas renders at this
// exact pixel size (the page scrolls if the window is smaller) so the export is 1:1.
const CANVAS_W = 1080;
const CANVAS_H = 1620;

// A deliberately well-rounded-but-varied profile so the radar reads as a rich,
// asymmetric shape rather than a flat ring — purely illustrative for the poster.
const POSTER_PROFILE = {
  coding: 4.5,
  domainLogic: 4,
  architecture: 4,
  ai: 3.5,
  uiUx: 3,
  productSense: 3.5,
  process: 4,
  communication: 4.5,
  ownership: 5,
};

const POSTER_LEVELS = getPillarOrder("fe").map((id) => POSTER_PROFILE[id] ?? 3);

const CLUSTER_META = {
  technical: { color: CLUSTERS.technical.color, accent: CLUSTERS.technical.textColor },
  product: { color: CLUSTERS.product.color, accent: CLUSTERS.product.textColor },
  operational: { color: CLUSTERS.operational.color, accent: CLUSTERS.operational.textColor },
};

// Lookups keyed by pillar id, derived from the theory data, so the ring cards reuse the
// canonical signature questions and cluster colours.
const PILLAR_INFO = Object.fromEntries(
  PILLAR_CLUSTER_GROUPS.flatMap((group) =>
    group.pillars.map((p) => [p.id, { question: p.signatureQuestion, color: CLUSTER_META[group.id].color, accent: CLUSTER_META[group.id].accent }]),
  ),
);

/** Split a "🤲 Coding (Hands)" label into its leading emoji and the short name without the organ. */
function splitPillarLabel(label) {
  const m = label.match(/^(\S+)\s+(.*)$/u);
  const emoji = m ? m[1] : "";
  const rest = (m ? m[2] : label).replace(/\s*\([^)]*\)\s*$/, "").trim();
  return { emoji, name: rest };
}

// The 9 pillars in radar-axis order, each tagged with the angle of its axis so the ring
// card and the chart spoke line up. Axis 0 is at the top (12 o'clock); axes step clockwise.
const RING_PILLARS = getPillarOrder("fe").map((id, i, arr) => {
  const { emoji, name } = splitPillarLabel(getPillarLabel(id));
  const angleDeg = (360 / arr.length) * i - 90;
  return { id, emoji, name, angleDeg, ...PILLAR_INFO[id] };
});

// Emoji + cluster colour keyed by the plain pillar name (no organ), so a track's
// keyFocusPillars (e.g. "Domain Logic") resolve to chips.
const PILLAR_BY_NAME = Object.fromEntries(RING_PILLARS.map((p) => [p.name, p]));

// Each track's colour follows its dominant cluster.
function clusterTone(id) {
  return { color: CLUSTERS[id].color, accent: CLUSTERS[id].textColor };
}
const TRACK_TONE = {
  "deep-technical": clusterTone("technical"),
  "product-focused": clusterTone("product"),
  "people-delivery": clusterTone("operational"),
};

// Career tracks rebuilt from the canonical profiles: the characteristic chart shape,
// the key pillars (as chips), and the L-level → role ladder. No prose. People & Delivery has a
// 5th rung (L7 CTO); the first four (L3–L6) still align row-for-row with the other two tracks.
const TRACKS = CAREER_TRACK_PROFILES.map((t) => ({
  id: t.id,
  name: t.name,
  ...TRACK_TONE[t.id],
  levels: t.levels,
  keyPillars: (t.id === "product-focused" ? ["Domain Logic", "Product Sense", "UI/UX", "Communication"] : t.keyFocusPillars)
    .map((nm) => PILLAR_BY_NAME[nm])
    .filter(Boolean),
  roleLevels: t.roleLevels,
}));

/**
 * Visual fit-scale for the preview only — fits the viewport WIDTH (the page scrolls
 * vertically). The poster renders at its true CANVAS_W×CANVAS_H pixels and is scaled with a
 * CSS transform. The transform does not affect html2canvas, which captures the node at its
 * intrinsic size — so the preview scales to width while the export stays a pixel-exact 1080×1620.
 */
function useFitScale() {
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const compute = () => {
      const padX = 48;
      setScale(Math.min(1, Math.max(0.1, (window.innerWidth - padX) / CANVAS_W)));
    };
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, []);
  return scale;
}

/** Rasterize the poster canvas to a high-res PNG download via html2canvas. */
async function exportPosterPng(node) {
  const { default: html2canvas } = await import("html2canvas");
  const canvas = await html2canvas(node, {
    backgroundColor: "#ffffff",
    scale: 2, // 2× → 2160×3000 export, crisp for LinkedIn
    useCORS: true,
    logging: false,
    width: CANVAS_W,
    height: CANVAS_H,
  });
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png", 1));
  if (!blob) {
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "9-pillar-engineer-growth-framework.png";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Big tracking-wide divider label used between the poster's content bands. */
function SectionLabel({ children }) {
  return (
    <div className="flex shrink-0 items-center gap-4">
      <span className="h-[4px] flex-1 rounded-full bg-slate-200" />
      <h2 className="text-[26px] font-extrabold uppercase tracking-[0.16em] text-slate-500">{children}</h2>
      <span className="h-[4px] flex-1 rounded-full bg-slate-200" />
    </div>
  );
}

// Radial ring geometry, in poster pixels. The ring is an ellipse — wider than tall — so the
// nine cards spread across the available width and stay clear of one another top-to-bottom.
const RING_W = 984; // stage width (canvas minus side padding)
const RING_H = 620; // stage height — trimmed so the bottom edge sits just under the lowest labels
const RING_RX = 300; // horizontal radius to each label centre
const RING_RY = 250; // vertical radius to each label centre — pulled in toward the hub
// Diagonal/corner labels (Architecture, Domain Logic, Process, Product Sense…) sit closer to
// their neighbours and the hub, so push them further out by up to this much; |sin(2θ)| peaks
// at the 45° diagonals and is zero at the cardinal (top/bottom/side) positions.
const RING_CORNER_BOOST = 64;
const CARD_W = 360; // label width — wide enough for the longest question to fit in exactly 2 rows
const CHART_SIZE = 400; // box for the centred radar hub — larger so its grid reaches the labels

// Per-pillar manual nudges (px) after the ring math, to relieve specific crowding.
const RING_NUDGE = {
  domainLogic: { x: -110, y: 75 }, // top diagonals — spread wider apart and lower
  architecture: { x: 110, y: 75 },
  uiUx: { x: -75, y: 15 }, // side labels — push further out
  ai: { x: 75, y: 15 },
  communication: { x: -120, y: -42 }, // bottom-centre pair — pull apart and lift up
  ownership: { x: 120, y: -42 },
  productSense: { x: -70, y: -50 }, // bottom diagonals — lifted up and pushed out
  process: { x: 70, y: -50 },
};

/** Horizontal alignment for a floating label, based on which side of the ring it sits on. */
function ringAlignClass(cos) {
  if (Math.abs(cos) < 0.25) {
    return "items-center text-center";
  }
  return cos < 0 ? "items-end text-right" : "items-start text-left";
}

/**
 * One pillar's label floating on the ring at its axis angle — no card chrome, just text.
 * Text is aligned toward the centre based on which side of the ring it sits on, so the
 * floating labels read cleanly without visible box edges.
 */
function PillarNode({ pillar }) {
  const rad = (pillar.angleDeg * Math.PI) / 180;
  const boost = RING_CORNER_BOOST * Math.abs(Math.sin(2 * rad)); // 0 at cardinals, max at 45° diagonals
  const nudge = RING_NUDGE[pillar.id] ?? { x: 0, y: 0 };
  const cx = RING_W / 2 + (RING_RX + boost) * Math.cos(rad) + nudge.x;
  const cy = RING_H / 2 + (RING_RY + boost) * Math.sin(rad) + nudge.y;
  const alignClass = ringAlignClass(Math.cos(rad));
  return (
    <div className={`absolute flex flex-col ${alignClass}`} style={{ width: CARD_W, left: cx, top: cy, transform: "translate(-50%, -50%)" }}>
      <div className="flex items-center gap-2">
        <span className="text-[30px] leading-none">{pillar.emoji}</span>
        <span className="text-[26px] font-black leading-tight tracking-tight" style={{ color: pillar.accent }}>
          {pillar.name}
        </span>
      </div>
      <p className="mt-0.5 text-pretty text-[20px] font-semibold italic leading-[1.25] text-slate-500" style={{ textWrap: "balance" }}>
        “{pillar.question}”
      </p>
    </div>
  );
}

Chart.register(RadarController, RadialLinearScale, PointElement, LineElement, Filler);

/**
 * Self-contained square radar. Unlike StaticCompetencyChart it does NOT auto-measure/resize
 * its frame — it fills its box exactly, so it always renders large and centred (the auto-sizer
 * collapses to a tiny blob inside a transformed/absolute box). Labels and ticks are hidden;
 * the surrounding cards / chips are the labels.
 *
 * @param levels       per-pillar values in fe order
 * @param showClusters draw the colour-coded cluster wedges (the track mini-charts use this)
 * @param showPolygon  draw the data polygon (false on the hub → just a labelled L1–L5 grid)
 * @param showTicks    show the L1–L5 ring tick labels
 * @param lineWidth    stroke width
 */
function PosterRadar({ levels, showClusters = false, showPolygon = true, showTicks = false, lineWidth = 3, pointRadius = 3 }) {
  const canvasRef = useRef(null);
  useLayoutEffect(() => {
    const d = FE_UI.dataset;
    const ch = FE_UI.chart;
    const chart = new Chart(canvasRef.current, {
      type: "radar",
      data: {
        labels: levels.map(() => ""),
        datasets: [
          {
            data: levels,
            backgroundColor: showPolygon ? d.fill : "transparent",
            borderColor: showPolygon ? d.stroke : "transparent",
            borderWidth: showPolygon ? lineWidth : 0,
            pointRadius: showPolygon ? pointRadius : 0,
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
        layout: { padding: showTicks ? 2 : 6 },
        plugins: {
          legend: { display: false },
          tooltip: { enabled: false },
          // The cluster-background plugin reads trackVariant from its own options block.
          clusterBackground: { trackVariant: "fe" },
        },
        scales: {
          r: {
            min: 0,
            max: 5,
            ticks: {
              display: showTicks,
              stepSize: 1,
              color: ch.tickLabelColor,
              backdropColor: ch.tickBackdropColor,
              backdropPadding: { ...ch.tickBackdropPad },
              showLabelBackdrop: (ctx) => ctx.tick?.value >= 1 && ctx.tick?.value <= 5,
              font: { size: 20, weight: "bold" },
              callback: (v) => (v >= 1 && v <= 5 ? `L${v}` : ""),
              z: 1,
            },
            pointLabels: { display: false },
            angleLines: { color: FE_UI.chart.gridColor },
            grid: { circular: false, color: FE_UI.chart.gridColor },
          },
        },
      },
      plugins: showClusters ? [createClusterBackgroundPlugin()] : [],
    });
    return () => chart.destroy();
  }, [levels, showClusters, showPolygon, showTicks, lineWidth, pointRadius]);
  return <canvas ref={canvasRef} aria-label="competency radar chart" />;
}

/** Chart hub + ring of 9 pillar cards. Replaces the old separate chart and pillar-list bands. */
function PillarRing() {
  return (
    <div className="relative mx-auto -mt-1" style={{ width: RING_W, height: RING_H }}>
      {/* Centre radar — point labels hidden; the ring cards ARE the labels */}
      <div className="absolute" style={{ width: CHART_SIZE, height: CHART_SIZE, left: "50%", top: "50%", transform: "translate(-50%, -50%)" }}>
        {/* Centre: cluster-coloured L1–L5 radial grid — data polygon hidden; the ring labels carry the meaning */}
        <PosterRadar levels={POSTER_LEVELS} showClusters showPolygon={false} showTicks />
      </div>
      {RING_PILLARS.map((p) => (
        <PillarNode key={p.id} pillar={p} />
      ))}
    </div>
  );
}

/**
 * One track column: its characteristic radar SHAPE, the key pillars as emoji chips, and the
 * L-level → role ladder. No prose — the visual shape carries the meaning.
 */
function TrackCard({ track }) {
  return (
    <div className="flex min-w-0 flex-col rounded-3xl px-3 py-3" style={{ backgroundColor: `${track.color}24`, border: `3px solid ${track.color}` }}>
      <h4 className="text-center text-[25px] font-black leading-tight tracking-tight" style={{ color: track.accent }}>
        {track.name}
      </h4>

      {/* Characteristic chart shape — with cluster background colour */}
      <div className="relative mx-auto my-1 h-[180px] w-[180px]">
        <PosterRadar levels={track.levels} showClusters lineWidth={2.5} pointRadius={0} />
      </div>

      {/* Key pillars — plain names, no emoji. Fixed height (2 rows) so the role ladders below
          start at the same Y across all three cards and align row-for-row. */}
      <div className="-mx-3 flex h-[80px] flex-wrap content-center justify-center gap-[4px] overflow-hidden">
        {track.keyPillars.map((p) => (
          <span
            key={p.id}
            className="rounded-full bg-white/85 px-2.5 py-[3px] text-[19px] font-bold text-slate-700"
            style={{ boxShadow: `inset 0 0 0 2px ${track.color}` }}
          >
            {p.name}
          </span>
        ))}
      </div>

      {/* L-level → role ladder — grows to fill the card and distributes its rows evenly, so the
          ladders bottom-align across cards even when one track has an extra rung (L7 CTO). */}
      <div className="mt-3 flex flex-1 flex-col justify-between gap-[6px]">
        {track.roleLevels.map((r) => (
          <div key={r.level} className="flex items-center gap-2">
            <span
              className="w-[42px] shrink-0 rounded-md px-1 py-[1px] text-center text-[18px] font-black text-white"
              style={{ backgroundColor: track.accent }}
            >
              {r.level}
            </span>
            <span className="min-w-0 text-[20px] font-semibold leading-tight text-slate-700 -mr-2">{r.title}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PosterPage() {
  const posterRef = useRef(null);
  const [exporting, setExporting] = useState(false);
  const scale = useFitScale();

  const handleExport = async () => {
    if (!posterRef.current || exporting) {
      return;
    }
    setExporting(true);
    try {
      await exportPosterPng(posterRef.current);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex min-h-dvh w-full flex-col items-center overflow-auto bg-black p-4">
      {/* Scaling stage: reserves the scaled footprint so the canvas stays centred and
          scrolls cleanly; the article inside keeps its true pixel size for export. */}
      <div className="shrink-0" style={{ width: CANVAS_W * scale, height: CANVAS_H * scale }}>
        {/* Fixed-size paper canvas — rendered 1:1 (then visually scaled) so the export is pixel-exact.
            Bands take their natural height; justify-between distributes the remaining slack as gaps,
            so nothing overflows or overlaps. */}
        <article
          ref={posterRef}
          className="relative flex flex-col gap-5 overflow-hidden bg-white px-10 py-10 shadow-2xl"
          style={{ width: CANVAS_W, height: CANVAS_H, transform: `scale(${scale})`, transformOrigin: "top left" }}
        >
          {/* Floating export button — inside the poster (scales with it), top-right, excluded from
              the rasterized PNG via data-html2canvas-ignore. */}
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting}
            data-html2canvas-ignore="true"
            className="absolute top-5 right-5 z-10 rounded-lg bg-slate-400/60 px-4 py-2 text-[18px] font-semibold text-white hover:bg-slate-400 disabled:opacity-60"
          >
            {exporting ? "Exporting…" : "↓ PNG"}
          </button>

          {/* Header — poster masthead with oversized "9" mark */}
          <header>
            <div className="flex items-stretch gap-6">
              {/* Big "9" reads as part of the title; no wasted eyebrow line beside it */}
              <span className="text-[132px] font-black leading-[0.8] tracking-tighter text-slate-900 -translate-y-1.5">9</span>
              <div className="flex min-w-0 flex-1 flex-col justify-center">
                <h1 className="text-[52px] font-black leading-[0.92] tracking-tight text-slate-900">
                  Pillars of
                  <br />
                  Engineering Mastery
                </h1>
                <p className="mt-3 text-[20px] font-bold uppercase tracking-[0.22em] text-slate-400">The Engineer Growth Framework</p>
              </div>
              {/* Byline as a signature, pinned bottom-right of the masthead */}
              <span className="self-end text-[24px] font-bold whitespace-nowrap text-slate-800">{SITE_COPY.byline}</span>
            </div>

            <p className="mt-2 px-3 text-[24px] leading-snug text-slate-600">
              {SITE_COPY.tagline} <span className="font-semibold text-slate-500">{SITE_COPY.detail}</span>
            </p>
          </header>

          {/* The 9 pillars as a radial ring around the central radar — chart + labels merged.
              Negative top margin tucks the ring up close under the section header (the stage has
              empty space above its topmost labels). */}
          <div className="mt-0 flex flex-col gap-0">
            <SectionLabel>The 9 Pillars</SectionLabel>
            <PillarRing />
          </div>

          {/* Career tracks — foundational L1–L2 phase, then three columns that split at L3 */}
          <div className="-mt-6 flex flex-col gap-3">
            <SectionLabel>3 Career Tracks</SectionLabel>

            {/* Foundational phase: everyone starts here, then forks at Senior (L3) */}
            <div
              className="mt-0 flex items-center gap-4 rounded-2xl px-4 py-2"
              style={{ backgroundColor: `${CLUSTER_META.technical.color}24`, border: `3px solid ${CLUSTER_META.technical.color}` }}
            >
              <span
                className="shrink-0 rounded-md px-2 py-[1px] text-center text-[18px] font-black text-white"
                style={{ backgroundColor: CLUSTER_META.technical.accent }}
              >
                L1–L2
              </span>
              <span className="shrink-0 text-[24px] font-black" style={{ color: CLUSTER_META.technical.accent }}>
                Software Engineer
              </span>
              <span className="ml-3 min-w-0 translate-y-[1px] text-[20px] text-slate-700">Build the technical foundation everyone shares.</span>
            </div>

            <div className="grid grid-cols-3 items-stretch gap-3">
              {TRACKS.map((track) => (
                <TrackCard key={track.name} track={track} />
              ))}
            </div>
          </div>
        </article>
      </div>
    </div>
  );
}
