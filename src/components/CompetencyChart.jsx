import { useEffect, useRef } from "react";

import { Chart, Filler, Legend, LineElement, PointElement, RadarController, RadialLinearScale, Tooltip } from "chart.js";

import { syncLevelDatasetsVisibility } from "@/lib/chart/dataset-visibility";
import { createClusterBackgroundPlugin, createTechnicalAsteriskPlugin, createTrackPointLabelPlugin } from "@/lib/chart/plugins";
import { applyRadarCenterFit, syncFontsForChart } from "@/lib/chart/radar-center";
import { FE_UI, getChartLayoutLabels, PILLAR_COUNT } from "@/lib/constants";
import { AI_AUGMENTATION_ENABLED } from "@/lib/flags";

import { useAppStore } from "@/store/useAppStore";

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

function writeDatasetInPlace(ds, values) {
  if (!ds) {
    return;
  }
  const d = ds.data;
  for (let k = 0; k < values.length; k++) {
    d[k] = values[k];
  }
  d.length = values.length;
}

function syncChartDatasets(chart, { levels, aiLevels, title }) {
  writeDatasetInPlace(chart.data.datasets[0], levels);
  chart.data.datasets[0].label = String(title).trim() || " ";
  if (chart.data.datasets[1]) {
    writeDatasetInPlace(chart.data.datasets[1], aiLevels);
  }
}

export function CompetencyChart({ canvasRef, onChartReady, onResize }) {
  const chartRef = useRef(null);
  const levels = useAppStore((s) => s.levels);
  const aiLevels = useAppStore((s) => s.aiLevels);
  const title = useAppStore((s) => s.title);
  const trackVariant = useAppStore((s) => s.trackVariant);
  const levelsPolygonHidden = useAppStore((s) => s.levelsPolygonHidden);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || chartRef.current) {
      return;
    }

    const plugins = [createClusterBackgroundPlugin(), createTrackPointLabelPlugin()];
    if (AI_AUGMENTATION_ENABLED) {
      plugins.push(createTechnicalAsteriskPlugin());
    }

    let cancelled = false;

    const ch = FE_UI.chart;
    const chart = new Chart(canvas, {
      type: "radar",
      data: {
        labels: getChartLayoutLabels(),
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
        onResize(c) {
          syncFontsForChart(c);
          onResize?.();
        },
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
              color: "transparent",
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

    chartRef.current = chart;
    syncChartDatasets(chart, useAppStore.getState());
    chart.update("none");
    onChartReady?.(chart);

    requestAnimationFrame(() => {
      if (!cancelled && chartRef.current === chart) {
        syncFontsForChart(chart);
      }
    });

    return () => {
      cancelled = true;
      chart.destroy();
      chartRef.current = null;
    };
  }, [canvasRef, onChartReady, onResize]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) {
      return;
    }

    syncChartDatasets(chart, { levels, aiLevels, title });
    chart.update("none");
  }, [levels, aiLevels, title]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) {
      return;
    }

    chart.update("none");
  }, [trackVariant]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) {
      return;
    }
    if (!syncLevelDatasetsVisibility(chart, levelsPolygonHidden)) {
      return;
    }
    chart.update("none");
  }, [levelsPolygonHidden]);

  return null;
}
