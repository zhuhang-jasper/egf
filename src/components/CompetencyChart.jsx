import { useEffect, useRef } from "react";

import { Chart, Filler, Legend,LineElement, PointElement, RadarController, RadialLinearScale, Tooltip } from "chart.js";

import { createHeptagonBackgroundPlugin, createTechnicalAsteriskPlugin } from "@/lib/chart/plugins";
import { applyRadarCenterFit, syncFontsForChart } from "@/lib/chart/radar-center";
import { CHART_LABELS, FE_UI } from "@/lib/constants";
import { AI_FEATURE_ENABLED } from "@/lib/flags";

import { useAppStore } from "@/store/useAppStore";

import heptagonImage from "@/assets/7-pillar-heptagon-v1.png";

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
  if (!ds) {return;}
  const d = ds.data;
  for (let k = 0; k < values.length; k++) {
    d[k] = values[k];
  }
  d.length = values.length;
}

export function CompetencyChart({ canvasRef, onChartReady, onResize }) {
  const chartRef = useRef(null);
  const heptagonRef = useRef(null);
  const levels = useAppStore((s) => s.levels);
  const aiLevels = useAppStore((s) => s.aiLevels);
  const title = useAppStore((s) => s.title);
  const levelsPolygonHidden = useAppStore((s) => s.levelsPolygonHidden);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || chartRef.current) {return;}

    const heptagonImg = new Image();
    heptagonImg.src = heptagonImage;
    heptagonRef.current = heptagonImg;

    const plugins = [createHeptagonBackgroundPlugin(heptagonImg)];
    if (AI_FEATURE_ENABLED) {plugins.push(createTechnicalAsteriskPlugin());}

    let cancelled = false;

    const ch = FE_UI.chart;
    const chart = new Chart(canvas, {
      type: "radar",
      data: {
        labels: CHART_LABELS,
        datasets: [
          buildHumanDataset(" ", new Array(7).fill(0)),
          ...(AI_FEATURE_ENABLED ? [buildAiDataset(new Array(7).fill(0))] : []),
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
                if (value === 0) {return "0";}
                if (value === 6) {return "";}
                return `L${  value}`;
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
        plugins: { legend: { display: false } },
      },
      plugins,
    });

    chartRef.current = chart;
    onChartReady?.(chart);

    const onLoad = () => {
      if (cancelled || chartRef.current !== chart) {return;}
      chart.update();
      requestAnimationFrame(() => {
        if (!cancelled && chartRef.current === chart) {syncFontsForChart(chart);}
      });
    };
    if (heptagonImg.complete) {onLoad();}
    else {heptagonImg.addEventListener("load", onLoad);}

    requestAnimationFrame(() => {
      if (!cancelled && chartRef.current === chart) {syncFontsForChart(chart);}
    });

    return () => {
      cancelled = true;
      heptagonImg.removeEventListener("load", onLoad);
      chart.destroy();
      chartRef.current = null;
    };
  }, [canvasRef, onChartReady, onResize]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) {return;}

    const n = chart.data.labels.length;
    const humanData = levelsPolygonHidden ? new Array(n).fill(null) : [...levels];
    const aiData = levelsPolygonHidden ? new Array(n).fill(null) : [...aiLevels];

    writeDatasetInPlace(chart.data.datasets[0], humanData);
    chart.data.datasets[0].label = String(title).trim() || " ";
    if (chart.data.datasets[1]) {
      writeDatasetInPlace(chart.data.datasets[1], aiData);
    }
    chart.update();
  }, [levels, aiLevels, title, levelsPolygonHidden]);

  return null;
}
