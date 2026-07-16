import { Chart, Filler, Legend, LineElement, PointElement, RadarController, RadialLinearScale, Tooltip } from "chart.js";

import { createClusterBackgroundPlugin } from "@/chart/plugins";
import { applyRadarCenterFit, syncFontsForChart } from "@/chart/radar-center";
import { isEmojiMode, resolveChartUi, THEORY_CHART_UI } from "@/chart/theory-profile";
import {
  FE_UI,
  getChartLabels,
  getEmojiChartLabels,
  getPillarClusterLabelColors,
  getPillarOrder,
  getPlainChartLabels,
  PILLAR_COUNT,
} from "@/constants";

Chart.register(RadarController, RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

function buildHumanDataset(label, data, dataset) {
  const d = dataset ?? FE_UI.dataset;
  return {
    label: label || " ",
    data,
    backgroundColor: d.fill,
    borderColor: d.stroke,
    borderWidth: d.lineWidth,
    pointRadius: d.pointRadius,
    pointHoverRadius: d.pointHoverRadius,
    pointStyle: d.pointStyle,
    pointBackgroundColor: d.pointFill,
    pointBorderColor: d.pointStroke,
    pointBorderWidth: d.pointBorderWidth,
    pointHoverBackgroundColor: d.pointHoverFill,
    pointHoverBorderColor: d.pointHoverStroke,
    pointHoverBorderWidth: d.pointHoverBorderWidth,
  };
}

function syncDatasets(chart, { levels, title }) {
  if (!chart?.data?.datasets?.[0]) {
    return;
  }
  chart.data.datasets[0].data = Array.isArray(levels) ? [...levels] : [];
  chart.data.datasets[0].label = String(title).trim() || " ";
}

function syncPolygonVisibility(chart, hidden) {
  if (!chart) {
    return;
  }
  const visible = !hidden;
  if (chart.isDatasetVisible(0) !== visible) {
    chart.setDatasetVisibility(0, visible);
  }
}

function syncLevelTicksVisibility(chart, hidden) {
  const ticks = chart?.options?.scales?.r?.ticks;
  if (!ticks) {
    return;
  }
  // Honor `hidden` for every preset. Theory doc charts pass hidden=true and keep their prior behavior
  // (ticks fully off, display=false — reserves no space, draws nothing); the theory hero opts its
  // L1–L5 ticks in. Colors come from the resolved preset so theory ticks match its palette. The tool
  // chart uses display=true + transparent-when-hidden so the radial metrics stay stable as it toggles.
  const ch = resolveChartUi(chart).chart;
  const isTheory = chart?.options?.plugins?.competencyChart?.purpose === "theory";
  if (isTheory && hidden) {
    ticks.display = false;
    return;
  }
  ticks.display = true;
  const color = hidden ? "transparent" : ch.tickLabelColor;
  const backdropColor = hidden ? "transparent" : ch.tickBackdropColor;
  if (ticks.color !== color) {
    ticks.color = color;
  }
  if (ticks.backdropColor !== backdropColor) {
    ticks.backdropColor = backdropColor;
  }
}

function syncPointLabelsVisibility(chart, hidden) {
  const pointLabels = chart?.options?.scales?.r?.pointLabels;
  if (!pointLabels) {
    return;
  }
  pointLabels.display = !hidden;
}

function syncPointLabelColors(chart, focusedPillars, clusterLabelColors) {
  const pointLabels = chart?.options?.scales?.r?.pointLabels;
  if (!pointLabels) {
    return;
  }
  const ui = resolveChartUi(chart).chart;

  // In emoji mode the spokes are icons, not text — no focus-dimming (the faded-label treatment has
  // nothing to fade), so every emoji renders at full color.
  const emoji = isEmojiMode(chart);

  // Per-cluster label colors (matching the poster's pillar-name palette). Positionally aligned with
  // the label array, so we key off ctx.index. Focus-dimming still applies on top when set.
  if (clusterLabelColors) {
    const colors = getPillarClusterLabelColors();
    const focused = !emoji && focusedPillars?.length ? new Set(focusedPillars) : null;
    pointLabels.color = (ctx) => {
      const clusterColor = colors[ctx.index] ?? ui.pointLabelColor;
      if (focused && !focused.has(chart.data.labels[ctx.index])) {
        return ui.pointLabelDimColor;
      }
      return clusterColor;
    };
    return;
  }

  if (emoji || !focusedPillars?.length) {
    pointLabels.color = ui.pointLabelColor;
    return;
  }
  const focused = new Set(focusedPillars);
  pointLabels.color = (ctx) => (focused.has(chart.data.labels[ctx.index]) ? ui.pointLabelColor : ui.pointLabelDimColor);
}

function syncChartLabels(chart) {
  const cc = chart?.options?.plugins?.competencyChart;
  if (isEmojiMode(chart)) {
    chart.data.labels = getEmojiChartLabels();
    return;
  }
  chart.data.labels = cc?.plainLabels ? getPlainChartLabels() : getChartLabels();
}

/** Allow chart state to flip a theory chart's plain labels on/off after creation (e.g. emoji labels). */
function syncPlainLabelsOption(chart, plainLabels) {
  if (plainLabels == null) {
    return;
  }
  const cc = chart.options.plugins.competencyChart;
  if (cc.plainLabels !== plainLabels) {
    cc.plainLabels = plainLabels;
  }
}

/** Emoji-only pillar labels (icon spokes, no text) — takes precedence over plain/emoji-full. */
function syncEmojiOnlyLabelsOption(chart, emojiOnlyLabels) {
  if (emojiOnlyLabels == null) {
    return;
  }
  const cc = chart.options.plugins.competencyChart;
  if (cc.emojiOnlyLabels !== emojiOnlyLabels) {
    cc.emojiOnlyLabels = emojiOnlyLabels;
  }
}

/**
 * Width threshold for responsive emoji↔text labels (see isEmojiMode): at/below this chart width the
 * spokes are emoji-only, above it they show full text. Overrides the emojiOnlyLabels boolean.
 */
function syncEmojiMaxWidthPxOption(chart, emojiMaxWidthPx) {
  const cc = chart.options.plugins.competencyChart;
  if (cc.emojiMaxWidthPx !== (emojiMaxWidthPx ?? undefined)) {
    cc.emojiMaxWidthPx = emojiMaxWidthPx ?? undefined;
  }
}

/** Per-chart point-label size multiplier (see syncFontsForChart) — lets one chart run larger labels. */
function syncPointLabelScaleOption(chart, pointLabelScale) {
  if (pointLabelScale == null) {
    return;
  }
  const cc = chart.options.plugins.competencyChart;
  if (cc.pointLabelScale !== pointLabelScale) {
    cc.pointLabelScale = pointLabelScale;
  }
}

/** Fixed point-label px (see syncFontsForChart) — pins label size independent of chart width. */
function syncPointLabelPxOption(chart, pointLabelPx) {
  const cc = chart.options.plugins.competencyChart;
  if (cc.pointLabelPx !== (pointLabelPx ?? undefined)) {
    cc.pointLabelPx = pointLabelPx ?? undefined;
  }
}

/**
 * Per-chart point-label size range (see syncFontsForChart) — linearly interpolates minPx→maxPx
 * across chart width so labels scale with the chart. Takes precedence over pointLabelPx.
 */
function syncPointLabelPxRangeOption(chart, pointLabelPxRange) {
  const cc = chart.options.plugins.competencyChart;
  const next = pointLabelPxRange ?? undefined;
  const prev = cc.pointLabelPxRange;
  const same =
    prev === next ||
    (prev &&
      next &&
      prev.minPx === next.minPx &&
      prev.maxPx === next.maxPx &&
      prev.minWidthPx === next.minWidthPx &&
      prev.maxWidthPx === next.maxWidthPx);
  if (!same) {
    cc.pointLabelPxRange = next;
  }
}

/** Push app state into the chart and redraw. */
/** Flags a theory chart as the hero radar so it uses the hero (not career-track) label nudge map. */
function syncHeroLabelNudgeOption(chart, heroLabelNudge) {
  const cc = chart.options.plugins.competencyChart;
  const next = Boolean(heroLabelNudge);
  if (cc.heroLabelNudge !== next) {
    cc.heroLabelNudge = next;
  }
}

// Duration (ms) for the opt-in data tween (see applyChartState's animateDataChanges). The radar
// points ease from their old values to the new ones; base geometry/labels stay put.
const DATA_TWEEN_MS = 500;

/**
 * Decide the Chart.js update mode. The app default is "none" (no animation) because the
 * layout/convergence pipeline relies on chart.resize() applying synchronously — an in-flight
 * animation makes Chart.js defer resize() and radius measurement reads stale dimensions.
 *
 * We only tween when the caller opts in (animateDataChanges) AND this is a pure data change:
 * the chart already holds a same-length, non-empty dataset (so it's laid out) and only the values
 * moved. First paint (prev all-zero / empty) and any length change fall back to "none" so the
 * chart doesn't swoop up from zero and the fit loop isn't disturbed. The fit loop itself goes
 * through refreshChart, which always forces "none", so this never runs during resize.
 */
function resolveUpdateMode(chart, prevData, nextData, animateDataChanges) {
  if (!animateDataChanges) {
    return "none";
  }
  const sameLength = prevData.length > 0 && prevData.length === nextData.length;
  const prevHadValues = prevData.some((v) => v > 0);
  const changed = sameLength && nextData.some((v, i) => v !== prevData[i]);
  return sameLength && prevHadValues && changed ? undefined : "none";
}

export function applyChartState(chart, state) {
  if (!chart) {
    return;
  }
  const orderLen = getPillarOrder().length;
  syncPlainLabelsOption(chart, state.plainLabels);
  syncEmojiOnlyLabelsOption(chart, state.emojiOnlyLabels);
  syncEmojiMaxWidthPxOption(chart, state.emojiMaxWidthPx);
  syncHeroLabelNudgeOption(chart, state.heroLabelNudge);
  syncPointLabelScaleOption(chart, state.pointLabelScale);
  syncPointLabelPxOption(chart, state.pointLabelPx);
  syncPointLabelPxRangeOption(chart, state.pointLabelPxRange);
  syncChartLabels(chart);
  const prevData = Array.isArray(chart.data.datasets[0].data) ? [...chart.data.datasets[0].data] : [];
  const levels = Array.isArray(state.levels) ? state.levels : [];
  const nextData = levels.length === orderLen ? [...levels] : new Array(orderLen).fill(0);
  chart.data.datasets[0].data = nextData;
  syncDatasets(chart, { levels: nextData, title: state.title });
  syncPolygonVisibility(chart, state.levelsPolygonHidden);
  syncLevelTicksVisibility(chart, state.chartLevelTicksHidden);
  syncPointLabelsVisibility(chart, Boolean(state.pointLabelsHidden));
  syncPointLabelColors(chart, state.focusedPillars, state.clusterLabelColors);

  const mode = resolveUpdateMode(chart, prevData, nextData, state.animateDataChanges);
  if (mode === undefined) {
    // Scope the tween to this one update; the option persists, so restore "no animation" right after
    // so nothing else (resize-driven refreshChart, next data swap's own decision) inherits it.
    chart.options.animation = { duration: DATA_TWEEN_MS };
    chart.update();
    chart.options.animation = false;
  } else {
    chart.update("none");
  }
}

export function refreshChart(chart, state) {
  if (!chart) {
    return;
  }
  chart.resize();
  // The fit/convergence loop must apply synchronously — never tween here, regardless of the
  // caller's animateDataChanges. (Also: resize can shift the data, which would otherwise be seen
  // as a "data change" and animate.)
  applyChartState(chart, { ...state, animateDataChanges: false });
  syncFontsForChart(chart);
}

export function createCompetencyChart(canvas, { purpose = "tool" } = {}) {
  const isTheory = purpose === "theory";
  const ui = isTheory ? THEORY_CHART_UI : FE_UI;
  const ch = ui.chart;
  const chart = new Chart(canvas, {
    type: "radar",
    data: {
      labels: isTheory ? getPlainChartLabels() : getChartLabels(),
      datasets: [buildHumanDataset(" ", new Array(PILLAR_COUNT).fill(0), ui.dataset)],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      // No animation: the layout/convergence pipeline relies on chart.resize() applying
      // synchronously. An in-flight animation (e.g. the initial construction update) makes
      // Chart.js defer resize() calls, so radius measurement reads stale dimensions. All app
      // updates already use mode "none", so this removes no intended motion.
      animation: false,
      backgroundColor: "transparent",
      layout: { padding: { top: 0, bottom: 0, left: ch.layoutPaddingHorizontal.minPx, right: ch.layoutPaddingHorizontal.minPx } },
      onResize: syncFontsForChart,
      scales: {
        r: {
          min: 0,
          max: 5,
          afterFit: applyRadarCenterFit,
          ticks: {
            display: !isTheory,
            color: ch.tickLabelColor,
            stepSize: 1,
            padding: 0,
            backdropPadding: { ...ch.tickBackdropPad },
            showLabelBackdrop(ctx) {
              const v = ctx.tick?.value;
              return v != null && v >= 1 && v <= 5;
            },
            backdropColor: ch.tickBackdropColor,
            callback(value) {
              if (value === 0) {
                return "0";
              }
              if (value === 6) {
                return "";
              }
              return `L${value}`;
            },
            font: { size: ch.tickInitialPx },
            z: 0,
          },
          pointLabels: {
            centerPointLabels: ch.centerPointLabels,
            padding: ch.pointLabelPaddingRange.minPx,
            font: { size: ch.pointLabelPx, weight: ch.pointLabelWeight },
            color: ch.pointLabelColor,
          },
          angleLines: { color: ch.gridColor },
          grid: { circular: false, color: ch.gridColor },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false },
        competencyChart: { purpose, plainLabels: isTheory, emojiOnlyLabels: false, emojiMaxWidthPx: undefined, heroLabelNudge: false },
      },
    },
    plugins: [createClusterBackgroundPlugin()],
  });
  return chart;
}
