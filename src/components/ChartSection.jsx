import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { ChevronDown, Settings, Share } from "lucide-react";

import { ChartScores } from "@/components/ChartScores";
import { ClusterLegend } from "@/components/ClusterLegend";
import { TrackBadge } from "@/components/TrackBadge";
import { TrackToggle } from "@/components/TrackToggle";
import { Button } from "@/components/ui/button";

import { useCompetencyChart } from "@/hooks/useCompetencyChart";
import { useElementWidth } from "@/hooks/useElementWidth";

import { useAppStore } from "@/store/useAppStore";

import { getChartTitleSizePx, getTrackBadgeMdHeightPx } from "@/chart/fonts";
import { FE_UI, FEATURE_SCORES_SETTINGS, SITE_COPY } from "@/constants";
import { track } from "@/utils/analytics";
import { copyChartAsImageToClipboard, shareChartAsImage } from "@/utils/copy-chart-image";

function DisplayCheckbox({ label, checked, onChange }) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 rounded-md px-3 py-1.5 text-xs hover:bg-muted/60">
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
  const chartLevelTicksHidden = useAppStore((s) => s.chartLevelTicksHidden);
  const setChartLevelTicksHidden = useAppStore((s) => s.setChartLevelTicksHidden);
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
          className="absolute right-0 top-[calc(100%+4px)] z-50 w-max rounded-lg border border-border bg-card py-1 shadow-md"
        >
          <DisplayCheckbox label="Title" checked={!chartTitleHidden} onChange={(v) => setChartTitleHidden(!v)} />
          <DisplayCheckbox label="Chart" checked={!levelsPolygonHidden} onChange={(v) => setLevelsPolygonHidden(!v)} />
          <DisplayCheckbox label="Level labels" checked={!chartLevelTicksHidden} onChange={(v) => setChartLevelTicksHidden(!v)} />
          <DisplayCheckbox label="Legend" checked={!chartLegendHidden} onChange={(v) => setChartLegendHidden(!v)} />
          {FEATURE_SCORES_SETTINGS ? (
            <DisplayCheckbox label="Scores" checked={!footerScoresHidden} onChange={(v) => setFooterScoresHidden(!v)} />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ExportMenuItem({ label, onClick }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="flex w-full cursor-pointer whitespace-nowrap rounded-md px-3 py-2 text-left text-xs hover:bg-muted/60"
    >
      {label}
    </button>
  );
}

/**
 * Whether the Web Share API can share files here. True on mobile Safari/Chrome (and a few
 * desktop browsers like Safari/Edge); false on desktop Chrome-macOS / Firefox. We probe with a
 * tiny dummy file because canShare gates on the files payload specifically. Computed once.
 */
const CAN_SHARE_FILES = (() => {
  try {
    if (typeof navigator === "undefined" || typeof navigator.canShare !== "function" || typeof File !== "function") {
      return false;
    }
    const probe = new File([""], "probe.png", { type: "image/png" });
    return navigator.canShare({ files: [probe] });
  } catch {
    return false;
  }
})();

/** Dropdown bundling the image-export actions: copy to clipboard, and (where supported) share via the OS share sheet. */
function ExportMenu({ label, onCopy, onShare }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

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

  const run = (fn) => () => {
    setOpen(false);
    fn();
  };

  return (
    <div ref={rootRef} className="relative shrink-0">
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-expanded={open}
        aria-haspopup="menu"
        shape="pill"
        onClick={() => setOpen((v) => !v)}
        className="gap-1 pr-1"
      >
        <Share className="h-3.5 w-3.5 shrink-0" aria-hidden />
        {label ?? "Share"}
        <ChevronDown className="h-3.5 w-3.5 opacity-60" />
      </Button>
      {open ? (
        <div
          role="menu"
          aria-label="Export image"
          className="absolute right-0 top-[calc(100%+4px)] z-50 w-max rounded-lg border border-border bg-card p-1 shadow-md"
        >
          <ExportMenuItem label="Copy image (clipboard)" onClick={run(onCopy)} />
          {CAN_SHARE_FILES ? <ExportMenuItem label="Share external..." onClick={run(onShare)} /> : null}
        </div>
      ) : null}
    </div>
  );
}

export function ChartSection({ isVisible }) {
  const exportRef = useRef(null);
  const canvasRef = useRef(null);
  const frameRef = useRef(null);
  const [exportLabel, setExportLabel] = useState(null); // transient status shown on the trigger

  const title = useAppStore((s) => s.title);
  const trackVariant = useAppStore((s) => s.trackVariant);
  const chartLegendHidden = useAppStore((s) => s.chartLegendHidden);
  const chartTitleHidden = useAppStore((s) => s.chartTitleHidden);
  const footerScoresHidden = useAppStore((s) => s.footerScoresHidden);

  const { chartRef, relayout } = useCompetencyChart(canvasRef, frameRef);
  const chartWidth = useElementWidth(frameRef, isVisible);

  const trimmedTitle = String(title).trim();
  // When the title is enabled but blank, show a muted placeholder on the chart (it also bakes into
  // the export) while the form input stays empty. The placeholder text lives in SITE_COPY.
  const titleIsBlank = trimmedTitle.length === 0;
  const displayTitle = titleIsBlank ? SITE_COPY.chartTitlePlaceholder : trimmedTitle;
  const showVisibleTitle = !chartTitleHidden;
  const showTitleRow = showVisibleTitle || !chartLegendHidden;
  const layoutWidth = chartWidth || FE_UI.page.minWidthPx;
  const titleSizePx = getChartTitleSizePx(layoutWidth);
  const titleRowHeightPx = getTrackBadgeMdHeightPx(layoutWidth);

  useLayoutEffect(() => {
    if (isVisible) {
      relayout();
    }
  }, [isVisible, relayout]);

  useEffect(() => {
    relayout();
  }, [chartTitleHidden, chartLegendHidden, relayout]);

  const flashLabel = (text) => {
    setExportLabel(text);
    setTimeout(() => setExportLabel(null), 2000);
  };

  const handleCopy = async () => {
    try {
      const result = await copyChartAsImageToClipboard({
        exportRoot: exportRef.current,
        canvas: canvasRef.current,
        chart: chartRef.current,
      });
      if (result?.method === "clipboard") {
        track("chart_copied", { method: "clipboard" });
        flashLabel("Copied!");
      } else if (result?.method === "download") {
        track("chart_copied", { method: "download" });
        flashLabel("Saved file");
      } else {
        flashLabel("Failed");
      }
    } catch (e) {
      console.error(e);
      flashLabel("Failed");
    }
  };

  const handleShare = async () => {
    try {
      const result = await shareChartAsImage({
        exportRoot: exportRef.current,
        canvas: canvasRef.current,
        chart: chartRef.current,
      });
      if (result?.method === "share") {
        // Native share sheet opened — completion is out of our hands, so don't claim "Shared!".
        track("chart_shared", { method: "share" });
      } else if (result?.method === "share-fallback-clipboard") {
        track("chart_shared", { method: "fallback-clipboard" });
        flashLabel("Copied — paste it");
      } else if (result?.method === "share-fallback-download") {
        track("chart_shared", { method: "fallback-download" });
        flashLabel("Saved file");
      } else {
        flashLabel("Failed");
      }
    } catch (e) {
      console.error(e);
      flashLabel("Failed");
    }
  };

  return (
    <div className="flex w-full min-w-0 flex-col items-center">
      <div className="relative z-[2] flex w-full min-w-0 items-center justify-between gap-2 border-b pb-3 border-border mb-3">
        <TrackToggle />
        <div className="flex shrink-0 items-center gap-2">
          <ExportMenu label={exportLabel} onCopy={handleCopy} onShare={handleShare} />
          <ChartDisplayMenu />
        </div>
      </div>

      <div ref={exportRef} className="relative flex w-full min-w-0 flex-col self-stretch">
        {showTitleRow ? (
          <div className="relative z-[1] flex w-full min-w-0 items-center gap-3 leading-none mb-2" style={{ minHeight: titleRowHeightPx }}>
            {!chartLegendHidden ? <TrackBadge variant={trackVariant} size="md" className="shrink-0" chartWidth={chartWidth} /> : null}
            {showVisibleTitle ? (
              <h2
                id="competency-chart-heading"
                className={`m-0 min-w-0 flex-1 text-left only:ml-2 ${titleIsBlank ? "text-black/30 font-regular" : "text-black font-bold"}`}
                style={{ fontSize: titleSizePx, lineHeight: `${titleRowHeightPx}px` }}
              >
                {displayTitle}
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
            className="mx-auto mt-3 flex w-fit max-w-full items-center justify-center rounded-lg border border-border bg-muted px-6 py-2.5 leading-none"
          >
            <ClusterLegend chartWidth={chartWidth} />
          </div>
        ) : null}

        {FEATURE_SCORES_SETTINGS && !footerScoresHidden ? (
          <div
            data-chart-export="chart-scores"
            className="mt-3 flex flex-col gap-2 min-[470px]:gap-3"
            aria-label="Cluster averages and score summary"
          >
            <ChartScores />
          </div>
        ) : null}
      </div>
    </div>
  );
}
