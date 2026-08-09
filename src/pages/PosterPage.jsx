import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { Chart, Filler, LineElement, PointElement, RadarController, RadialLinearScale } from "chart.js";
import { Settings } from "lucide-react";

import { BackToToolButton } from "@/components/BackToToolButton";

import { TICK_FONT_FAMILY } from "@/chart/instance";
import { createClusterBackgroundPlugin } from "@/chart/plugins";
import { CLUSTERS, FE_UI, getPillarLabel, getPillarOrder, SITE_COPY } from "@/constants";
import { CAREER_TRACK_PROFILES, PILLAR_CLUSTER_GROUPS } from "@/constants/theory-data";
import { track } from "@/utils/analytics";
import { copyShareToClipboard, downloadSharePng } from "@/utils/export-image";

// Design canvas WIDTH. Wide enough for poster-scale type and to read well in a LinkedIn feed. Rendered at
// this exact pixel width (the page scrolls if the window is smaller) so the export is 1:1.
//
// There is deliberately no matching height constant: either band can be switched off, so a fixed frame
// would leave a blank strip, and no table of per-combination heights would survive editing a band. The
// article's height is `auto` and `useMeasuredHeight` reads the result back out.
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
 * Visual fit-scale for the preview only — fits the viewport WIDTH (the page scrolls
 * vertically). The poster renders at its true pixel size and is scaled with a CSS transform; the
 * export path (renderShareBlob) strips that transform before capture, so the preview scales to
 * width while the export stays pixel-exact.
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
 * The article's own rendered height in CANVAS pixels.
 *
 * Measured, not computed: summing band heights in JS would be a second model of the layout that drifts
 * the first time a font metric, a wrap or a padding changes.
 *
 * `/ scale` converts back out of the preview transform, since consumers want the true unscaled height;
 * the `scale > 0` guard keeps a degenerate scale from producing Infinity. ResizeObserver rather than a
 * one-shot measure, because the height changes on band toggles, font load and chart settle. Rounded UP,
 * or a fractional height crops the last device pixel off the export.
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
// The ring's LAYOUT BOX — the coordinate space the labels are placed in, NOT the height the band
// occupies on the paper. Every label's `cy` is measured from `RING_H / 2`, so this number is the ring's
// vertical ORIGIN as much as its size: changing it moves all nine labels rather than trimming the box.
//
// It is deliberately taller than the labels need, because the ring is a circle of text with ragged top
// and bottom edges and the slack is what keeps the placement math simple. `PillarRing` then measures
// the labels' real union and pulls the band's own height in to fit (see the `fit` state there), so the
// slack costs nothing on the paper — which matters now that the paper is only as tall as its content.
const RING_H = 620;
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
  }, [levels, showClusters, showPolygon, showTicks, lineWidth, pointRadius]);
  return <canvas ref={canvasRef} aria-label="competency radar chart" />;
}

/**
 * Chart hub + ring of 9 floating pillar labels.
 *
 * TWO NESTED BOXES, because the ring's layout space and the space it fills differ. The inner box is the full
 * `RING_W × RING_H` coordinate space label positions are computed against and cannot shrink without moving
 * them; the outer box is what the paper sees, clamped to the measured union of the labels and hub.
 *
 * Measured rather than derived because label HEIGHTS are not known in JS: each wraps to one or two lines
 * depending on text and font metrics, and `translate(-50%, -50%)` makes the outer edges depend on that.
 *
 * Rects are in SCALED screen pixels (the poster is under a CSS transform), so measurements are taken
 * relative to the inner box's rect and divided by `rect.width / RING_W`, recovering the scale without this
 * component knowing it.
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
          <PosterRadar levels={POSTER_LEVELS} showClusters showPolygon={false} showTicks />
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
      <div className="relative mx-auto mt-2 h-[170px] w-[170px]">
        <PosterRadar levels={careerTrack.levels} showClusters lineWidth={2.5} pointRadius={0} />
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
                    <span key={part} className="block">
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
 * One toggle row in the poster settings menu. A copy of the tool tab's `DisplayCheckbox`
 * (see ChartSection) rather than an import: that one is local to that file, and this menu sits on the
 * poster page's BLACK chrome, so the row colours are the menu's own rather than the tool's `bg-muted`
 * surface. If a third caller ever appears, promote it to a shared component then.
 *
 * `select-none` because these rows get clicked repeatedly and a double-click would select the label.
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
 * Which bands the poster shows. Same interaction as the tool's chart-settings popover but without the
 * tooltip, since this is the only settings control on its row.
 *
 * State is owned by the PAGE, not this menu and not the app store: view state for one admin page with
 * nothing to restore across sessions, unlike the tool's toggles, which are part of the persisted draft.
 */
