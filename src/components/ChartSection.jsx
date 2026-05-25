import { useCallback, useRef, useState } from "react";

import { ChartAverages } from "@/components/ChartAverages";
import { CompetencyChart } from "@/components/CompetencyChart";
import { Button } from "@/components/ui/button";

import { useChartFrameMargins } from "@/hooks/useChartFrameMargins";

import { syncLevelDatasetsVisibility } from "@/lib/chart/dataset-visibility";
import { copyChartAsImageToClipboard } from "@/lib/copy-chart-image";

import { useAppStore } from "@/store/useAppStore";

import clusterLegendImage from "@/assets/cluster-legend-export.png";

export function ChartSection() {
  const exportRef = useRef(null);
  const canvasRef = useRef(null);
  const frameRef = useRef(null);
  const legendRef = useRef(null);
  const chartInstanceRef = useRef(null);
  const [copyLabel, setCopyLabel] = useState("Copy image");

  const title = useAppStore((s) => s.title);
  const levelsPolygonHidden = useAppStore((s) => s.levelsPolygonHidden);
  const setLevelsPolygonHidden = useAppStore((s) => s.setLevelsPolygonHidden);

  const syncMargins = useChartFrameMargins(frameRef, legendRef);
  const onChartReady = useCallback((chart) => {
    chartInstanceRef.current = chart;
  }, []);

  const trimmedTitle = String(title).trim();
  const showHeading = trimmedTitle.length > 0;

  const toggleLevelsPolygonHidden = useCallback(() => {
    const nextHidden = !levelsPolygonHidden;
    const chart = chartInstanceRef.current;
    if (chart && syncLevelDatasetsVisibility(chart, nextHidden)) {
      chart.update("none");
    }
    setLevelsPolygonHidden(nextHidden);
  }, [levelsPolygonHidden, setLevelsPolygonHidden]);

  const handleCopy = async () => {
    try {
      const result = await copyChartAsImageToClipboard({
        exportRoot: exportRef.current,
        canvas: canvasRef.current,
        chart: chartInstanceRef.current,
        titleText: trimmedTitle || " ",
      });
      if (result?.method === "clipboard") {
        setCopyLabel("Copied!");
      } else if (result?.method === "download") {
        setCopyLabel("Saved file");
      } else {
        setCopyLabel("Failed");
      }
    } catch (e) {
      console.error(e);
      setCopyLabel("Failed");
    }
    setTimeout(() => setCopyLabel("Copy image"), 2000);
  };

  return (
    <div className="flex w-full min-w-0 flex-col items-center">
      <div className="relative z-[2] mb-4 flex w-full justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={handleCopy}>
          {copyLabel}
        </Button>
        <Button type="button" variant="outline" size="sm" aria-expanded={!levelsPolygonHidden} onClick={toggleLevelsPolygonHidden}>
          {levelsPolygonHidden ? "Show chart" : "Hide chart"}
        </Button>
      </div>

      <div ref={exportRef} className="flex w-full min-w-0 flex-col self-stretch">
        {showHeading ? (
          <h2 id="competency-chart-heading" className="relative z-[1] mb-2 w-full text-center text-xl font-semibold text-[#222]">
            {title}
          </h2>
        ) : (
          <h2 id="competency-chart-heading" className="sr-only">
            Chart
          </h2>
        )}

        <div ref={legendRef} className="pointer-events-none mb-0 max-w-full self-start pl-2 leading-none" aria-hidden>
          <img
            src={clusterLegendImage}
            width={200}
            height={116}
            alt=""
            className="block h-auto max-w-[min(125px,18vw)] w-auto"
            onLoad={syncMargins}
          />
        </div>

        <div ref={frameRef} className="relative z-0 mx-auto w-full max-w-full box-border">
          <div className="absolute inset-0 min-h-0 min-w-0">
            <canvas ref={canvasRef} id="competencyChart" aria-labelledby="competency-chart-heading" />
            <CompetencyChart canvasRef={canvasRef} onChartReady={onChartReady} onResize={syncMargins} />
          </div>
        </div>

        <ChartAverages />
      </div>
    </div>
  );
}
