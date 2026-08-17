import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { Chart, Filler, LineElement, PointElement, RadarController, RadialLinearScale } from "chart.js";
import { Settings } from "lucide-react";

import { BackToToolButton } from "@/components/BackToToolButton";
import { MalaysiaFlag } from "@/components/MalaysiaFlag";

import { TICK_FONT_FAMILY } from "@/chart/instance";
import { createClusterBackgroundPlugin } from "@/chart/plugins";
import { CLUSTERS, FE_UI, getPillarLabel, getPillarOrder, LAYER, SITE_COPY } from "@/constants";
import { CAREER_TRACK_PROFILES, PILLAR_CLUSTER_GROUPS } from "@/constants/theory-data";
import { track } from "@/utils/analytics";
import { copyShareToClipboard, downloadSharePng } from "@/utils/export-image";

// Design canvas WIDTH, rendered at this exact pixel width so the export is 1:1. No matching height constant:
// bands toggle independently, so height is `auto` and `useMeasuredHeight` reads it back out.
const CANVAS_W = 1080;

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

const POSTER_LEVELS = getPillarOrder().map((id) => POSTER_PROFILE[id] ?? 3);

const CLUSTER_META = {
  technical: { color: CLUSTERS.technical.color, accent: CLUSTERS.technical.textColor },
  product: { color: CLUSTERS.product.color, accent: CLUSTERS.product.textColor },
  operational: { color: CLUSTERS.operational.color, accent: CLUSTERS.operational.textColor },
};

// Lookups keyed by pillar id, derived from the theory data, so the ring cards reuse the
// canonical signature questions and cluster colours.
const PILLAR_INFO = Object.fromEntries(
  PILLAR_CLUSTER_GROUPS.flatMap((group) =>
    group.pillars.map((p) => [
      p.id,
      {
        question: p.signatureQuestion,
        color: CLUSTER_META[group.id].color,
        accent: CLUSTER_META[group.id].accent,
      },
    ]),
  ),
);

/** Split a "🤲 Coding (Hands)" label into its leading emoji and the short name without the organ. */
function splitPillarLabel(label) {
  const m = label.match(/^(?<emoji>\S+)\s+(?<rest>.*)$/u);
  const emoji = m ? m.groups.emoji : "";
  const rest = (m ? m.groups.rest : label).replace(/\s*\([^)]*\)\s*$/, "").trim();
  return { emoji, name: rest };
}