function PosterSettingsMenu({ showPillars, setShowPillars, showTracks, setShowTracks }) {
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
          className="absolute left-1/2 top-[calc(100%+4px)] z-50 w-max -translate-x-1/2 rounded-lg border border-slate-300 bg-white py-1 shadow-lg"
        >
          <PosterToggle label="The 9 Pillars" checked={showPillars} onChange={setShowPillars} />
          <PosterToggle label="3 Career Tracks" checked={showTracks} onChange={setShowTracks} />
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
  // Which bands the paper carries. Both on by default — the full poster is what this page is for.
  const [showPillars, setShowPillars] = useState(true);
  const [showTracks, setShowTracks] = useState(true);
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
      const bands = [showPillars && "pillars", showTracks && "tracks"].filter(Boolean).join("+") || "none";
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
    /* `min-h-dvh` IS WHAT KEEPS THE BLACK GOING PAST THE CANVAS. This box is `w-full` with no height of its
       own, so it stops at its content — and a portrait canvas scaled to fit a wide window leaves real space
       below it. That used to look fine only because `body` was ALSO black (index.css) and filled the gap; now
       that `body` carries the app's `bg-slate-100` surround, the leftover showed as a pale slab under the
       poster. The stage owns its own height rather than leaning on what happens to be behind it.
       `min-h`, not `h`: a canvas taller than the viewport still has to grow this box and scroll. */
    <div className="flex min-h-dvh w-full flex-col items-center overflow-x-hidden overflow-y-auto bg-black p-4">
      {/* TOP CHROME ROW: the back link at the left, the settings button centred, the canvas size at the right.
          Three unrelated things that happen to share a row, which is why the row lives here and none of them
          owns the others.

          `w-full` + `justify-between` is what gives them their ends. This page centres its children, so a bare
          link would be centred; the full-width row is also what the link's old `self-start` was working around.
          It spans the viewport rather than the canvas's scaled width — the canvas is scaled to fit at runtime,
          so matching it would mean threading that scale up here to place a static label.

          `mb-4` is the gap down to the canvas, which the link itself used to carry.

          THE SIZE LABEL IS OUT HERE, NOT IN THE CANVAS'S EXPORT CLUSTER, for two reasons: this row is on the
          page's black background, so plain white text works with no chip behind it, and being outside the
          `<article>` means it cannot end up in the rasterized PNG at all rather than relying on the
          `data-export-ignore` opt-out to strip it.

          The numbers are the same ones handed to the export, so the label cannot drift from what the export
          actually produces — and now that the height is measured rather than fixed, the label doubles as a
          readout of what the toggles below did to the paper.

          THE SETTINGS BUTTON IS ABSOLUTELY CENTRED, not the middle child of a `justify-between` row. Three
          flex children would put it at the centre of the LEFTOVER space between two items of unequal width
          (the back link is far wider than the size label), which reads as visibly off-centre. Taking it out
          of flow centres it on the row itself, and the two flanking items keep their ends. */}
      <div className="relative mb-4 flex w-full items-center justify-between gap-3">
        <BackToToolButton />
        <div className="pointer-events-none absolute inset-x-0 flex justify-center">
          <div className="pointer-events-auto">
            <PosterSettingsMenu showPillars={showPillars} setShowPillars={setShowPillars} showTracks={showTracks} setShowTracks={setShowTracks} />
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
        {/* Fixed-WIDTH paper canvas, auto height — rendered 1:1 (then visually scaled) so the export is
            pixel-exact. Bands stack from the top and take their natural height, and the paper ends where the
            last one does.

            `overflow-hidden` STAYS, and is load-bearing horizontally rather than vertically: the ring's labels
            are absolutely positioned `CARD_W`-wide boxes whose outer halves reach past the canvas edge (the
            widest span to -85px on the left and 1069px on the right, against a 0–1080 canvas). The text inside
            them is aligned toward the ring's centre, so what hangs over the edge is empty box — but only while
            it is clipped. Removing this would let those boxes widen the paper itself. */}
        <article
          ref={posterRef}
          className="relative flex flex-col overflow-hidden bg-white px-10 py-10 shadow-2xl"
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

          {/* Header — poster masthead with oversized "9" mark */}
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
                  {/* Byline as a signature, sitting on the "Engineering Mastery" baseline */}
                  <span className="self-end text-[24px] font-bold whitespace-nowrap text-slate-900">{SITE_COPY.byline}</span>
                </div>
                {/* <p className="mt-3 text-[20px] font-bold uppercase tracking-[0.22em] text-slate-500">The Engineer Growth Framework</p> */}
              </div>
            </div>

            <p className="mt-3 px-3 text-[24px] leading-snug text-slate-700">
              {SITE_COPY.tagline} <span className="text-slate-700">{SITE_COPY.detail}</span>
            </p>
          </header>

          {/* The 9 pillars as a radial ring around the central radar — chart + labels merged.

              No negative top margin any more: one used to tuck the ring up under the section header, since the
              stage reserved empty space above its topmost labels. PillarRing now trims that edge itself, so the
              band sits on the ordinary gap.

              Toggled by the settings menu. Unmounted rather than hidden, so the paper's measured height
              actually drops when it is off — `invisible`/`opacity-0` would keep occupying the stage. */}
          {showPillars ? (
            <div className="mt-6 flex flex-col gap-3 mb-3">
              <SectionLabel>The 9 Pillars</SectionLabel>
              <PillarRing />
            </div>
          ) : null}

          {/* Career tracks — foundational S1–S2 phase, then three columns that split at S3.

              A PLAIN `mt-6` IN BOTH CASES. This used to be `-mt-2`, a negative margin that existed to claw
              back the ring stage's empty bottom edge; PillarRing now trims that edge itself, so subtracting
              it again here would pull the tracks up into the lowest pillar labels. The same `mt-6` applies
              with the ring switched off, where the band simply follows the header. */}
          {showTracks ? (
            <div className="mt-6 flex flex-col gap-3">
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
        </article>
      </div>
    </div>
  );
}
