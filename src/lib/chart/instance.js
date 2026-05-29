import { Chart, Filler, Legend, LineElement, PointElement, RadarController, RadialLinearScale, Tooltip } from "chart.js";

import { createClusterBackgroundPlugin, createTechnicalAsteriskPlugin } from "@/lib/chart/plugins";
import { applyRadarCenterFit, syncFontsForChart } from "@/lib/chart/radar-center";
import { AI_AUGMENTATION_ENABLED, FE_UI, getChartLabels, PILLAR_COUNT } from "@/lib/constants";

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

function buildAiDataset(data) {
  const d = FE_UI.datasetAi;
  return {
    label: d.label,
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
    pointHoverBackgroundColor: d.pointHoverBackgroundColor,
    pointHoverBorderColor: d.pointHoverBorderColor,
    pointHoverBorderWidth: d.pointHoverBorderWidth,
  };
}

function syncDatasets(chart, { levels, aiLevels, title }) {
  if (!chart?.data?.datasets?.[0]) {
    return;
  }
  chart.data.datasets[0].data = Array.isArray(levels) ? [...levels] : [];
  chart.data.datasets[0].label = String(title).trim() || " ";
  if (chart.data.datasets[1]) {
    chart.data.datasets[1].data = Array.isArray(aiLevels) ? [...aiLevels] : [];
  }
}

function syncPolygonVisibility(chart, hidden) {
  if (!chart) {
    return;
  }
  const visible = !hidden;
  for (let i = 0; i < chart.data.datasets.length; i++) {
    if (chart.isDatasetVisible(i) !== visible) {
      chart.setDatasetVisibility(i, visible);
    }
  }
}

function syncChartLabels(chart, trackVariant) {
  chart.data.labels = getChartLabels(trackVariant);
}

/** Push app state into the chart and redraw. */
export function applyChartState(chart, state) {
  if (!chart) {
    return;
  }
  syncChartLabels(chart, state.trackVariant);
  syncDatasets(chart, state);
  syncPolygonVisibility(chart, state.levelsPolygonHidden);
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

export function createCompetencyChart(canvas) {
  const plugins = [createClusterBackgroundPlugin()];
  if (AI_AUGMENTATION_ENABLED) {
    plugins.push(createTechnicalAsteriskPlugin());
  }

  const ch = FE_UI.chart;
  const chart = new Chart(canvas, {
    type: "radar",
    data: {
      labels: getChartLabels("fe"),
      datasets: [
        buildHumanDataset(" ", new Array(PILLAR_COUNT).fill(0)),
        ...(AI_AUGMENTATION_ENABLED ? [buildAiDataset(new Array(PILLAR_COUNT).fill(0))] : []),
      ],
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
      },
    },
    plugins,
  });
  return chart;
}