// The 9 pillars in radar-axis order, each tagged with the angle of its axis so the ring
// card and the chart spoke line up. Axis 0 is at the top (12 o'clock); axes step clockwise.
const RING_PILLARS = getPillarOrder().map((id, i, arr) => {
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
// the key pillars (as chips), and the S-level → role ladder. No prose. People & Delivery has a
// 5th rung (S7 CTO); the first four (S3–S6) still align row-for-row with the other two tracks.
const TRACKS = CAREER_TRACK_PROFILES.map((t) => ({
  id: t.id,
  name: t.name,
  ...TRACK_TONE[t.id],
  levels: t.levels,
  keyPillars: (t.id === "product-focused" ? ["Domain Logic", "Product Sense", "UI/UX", "Communication"] : t.keyFocusPillars)
    .map((nm) => PILLAR_BY_NAME[nm])
    .filter(Boolean),
  // Poster-only guard on the People & Delivery S3 rung, which must stay ONE line on the poster.
  // Theory currently supplies this exact string, so the map is a no-op today; it stays as a pin so a
  // longer theory title (e.g. "Senior Engineer (via Track 1/2)") can't silently wrap the rung here.
  roleLevels: t.roleLevels.map((r) => {
    if (t.id !== "people-delivery") {
      return r;
    }
    if (r.level === "S3") {
      return { ...r, title: "Senior Engineer (Track 1/2)" };
    }
    return r;
  }),
}));

/**
 * Visual fit-scale for the preview only, fitting the viewport WIDTH. renderShareBlob strips the transform
 * before capture, so the export stays pixel-exact while the preview scales.
 */
function useFitScale() {
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const compute = () => {
      const padX = 32; // matches the outer p-4 (16px × 2 sides)
      // clientWidth excludes the scrollbar, so the scaled poster never overflows into it.
      setScale(Math.min(1, Math.max(0.1, (document.documentElement.clientWidth - padX) / CANVAS_W)));
    };
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, []);
  return scale;
}

/**
 * The article's own rendered height in CANVAS pixels — measured, not summed, so it cannot drift from the
 * real layout. `/ scale` undoes the preview transform; rounded UP so a fractional height cannot crop a
 * device pixel off the export.
 */
function useMeasuredHeight(ref, scale) {
  const [height, setHeight] = useState(null);
  useEffect(() => {
    const node = ref.current;
    if (!node || typeof ResizeObserver === "undefined") {
      return undefined;
    }
    const measure = () => {
      const rect = node.getBoundingClientRect();
      if (scale > 0 && rect.height > 0) {
        setHeight(Math.ceil(rect.height / scale));
      }
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref, scale]);
  return height;
}

// The poster's PNG export runs through the shared share-image pipeline (font embedding, the off-screen
// clone, canvas mirroring, snapdom capture) — see src/utils/export-image.js. Height is passed per call
// rather than baked in, since it is whatever the content came out to (see useMeasuredHeight).
const POSTER_FILENAME = "9-pillar-engineer-growth-framework-poster.png";
const copyPosterToClipboard = (node, height) => copyShareToClipboard(node, CANVAS_W, height, "poster");
const downloadPosterPng = (node, height) => downloadSharePng(node, CANVAS_W, height, POSTER_FILENAME, "poster");

/**
 * The credit line at the foot of the paper. Shares the chart export's ownership head but ends on the app URL
 * rather than the framework name, which the masthead above already carries — see SITE_COPY.share.
 *
 * A plain DOM element, unlike the chart export's hand-painted canvas band: the poster is rasterized from the
 * DOM by snapdom, so it needs no measuring, and it renders on screen exactly as it will in the PNG.
 *
 * ONE GAP FOR EVERY BAND — `mt-10`, the literal match for the paper's `pb-10`, so the credit sits in an even
 * 40px band whichever band precedes it. Keep it flat: if a band reads loose against it, the fault is that
 * band's own bottom margin, so fix it there (the ring's `mb-3` was the first such case) rather than tuning this
 * number per band.
 *
 * `spaced` is false only when every band is off, leaving the credit alone on the paper with the top padding as
 * its whole margin.
 *
 * SLATE-500 AND WEIGHT 400, the one credit grey and the one credit weight, shared by every footer in the app:
 * this one, the app footer's screen and print forms (pages/HomePage.jsx), and the chart export's painted band
 * (exportImageAttributionColor in styles/ui.js and measureAttribution in utils/copy-chart-image.js, where the
 * reasoning lives). No `font-medium` here for that reason. Tailwind's class rather than the constant because this
 * footer is ordinary DOM — but if the grey changes, it changes in both.
 */
function PosterCredit({ spaced }) {
  return (
    <p className={`shrink-0 text-center text-[19px] text-slate-500 ${spaced ? "mt-10" : ""}`}>
      {SITE_COPY.share.posterAttribution}
    </p>
  );
}

/** Big tracking-wide divider label used between the poster's content bands. */
function SectionLabel({ children }) {
  return (
    <div className="flex shrink-0 items-center gap-4">
      <span className="h-[4px] flex-1 rounded-full bg-slate-200" />
      <h2 className="text-[26px] font-bold uppercase tracking-[0.16em] text-slate-500">{children}</h2>
      <span className="h-[4px] flex-1 rounded-full bg-slate-200" />
    </div>
  );
}

// Radial ring geometry, in poster pixels. The ring is an ellipse — wider than tall — so the
// nine cards spread across the available width and stay clear of one another top-to-bottom.
const RING_W = 984; // stage width (canvas minus side padding)
// The ring's LAYOUT BOX, not the height the band occupies on paper. Every label's `cy` is measured from
// `RING_H / 2`, so this is the ring's vertical ORIGIN as much as its size — changing it moves all nine labels
// rather than trimming the box. Deliberately taller than the labels need, to keep the placement math simple;
// `PillarRing` measures their real union and pulls the band in to fit, so the slack costs nothing on paper.
const RING_H = 620;
const RING_RX = 300; // horizontal radius to each label centre
const RING_RY = 250; // vertical radius to each label centre — pulled in toward the hub
// Diagonal/corner labels (Architecture, Domain Logic, Process, Product Sense…) sit closer to
// their neighbours and the hub, so push them further out by up to this much; |sin(2θ)| peaks
// at the 45° diagonals and is zero at the cardinal (top/bottom/side) positions.
const RING_CORNER_BOOST = 64;
const CARD_W = 360; // label width — wide enough for the longest question to fit in exactly 2 rows
const CHART_SIZE = 400; // box for the centred radar hub — larger so its grid reaches the labels
// Track-card radar. A constant, not a Tailwind arbitrary value, because PosterRadar renders at an
// explicit px size (responsive off) and the two must not drift apart.
const TRACK_CHART_SIZE = 170;

// Per-pillar manual nudges (px) after the ring math, to relieve specific crowding.
const RING_NUDGE = {
  domainLogic: { x: -110, y: 75 }, // top diagonals — spread wider apart and lower
  architecture: { x: 110, y: 75 },
  uiUx: { x: -80, y: 15 }, // side labels — push further out
  ai: { x: 80, y: 15 },
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
 * One pillar's label floating on the ring at its axis angle — no card chrome, just text, aligned toward the
 * centre based on which side of the ring it sits on.
 */
function PillarNode({ pillar }) {
  const rad = (pillar.angleDeg * Math.PI) / 180;
  const boost = RING_CORNER_BOOST * Math.abs(Math.sin(2 * rad)); // 0 at cardinals, max at 45° diagonals
  const nudge = RING_NUDGE[pillar.id] ?? { x: 0, y: 0 };
  const cx = RING_W / 2 + (RING_RX + boost) * Math.cos(rad) + nudge.x;
  const cy = RING_H / 2 + (RING_RY + boost) * Math.sin(rad) + nudge.y;
  const cos = Math.cos(rad);
  const alignClass = ringAlignClass(cos);
  const emojiAfter = cos < -0.25; // left-side labels: emoji trails the name, staying close to the radar hub
  const flipCoding = false; // set true to put question above and name below for the coding (top) pillar
  const flip = flipCoding && pillar.id === "coding";
  const nameRow = (
    <div className="flex items-center gap-2">
      {!emojiAfter && <span className="text-[30px] leading-none">{pillar.emoji}</span>}
      <span className="text-[26px] font-extrabold leading-tight tracking-tight" style={{ color: pillar.accent }}>
        {pillar.name}
      </span>
      {emojiAfter && <span className="text-[30px] leading-none">{pillar.emoji}</span>}
    </div>
  );
  const questionRow = (
    <p className="mt-0.5 text-pretty text-[20px] font-semibold italic leading-[1.25] text-slate-600" style={{ textWrap: "balance" }}>
      ”{pillar.question}”
    </p>
  );
  return (
    <div className={`absolute flex flex-col ${alignClass}`} style={{ width: CARD_W, left: cx, top: cy, transform: "translate(-50%, -50%)" }}>
      {flip ? questionRow : nameRow}
      {flip ? nameRow : questionRow}
    </div>
  );
}

Chart.register(RadarController, RadialLinearScale, PointElement, LineElement, Filler);

/**
 * Self-contained square radar. Unlike StaticCompetencyChart it does NOT auto-measure its frame.
 *
 * NOT `responsive`, which is a bug fix: the poster renders under a `transform: scale()`, and Chart.js's
 * observer sizes the canvas from the SCALED rect inside an unscaled box, collapsing it to a blob.
 *
 * @param levels       per-pillar values in fe order
 * @param size         edge length in px — must match the box, since nothing measures it
 * @param showClusters draw the colour-coded cluster wedges (the track mini-charts use this)
 * @param showPolygon  draw the data polygon (false on the hub → just a labelled L1–L5 grid)
 * @param showTicks    show the L1–L5 ring tick labels
 * @param lineWidth    stroke width
 */
function PosterRadar({ levels, size, showClusters = false, showPolygon = true, showTicks = false, lineWidth = 3, pointRadius = 3 }) {
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
        responsive: false,
        maintainAspectRatio: false,
        animation: false,
        backgroundColor: "transparent",
        layout: { padding: showTicks ? 2 : 6 },
        plugins: {
          legend: { display: false },
          tooltip: { enabled: false },
          clusterBackground: {},
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
              font: { size: 20, weight: "bold", family: TICK_FONT_FAMILY },
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
  }, [levels, size, showClusters, showPolygon, showTicks, lineWidth, pointRadius]);
  // width/height ATTRIBUTES, not CSS: with responsive off these are the render size Chart.js draws at,
  // and the matching CSS box keeps the bitmap 1:1 with its layout box (the poster's own scale does the
  // visual sizing). devicePixelRatio still applies on top, so the export stays sharp.
  return <canvas ref={canvasRef} width={size} height={size} style={{ width: size, height: size }} aria-label="competency radar chart" />;
}

/**
 * Chart hub + ring of 9 floating pillar labels. TWO NESTED BOXES: the inner is the fixed `RING_W × RING_H`
 * coordinate space labels are positioned against, the outer is what the paper sees, clamped to their measured
 * union. Rects are in SCALED screen pixels, divided by `rect.width / RING_W` to recover the scale.
 */
function PillarRing() {
  const innerRef = useRef(null);
  // null until measured — until then the band reserves the full RING_H, which is the pre-existing
  // behaviour and never smaller than the fit, so the first paint can't clip anything.
  const [fit, setFit] = useState(null);

  useEffect(() => {
    const inner = innerRef.current;
    if (!inner || typeof ResizeObserver === "undefined") {
      return undefined;
    }
    const measure = () => {
      const base = inner.getBoundingClientRect();
      // Recover the CSS-transform scale from the box whose unscaled width we already know.
      const scale = base.width / RING_W;
      if (!(scale > 0)) {
        return;
      }
      let top = Infinity;
      let bottom = -Infinity;
      for (const child of inner.children) {
        const r = child.getBoundingClientRect();
        top = Math.min(top, (r.top - base.top) / scale);
        bottom = Math.max(bottom, (r.bottom - base.top) / scale);
      }
      if (Number.isFinite(top) && Number.isFinite(bottom)) {
        // Clamp to the layout box: the labels' boxes overhang it horizontally (and the paper clips that),
        // so refuse to report a fit taller than the space the positions were computed in.
        setFit({ top: Math.max(0, Math.floor(top)), height: Math.min(RING_H, Math.ceil(bottom - Math.max(0, top))) });
      }
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(inner);
    for (const child of inner.children) {
      observer.observe(child);
    }
    return () => observer.disconnect();
  }, []);

  return (
    // `overflow-hidden` on the clamp box: once it is shorter than RING_H, the inner box's unused bottom
    // slack must not push the paper's own height back out.
    <div className="relative mx-auto overflow-hidden" style={{ width: RING_W, height: fit ? fit.height : RING_H }}>
      {/* Lifted by the measured top slack, so trimming the box crops empty space rather than the labels. */}
      <div ref={innerRef} className="absolute left-0" style={{ width: RING_W, height: RING_H, top: fit ? -fit.top : 0 }}>
        {/* Centre radar — point labels hidden; the ring cards ARE the labels */}
        <div className="absolute" style={{ width: CHART_SIZE, height: CHART_SIZE, left: "50%", top: "50%", transform: "translate(-50%, -50%)" }}>
          {/* Centre: cluster-coloured L1–L5 radial grid — data polygon hidden; the ring labels carry the meaning */}
          <PosterRadar levels={POSTER_LEVELS} size={CHART_SIZE} showClusters showPolygon={false} showTicks />
        </div>
        {RING_PILLARS.map((p) => (
          <PillarNode key={p.id} pillar={p} />
        ))}
      </div>
    </div>
  );
}

/**
 * One track column: its characteristic radar SHAPE, the key pillars as emoji chips, and the
 * L-level → role ladder. No prose — the visual shape carries the meaning.
 */
function TrackCard({ careerTrack }) {
  return (
    <div
      className="flex min-w-0 flex-col rounded-3xl px-3 py-3"
      style={{ backgroundColor: `${careerTrack.color}47`, border: `3px solid ${careerTrack.color}` }}
    >
      <h4 className="text-center text-[25px] font-extrabold leading-tight tracking-tight" style={{ color: careerTrack.accent }}>
        {careerTrack.name}
      </h4>

      {/* Characteristic chart shape — with cluster background colour */}
      <div className="relative mx-auto mt-2" style={{ width: TRACK_CHART_SIZE, height: TRACK_CHART_SIZE }}>
        <PosterRadar levels={careerTrack.levels} size={TRACK_CHART_SIZE} showClusters lineWidth={2.5} pointRadius={0} />
      </div>

      {/* Key pillars — plain names, no emoji. Fixed height (2 rows) so the role ladders below
          start at the same Y across all three cards and align row-for-row. */}
      <div className="-mx-3 flex h-[80px] flex-wrap content-center justify-center gap-[4px] overflow-hidden">
        {careerTrack.keyPillars.map((p) => (
          <span
            key={p.id}
            className="rounded-full bg-white px-2.5 py-[3px] text-[19px] font-bold"
            style={{ color: careerTrack.accent, boxShadow: `inset 0 0 0 2.5px ${careerTrack.color}` }}
          >
            {p.name}
          </span>
        ))}
      </div>

      {/* S-level → role ladder — grows to fill the card and distributes its rows evenly, so the
          ladders bottom-align across cards even when one track has an extra rung (S7 CTO). */}
      <div className="mt-3 flex flex-1 flex-col justify-between gap-3">
        {careerTrack.roleLevels.map((r) => (
          <div key={r.level} className="flex items-center gap-2">
            <span
              className="shrink-0 rounded-md px-2 py-[1px] text-center text-[18px] font-extrabold text-white"
              style={{ backgroundColor: careerTrack.accent }}
            >
              {r.level}
            </span>
            <span className="min-w-0 text-[20px] font-semibold leading-tight text-slate-700 -mr-2">
              {r.level === "S5"
                ? r.title.split(" / ").map((part, i) => (
                    /* `whitespace-nowrap`, not a natural wrap — "Principal Software Engineer" sits within a
                       pixel or two of this box, so fit varied by DPR and pushed one card's ladder a row taller.
                       The split at " / " already says where the breaks go. */
                    <span key={part} className="block whitespace-nowrap tracking-tight">
                      {i > 0 ? `/ ${part}` : part}
                    </span>
                  ))
                : r.title}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * One toggle row, a copy of ChartSection's `DisplayCheckbox` rather than an import since this menu needs its
 * own colours for the poster's BLACK chrome. `select-none` so repeated clicks do not select the label.
 */
function PosterToggle({ label, checked, onChange }) {
  return (
    <label className="flex cursor-pointer select-none items-center gap-2.5 rounded-md px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100">
      <input
        type="checkbox"
        checked={checked}
        aria-label={label}
        onChange={(e) => onChange(e.target.checked)}
        className="size-3.5 shrink-0 rounded border border-slate-300 accent-slate-900"
      />
      <span>{label}</span>
    </label>
  );
}

/**
 * Which bands the poster shows. State is owned by the PAGE, not the app store: view state for one admin
 * page, unlike the tool's toggles which are part of the persisted draft.
 */
function PosterSettingsMenu({ showHeader, setShowHeader, showPillars, setShowPillars, showTracks, setShowTracks, showCredit, setShowCredit }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    const onKey = (e) => {
      if (e.key === "Escape") {
        setOpen(false);
      }
    };
    const onMouse = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onMouse);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onMouse);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Poster display settings"
        onClick={() => setOpen((v) => !v)}
        className="flex size-8 cursor-pointer items-center justify-center rounded-lg border border-white/20 bg-white/10 text-white transition-colors hover:bg-white/20"
      >
        <Settings className="size-4" aria-hidden />
      </button>
      {open ? (
        <div
          role="menu"
          aria-label="Poster display settings"
          className={`absolute left-1/2 top-[calc(100%+4px)] w-max -translate-x-1/2 rounded-lg border border-slate-300 bg-white py-1 shadow-lg ${LAYER.dropdown}`}
        >
          <PosterToggle label="Masthead" checked={showHeader} onChange={setShowHeader} />
          <PosterToggle label="The 9 Pillars" checked={showPillars} onChange={setShowPillars} />
          <PosterToggle label="3 Career Tracks" checked={showTracks} onChange={setShowTracks} />
          <PosterToggle label="Attribution" checked={showCredit} onChange={setShowCredit} />
        </div>
      ) : null}
    </div>
  );
}

export default function PosterPage() {
  const posterRef = useRef(null);
  // Which action (if any) is running, and the transient result of the last one.
  const [busy, setBusy] = useState(null); // null | "copy" | "download"
  const [copyState, setCopyState] = useState("idle"); // idle | done | error
  const [downloadState, setDownloadState] = useState("idle");
  const [errMsg, setErrMsg] = useState("");
  // Which bands the paper carries. All on by default — the full poster is what this page is for.
  const [showHeader, setShowHeader] = useState(true);
  const [showPillars, setShowPillars] = useState(true);
  const [showTracks, setShowTracks] = useState(true);
  const [showCredit, setShowCredit] = useState(true);
  const scale = useFitScale();
  // Null until the first measurement lands (one frame). Callers fall back to a width-based estimate
  // rather than 0, so the stage doesn't collapse and re-expand on mount.
  const measuredHeight = useMeasuredHeight(posterRef, scale);
  const canvasH = measuredHeight ?? Math.round(CANVAS_W * 1.5);

  const runExport = async (action, fn, setState) => {
    if (!posterRef.current || busy) {
      return;
    }
    setBusy(action);
    setErrMsg("");
    try {
      await fn(posterRef.current, canvasH);
      // Height and bands ride along because the poster is no longer one fixed artifact: without them
      // an export event can't be told apart from any other shape the toggles produce.
      const bands = [showHeader && "header", showPillars && "pillars", showTracks && "tracks", showCredit && "credit"].filter(Boolean).join("+") || "none";
      track("poster_exported", { action, height: canvasH, bands });
      setState("done");
      setTimeout(() => setState("idle"), 2000);
    } catch (err) {
      console.error(`Poster PNG ${action} failed:`, err);
      setErrMsg(String(err?.message || err));
      setState("error");
      setTimeout(() => setState("idle"), 4000);
    } finally {
      setBusy(null);
    }
  };

  const handleCopy = () => runExport("copy", copyPosterToClipboard, setCopyState);
  const handleDownload = () => runExport("download", downloadPosterPng, setDownloadState);

  const copyLabel = busy === "copy" ? "Copying…" : { idle: "⧉ Copy PNG", done: "✓ Copied", error: "Copy failed" }[copyState];
  const downloadLabel = busy === "download" ? "Saving…" : { idle: "↓ Download", done: "✓ Saved", error: "Save failed" }[downloadState];

  return (
    /* `min-h-dvh` IS WHAT KEEPS THE BLACK GOING PAST THE CANVAS — `body` no longer paints black itself (it
       carries the app's `bg-slate-100`), so a portrait canvas in a wide window would leave a pale slab below
       it otherwise. `min-h`, not `h`: a taller canvas still has to grow this box and scroll. */
    <div className="flex min-h-dvh w-full flex-col items-center overflow-x-hidden overflow-y-auto bg-black p-4">
      {/* TOP CHROME ROW: back link left, settings centred, canvas size right. Spans the viewport rather than
          the canvas's scaled width, which would mean threading the runtime scale up here.

          THE SIZE LABEL IS OUT HERE, NOT IN THE EXPORT CLUSTER, so it cannot reach the rasterized PNG at all
          rather than relying on the `data-export-ignore` opt-out. Its numbers are the export's own.

          THE SETTINGS BUTTON IS ABSOLUTELY CENTRED, not a third flex child — that would centre it in the
          leftover space between two items of unequal width, which reads as visibly off-centre. */}
      <div className="relative mb-4 flex w-full items-center justify-between gap-3">
        <BackToToolButton />
        <div className="pointer-events-none absolute inset-x-0 flex justify-center">
          <div className="pointer-events-auto">
            <PosterSettingsMenu
              showHeader={showHeader}
              setShowHeader={setShowHeader}
              showPillars={showPillars}
              setShowPillars={setShowPillars}
              showTracks={showTracks}
              setShowTracks={setShowTracks}
              showCredit={showCredit}
              setShowCredit={setShowCredit}
            />
          </div>
        </div>
        <span className="shrink-0 select-none text-sm font-semibold tabular-nums text-white">
          {CANVAS_W} × {canvasH}
        </span>
      </div>
      {/* Scaling stage: reserves the scaled footprint so the canvas stays centred and scrolls cleanly; the
          article inside keeps its true pixel size for export. Its height tracks the MEASURED article height,
          so switching a band off reclaims the page scroll instead of leaving a tall gap below the paper. */}
      <div className="shrink-0" style={{ width: CANVAS_W * scale, height: canvasH * scale }}>
        {/* Fixed-WIDTH paper canvas, auto height — rendered 1:1 then visually scaled so the export is
            pixel-exact. `overflow-hidden` STAYS and is load-bearing HORIZONTALLY: the ring's labels are
            `CARD_W`-wide boxes reaching to -85px and 1069px against a 0–1080 canvas, and what hangs over is
            empty box only while clipped. Removing it lets those boxes widen the paper. */}
        <article
          ref={posterRef}
          /* `pt-10` PAIRS WITH THE MASTHEAD, NOT WITH THE PAPER: a SectionLabel is a divider and wants less
             air than a title, so with the header off that gap would read deeper than the bottom edge. Bottom
             padding is unconditional, since the last band ends on ordinary content either way. */
          className={`relative flex flex-col overflow-hidden bg-white px-10 pb-10 shadow-2xl ${showHeader ? "pt-10" : "pt-6"}`}
          style={{ width: CANVAS_W, transform: `scale(${scale})`, transformOrigin: "top left" }}
        >
          {/* Floating export controls — inside the poster (scale with it), top-right, excluded from
              the rasterized PNG via the data-export-ignore selector in renderShareBlob. */}
          <div className="absolute top-5 right-5 z-10 flex flex-col items-end gap-1" data-export-ignore>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleCopy}
                disabled={Boolean(busy)}
                className="cursor-pointer select-none rounded-lg bg-slate-400/60 px-4 py-2 text-[18px] font-semibold text-white hover:bg-slate-400 disabled:cursor-wait disabled:opacity-60"
              >
                {copyLabel}
              </button>
              <button
                type="button"
                onClick={handleDownload}
                disabled={Boolean(busy)}
                className="cursor-pointer select-none rounded-lg bg-slate-400/60 px-4 py-2 text-[18px] font-semibold text-white hover:bg-slate-400 disabled:cursor-wait disabled:opacity-60"
              >
                {downloadLabel}
              </button>
            </div>
            {(copyState === "error" || downloadState === "error") && errMsg ? (
              <span className="max-w-[320px] rounded-md bg-red-600 px-2 py-1 text-right text-[13px] font-medium text-white">{errMsg}</span>
            ) : null}
          </div>

          {/* Header — poster masthead with oversized "9" mark. Every toggled band is UNMOUNTED rather than
              hidden, because the paper's height is measured (see useMeasuredHeight) and `invisible` would
              leave its full height as a blank strip. Switching this off is what produces the ring-only
              artwork for the README, which already carries the title and tagline as text. */}
          {showHeader ? (
            <header>
              <div className="flex items-stretch gap-4">
                {/* Big "9" reads as part of the title; no wasted eyebrow line beside it */}
                <span className="text-[132px] font-extrabold leading-[0.8] tracking-tighter text-slate-900 -translate-y-1">9</span>
                <div className="flex min-w-0 flex-1 flex-col justify-center">
                  <div className="flex items-end justify-between gap-6">
                    <h1 className="shrink-0 whitespace-nowrap text-[52px] font-extrabold leading-[1] tracking-tight text-slate-900">
                      Pillar Engineer
                      <br />
                      Growth Framework
                    </h1>
                    {/* Byline as a signature, sitting on the "Engineering Mastery" baseline.
                        Inline, not flex: the flag aligns itself with `vertical-align`. */}
                    <span className="self-end text-[24px] font-bold whitespace-nowrap text-slate-900">
                      {SITE_COPY.byline}
                      {" "}
                      {/* No tooltip: this page gets rasterized. */}
                      <MalaysiaFlag />
                    </span>
                  </div>
                </div>
              </div>

              <p className="mt-3 px-3 text-[24px] leading-snug text-slate-700">
                {SITE_COPY.tagline} <span className="text-slate-700">{SITE_COPY.detail}</span>
              </p>
            </header>
          ) : null}

          {/* The 9 pillars as a radial ring around the central radar. No negative top margin any more —
              PillarRing trims its own top edge now, so the band sits on the ordinary gap.
              NO BOTTOM MARGIN, deliberately: it used to carry `mb-3`, which on top of the credit's flat
              `mt-10` made this band sit ~12px looser than the tracks card's hard border. Dropping it (rather
              than cancelling it with `-mb-3`, which overshoots by the same 12px) leaves the credit an even 40px
              above and below. The ring's labels end on their own text, so no extra correction is wanted. */}
          {showPillars ? (
            <div className={`flex flex-col gap-3 ${showHeader ? "mt-6" : ""}`}>
              <SectionLabel>The 9 Pillars</SectionLabel>
              <PillarRing />
            </div>
          ) : null}

          {/* Career tracks — foundational S1–S2 phase, then three columns that split at S3. A plain `mt-6`
              whenever something is above (not `-mt-2`: PillarRing trims its own bottom edge now), dropped
              entirely when this band is first on the paper, matching the ring band's own rule. */}
          {showTracks ? (
            <div className={`flex flex-col gap-3 ${showHeader || showPillars ? "mt-6" : ""}`}>
              <SectionLabel>3 Career Tracks</SectionLabel>

              {/* Foundational phase: everyone starts here, then forks at Senior (S3) */}
              <div
                className="mt-1 flex items-center gap-4 rounded-2xl px-4 py-2"
                style={{ backgroundColor: `${CLUSTER_META.technical.color}47`, border: `3px solid ${CLUSTER_META.technical.color}` }}
              >
                <span
                  className="shrink-0 rounded-md px-2 py-[1px] text-center text-[18px] font-extrabold text-white"
                  style={{ backgroundColor: CLUSTER_META.technical.accent }}
                >
                  S1–S2
                </span>
                <span className="shrink-0 text-[24px] font-extrabold" style={{ color: CLUSTER_META.technical.accent }}>
                  Software Engineer
                </span>
                <span className="ml-3 min-w-0 translate-y-[1px] text-[20px] text-slate-700">Build the technical foundation everyone shares.</span>
              </div>

              <div className="grid grid-cols-3 items-stretch gap-3">
                {TRACKS.map((careerTrack) => (
                  <TrackCard key={careerTrack.name} careerTrack={careerTrack} />
                ))}
              </div>
            </div>
          ) : null}

          {/* Credit line — always last on the paper, so it reads as the poster's footer whichever bands are on.
              One gap for every band, balancing the paper's own bottom padding (see PosterCredit). */}
          {showCredit ? <PosterCredit spaced={showHeader || showPillars || showTracks} /> : null}
        </article>
      </div>
    </div>
  );
}
