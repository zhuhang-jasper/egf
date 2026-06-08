import { useEffect, useRef, useState } from "react";

import { ArrowUpFromLine, Settings } from "lucide-react";

import { ChartAverages } from "@/components/ChartAverages";
import { ClusterLegend } from "@/components/ClusterLegend";
import { TrackBadge } from "@/components/TrackBadge";
import { TrackToggle } from "@/components/TrackToggle";
import { Button } from "@/components/ui/button";

import { useCompetencyChart } from "@/hooks/useCompetencyChart";
import { useElementWidth } from "@/hooks/useElementWidth";

import { getChartTitleSizePx, getClusterLegendMarginTopPx } from "@/lib/chart/fonts";
import { FE_UI, SCORES_VISIBLE_FROM_URL } from "@/lib/constants";
import { copyChartAsImageToClipboard } from "@/lib/copy-chart-image";

import { useAppStore } from "@/store/useAppStore";

function DisplayCheckbox({ label, checked, onChange }) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 rounded-md px-3 py-1.5 text-sm hover:bg-muted/60">
      <input
        type="checkbox"
        checked={checked}
        aria-label={label}
        onChange={(e) => onChange(e.target.checked)}
        className="size-3.5 shrink-0 rounded border border-input accent-foreground"
      />
      <span>{label}</span>
    </label>
  );
}

function ChartDisplayMenu() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  const chartLegendHidden = useAppStore((s) => s.chartLegendHidden);
  const setChartLegendHidden = useAppStore((s) => s.setChartLegendHidden);
  const levelsPolygonHidden = useAppStore((s) => s.levelsPolygonHidden);
  const setLevelsPolygonHidden = useAppStore((s) => s.setLevelsPolygonHidden);
  const chartTitleHidden = useAppStore((s) => s.chartTitleHidden);
  const setChartTitleHidden = useAppStore((s) => s.setChartTitleHidden);
  const footerScoresHidden = useAppStore((s) => s.footerScoresHidden);
  const setFooterScoresHidden = useAppStore((s) => s.setFooterScoresHidden);

  useEffect(() => {
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
    if (!open) {
      return undefined;
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onMouse);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onMouse);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative shrink-0">
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Chart display settings"
        title="Chart display settings"
        onClick={() => setOpen((v) => !v)}
      >
        <Settings className="h-4 w-4" />
      </Button>
      {open ? (
        <div
          role="menu"
          aria-label="Chart display settings"
          className="absolute right-0 top-[calc(100%+4px)] z-50 min-w-[10.5rem] rounded-lg border border-border bg-card py-1 shadow-md"
        >
          <DisplayCheckbox label="Title" checked={!chartTitleHidden} onChange={(v) => setChartTitleHidden(!v)} />
          <DisplayCheckbox label="Legend" checked={!chartLegendHidden} onChange={(v) => setChartLegendHidden(!v)} />
          <DisplayCheckbox label="Chart" checked={!levelsPolygonHidden} onChange={(v) => setLevelsPolygonHidden(!v)} />
          {SCORES_VISIBLE_FROM_URL ? (
            <DisplayCheckbox label="Scores" checked={!footerScoresHidden} onChange={(v) => setFooterScoresHidden(!v)} />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function ChartSection() {
  const exportRef = useRef(null);
  const canvasRef = useRef(null);
  const frameRef = useRef(null);
  const [copyLabel, setCopyLabel] = useState("Copy image");

  const title = useAppStore((s) => s.title);
  const trackVariant = useAppStore((s) => s.trackVariant);
  const chartLegendHidden = useAppStore((s) => s.chartLegendHidden);
  const chartTitleHidden = useAppStore((s) => s.chartTitleHidden);

  const { chartRef, relayout } = useCompetencyChart(canvasRef, frameRef);
  const chartWidth = useElementWidth(frameRef);

  const trimmedTitle = String(title).trim();
  const showVisibleTitle = !chartTitleHidden && trimmedTitle.length > 0;
  const showTitleRow = showVisibleTitle || !chartLegendHidden;
  const layoutWidth = chartWidth || FE_UI.page.minWidthPx;
  const titleSizePx = getChartTitleSizePx(layoutWidth);
  const legendMarginTopPx = getClusterLegendMarginTopPx(layoutWidth);

  useEffect(() => {
    relayout();
  }, [chartTitleHidden, chartLegendHidden, relayout]);

  const handleCopy = async () => {
    try {
      const result = await copyChartAsImageToClipboard({
        exportRoot: exportRef.current,
        canvas: canvasRef.current,
        chart: chartRef.current,
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
      <div className="relative z-[2] mb-3 flex w-full min-w-0 items-center justify-between gap-2 border-b pb-3 border-border">
        <TrackToggle />
        <div className="flex shrink-0 items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={handleCopy}>
            <ArrowUpFromLine className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {copyLabel}
          </Button>
          <ChartDisplayMenu />
        </div>
      </div>

      <div ref={exportRef} className="flex w-full min-w-0 flex-col self-stretch">
        {showTitleRow ? (
          <div className="relative z-[1] flex w-full min-w-0 items-center gap-3 px-2 leading-none">
            {!chartLegendHidden ? <TrackBadge variant={trackVariant} size="md" className="shrink-0" chartWidth={chartWidth} /> : null}
            {showVisibleTitle ? (
              <h2 id="competency-chart-heading" className="min-w-0 flex-1 text-left font-bold text-black" style={{ fontSize: titleSizePx }}>
                {title}
              </h2>
            ) : (
              <h2 id="competency-chart-heading" className="sr-only">
                Chart
              </h2>
            )}
          </div>
        ) : (
          <h2 id="competency-chart-heading" className="sr-only">
            Chart
          </h2>
        )}

        <div ref={frameRef} className="relative z-0 mx-auto w-full max-w-full box-border" style={{ minHeight: FE_UI.chartFrame.minChartHeightPx }}>
          <div className="absolute inset-0 min-h-0 min-w-0">
            <canvas ref={canvasRef} id="competencyChart" aria-labelledby="competency-chart-heading" />
          </div>
        </div>

        {!chartLegendHidden ? (
          <div
            data-chart-export="chart-legend-card"
            className="mx-auto flex w-fit max-w-full items-center justify-center rounded-lg border border-border bg-muted px-6 py-2.5 leading-none"
            style={{ marginTop: legendMarginTopPx }}
          >
            <ClusterLegend chartWidth={chartWidth} />
          </div>
        ) : null}

        <ChartAverages />
      </div>
    </div>
  );
}
