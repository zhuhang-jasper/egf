import { Chart, Filler, Legend, LineElement, PointElement, RadarController, RadialLinearScale, Tooltip } from "chart.js";

import { createClusterBackgroundPlugin } from "@/chart/plugins";
import { applyRadarCenterFit, syncFontsForChart } from "@/chart/radar-center";
import { resolveChartUi, THEORY_CHART_UI } from "@/chart/theory-profile";
import { FE_UI, getChartLabels, getPillarOrder, getPlainChartLabels, normalizeTrackVariant, PILLAR_COUNT } from "@/constants";

Chart.register(RadarController, RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

function buildHumanDataset(label, data) {
  const d = FE_UI.dataset;
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
  if (chart?.options?.plugins?.competencyChart?.purpose === "theory") {
    ticks.display = false;
    return;
  }
  const ch = FE_UI.chart;
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

function syncPointLabelColors(chart, focusedPillars) {
  const pointLabels = chart?.options?.scales?.r?.pointLabels;
  if (!pointLabels) {
    return;
  }
  if (!focusedPillars?.length) {
    pointLabels.color = resolveChartUi(chart).chart.pointLabelColor;
    return;
  }
  const ui = resolveChartUi(chart).chart;
  const focused = new Set(focusedPillars);
  pointLabels.color = (ctx) => (focused.has(chart.data.labels[ctx.index]) ? ui.pointLabelColor : ui.pointLabelDimColor);
}

function syncChartLabels(chart, trackVariant) {
  const plain = chart?.options?.plugins?.competencyChart?.plainLabels;
  chart.data.labels = plain ? getPlainChartLabels(trackVariant) : getChartLabels(trackVariant);
}

function syncChartPlugins(chart, trackVariant) {
  const track = normalizeTrackVariant(trackVariant);
  chart.options.plugins.clusterBackground = {
    ...(chart.options.plugins.clusterBackground ?? {}),
    trackVariant: track,
  };
}

/** Push app state into the chart and redraw. */
export function applyChartState(chart, state) {
  if (!chart) {
    return;
  }
  const trackVariant = normalizeTrackVariant(state.trackVariant);
  const orderLen = getPillarOrder(trackVariant).length;
  syncChartPlugins(chart, trackVariant);
  syncChartLabels(chart, trackVariant);
  const levels = Array.isArray(state.levels) ? state.levels : [];
  chart.data.datasets[0].data = levels.length === orderLen ? [...levels] : new Array(orderLen).fill(0);
  syncDatasets(chart, { levels: chart.data.datasets[0].data, title: state.title });
  syncPolygonVisibility(chart, state.levelsPolygonHidden);
  syncLevelTicksVisibility(chart, state.chartLevelTicksHidden);
  syncPointLabelsVisibility(chart, Boolean(state.pointLabelsHidden));
  syncPointLabelColors(chart, state.focusedPillars);
  chart.update("none");
}

export function refreshChart(chart, state) {
  if (!chart) {
    return;
  }
  chart.resize();
  applyChartState(chart, state);
  syncFontsForChart(chart);
}

export function createCompetencyChart(canvas, { purpose = "tool" } = {}) {
  const isTheory = purpose === "theory";
  const ui = isTheory ? THEORY_CHART_UI : FE_UI;
  const ch = ui.chart;
  const chart = new Chart(canvas, {
    type: "radar",
    data: {
      labels: isTheory ? getPlainChartLabels("fe") : getChartLabels("fe"),
      datasets: [buildHumanDataset(" ", new Array(PILLAR_COUNT).fill(0))],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      backgroundColor: "transparent",
      layout: { padding: { ...ch.layoutPadding } },
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
            padding: ch.pointLabelPadding,
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
        competencyChart: { purpose, plainLabels: isTheory },
      },
    },
    plugins: [createClusterBackgroundPlugin()],
  });
  return chart;
}
