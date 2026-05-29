import { useCallback, useRef, useState } from "react";

import { ArrowUpFromLine } from "lucide-react";

import { ChartAverages } from "@/components/ChartAverages";
import { ChartDisplaySettings } from "@/components/ChartDisplaySettings";
import { CompetencyChart } from "@/components/CompetencyChart";
import { TrackBadge } from "@/components/TrackBadge";
import { TrackToggle } from "@/components/TrackToggle";
import { Button } from "@/components/ui/button";

import { useChartFrameMargins } from "@/hooks/useChartFrameMargins";

import { copyChartAsImageToClipboard } from "@/lib/copy-chart-image";
import { cn } from "@/lib/utils";

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
  const trackVariant = useAppStore((s) => s.trackVariant);
  const chartLegendHidden = useAppStore((s) => s.chartLegendHidden);

  const syncMargins = useChartFrameMargins(frameRef, legendRef);
  const onChartReady = useCallback((chart) => {
    chartInstanceRef.current = chart;
  }, []);

  const trimmedTitle = String(title).trim();
  const showHeading = trimmedTitle.length > 0;

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
      <div className="relative z-[2] mb-4 flex w-full min-w-0 items-center justify-between gap-2">
        <TrackToggle />
        <div className="flex shrink-0 items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={handleCopy}>
            <ArrowUpFromLine className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {copyLabel}
          </Button>
          <ChartDisplaySettings chartRef={chartInstanceRef} />
        </div>
      </div>

      <div ref={exportRef} className="flex w-full min-w-0 flex-col self-stretch">
        {showHeading ? (
          <h2 id="competency-chart-heading" className="relative z-[1] w-full text-center text-2xl font-bold text-black">
            {title}
          </h2>
        ) : (
          <h2 id="competency-chart-heading" className="sr-only">
            Chart
          </h2>
        )}

        <div
          ref={legendRef}
          className={cn(
            "mb-0 flex w-full min-w-0 items-start justify-between gap-2 px-2 leading-none",
            chartLegendHidden && "invisible pointer-events-none",
          )}
          aria-hidden={chartLegendHidden || undefined}
        >
          <img
            src={clusterLegendImage}
            width={200}
            height={116}
            alt=""
            aria-hidden
            className="pointer-events-none block h-auto max-w-[min(125px,18vw)] w-auto"
            onLoad={syncMargins}
          />
          <TrackBadge variant={trackVariant} size="md" className="shrink-0" />
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
